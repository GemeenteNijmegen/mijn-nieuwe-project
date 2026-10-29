import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import * as path from 'node:path';

const STATIC_PREFIX = '/static/';

const contentTypes: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

/**
 * Maps a URL path to a file inside `staticRoot`, or returns undefined if the
 * path isn't a static file request or would escape `staticRoot`.
 *
 * Pure function: it only computes a path, it never touches the disk. That
 * makes it easy to unit-test with every traversal trick you can think of.
 */
export function resolveStaticPath(urlPath: string, staticRoot: string): string | undefined {
  if (!urlPath.startsWith(STATIC_PREFIX)) {
    return undefined;
  }

  let relative: string;
  try {
    // Decode %20 etc. This can turn '..%2f' back into '../', so the
    // traversal check below must happen AFTER decoding.
    relative = decodeURIComponent(urlPath.slice(STATIC_PREFIX.length));
  } catch {
    return undefined; // malformed encoding, e.g. '%E0%A4%A'
  }

  const file = path.resolve(staticRoot, relative);

  // Check the final path, not the input. `+ path.sep` stops
  // '/project/static-secrets' from passing as '/project/static'.
  if (!file.startsWith(staticRoot + path.sep)) {
    return undefined;
  }
  return file;
}

/**
 * Serves a file from `staticRoot`. Returns false if the URL isn't a
 * static request, so the caller can fall through to the route table.
 */
export async function serveStatic(urlPath: string, staticRoot: string, res: ServerResponse): Promise<boolean> {
  if (!urlPath.startsWith(STATIC_PREFIX)) {
    return false;
  }

  const file = resolveStaticPath(urlPath, staticRoot);
  if (!file) {
    notFound(res); // 404, not 403: don't reveal what exists outside static/
    return true;
  }

  try {
    const content = await readFile(file);
    res.writeHead(200, {
      'content-type': contentTypes[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-cache', // locally, always show the latest CSS
    });
    res.end(content);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'EISDIR') {
      notFound(res);
    } else {
      console.error(JSON.stringify({ level: 'ERROR', msg: 'static file read failed', file, code }));
      res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Internal Server Error');
    }
  }
  return true;
}

function notFound(res: ServerResponse) {
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}
