import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { Statics } from '../Statics';

/**
 * Version check handler
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
      version: Statics.appVersion,
      timestamp: new Date().toISOString(),
    }),
  };
}
