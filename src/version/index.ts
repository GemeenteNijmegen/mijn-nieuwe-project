import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * Version check handler. The version comes from the APP_VERSION
 * environment variable, which the stack sets at deploy time, so the
 * handler itself doesn't need to know where the version is defined.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {

  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'version check invoked',
    path: event.rawPath,
    requestId: event.requestContext.requestId,
  }));

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: process.env.APP_VERSION ?? 'unknown',
      timestamp: new Date().toISOString(),
    }),
  };
}
