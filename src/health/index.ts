import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';

/**
 * A Lambda handler is just a function with a fixed signature:
 * (event, context) -> response. AWS Lambda calls this function every
 * time a request comes in. There is no long-running server process:
 * the platform starts a fresh execution environment on demand (a
 * "cold start"), runs the handler, and freezes or destroys it afterwards.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  // Structured (JSON) logging makes it possible to search and filter
  // logs in CloudWatch Logs Insights later on.
  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'health check invoked',
    path: event.rawPath,
    requestId: event.requestContext.requestId,
  }));

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  };
}
