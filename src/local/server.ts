import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import * as path from 'node:path';
import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handler as health } from '../health';
import { handler as home } from '../home';
import { handler as version } from '../version';
import { serveStatic } from './static';

type Handler = (event: APIGatewayProxyEventV2) => Promise<APIGatewayProxyResultV2>;

// Mirrors the routes in SandboxPortalStack.ts.
const routes: Record<string, Handler> = {
  'GET /': home,
  'GET /health': health,
  'GET /home': home,
  'GET /version': version,
};

const port = Number(process.env.PORT ?? 3000);

// In AWS the stack sets these environment variables; locally we set
// them ourselves so the handlers see the same configuration.
process.env.APP_VERSION ??= 'local';

// Resolved once at startup, relative to where you start the server
// (the project root when you use `npx projen dev`).
const staticRoot = path.resolve('static');

function toEvent(req: IncomingMessage, body: string): APIGatewayProxyEventV2 {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (name === 'cookie' || value === undefined) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(',') : value;
  }
  return {
    version: '2.0',
    routeKey: `${req.method} ${url.pathname}`,
    rawPath: url.pathname,
    rawQueryString: url.search.slice(1),
    headers: headers,
    cookies: req.headers.cookie?.split('; '),
    queryStringParameters: url.searchParams.size ? Object.fromEntries(url.searchParams.entries()) : undefined,
    requestContext: {
      requestId: randomUUID(),
      http: { method: req.method ?? 'GET', path: url.pathname, protocol: `HTTP/${req.httpVersion}`, sourceIp: req.socket.remoteAddress ?? '127.0.0.1', userAgent: req.headers['user-agent'] ?? '' },
      accountId: '',
      apiId: '',
      domainName: '',
      domainPrefix: '',
      routeKey: '',
      stage: '',
      time: '',
      timeEpoch: 0,
    },
    body: body || undefined,
    isBase64Encoded: false,
  } satisfies APIGatewayProxyEventV2;
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

createServer(async (req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://localhost').pathname;

  if (await serveStatic(urlPath, staticRoot, res)) {
    return;
  }

  const route = routes[`${req.method} ${urlPath}`];
  if (!route) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
    return;
  }

  try {
    const body = await readBody(req);
    const event = toEvent(req, body);
    const selectedRoute = await route(event);
    writeResponse(res, selectedRoute);
  } catch (err) {
    console.error(err);
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
}).listen(port, () => console.log(`http://localhost:${port}`));

function writeResponse(res: ServerResponse, result: APIGatewayProxyResultV2) {
  if (typeof result === 'string') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(result);
  } else {
    const headers = Object.fromEntries(
      Object.entries(result.headers ?? { 'content-type': 'application/json' }).map(([name, value]) => [name, String(value)]),
    );
    if (result.cookies?.length) {
      res.setHeader('set-cookie', result.cookies);
    }
    res.writeHead(result.statusCode ?? 200, headers);
    res.end(result.body);
  }
}