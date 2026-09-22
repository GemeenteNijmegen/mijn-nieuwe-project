import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import Mustache from 'mustache';
import homeTemplate from '../../../templates/home.mustache';

/**
 * Server-side rendering: instead of returning JSON for a frontend
 * framework to turn into HTML in the browser, this Lambda renders the
 * final HTML itself and sends it straight to the browser. Mustache
 * HTML-escapes every `{{variable}}` it substitutes by default, which
 * is what keeps this safe from injecting markup/script tags via the
 * view data - important once later phases render values that came
 * from a "citizen" record instead of hardcoded strings here.
 */
export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  console.log(JSON.stringify({
    level: 'INFO',
    msg: 'home page requested',
    path: event.rawPath,
    requestId: event.requestContext.requestId,
  }));

  const html = Mustache.render(homeTemplate, {
    title: 'Mijn Sandbox Portal',
    name: 'Indy',
    tagline: 'A learning project for Gemeente Nijmegen developers',
    greeting: 'Welcome! You are viewing a page rendered by a <strong>Lambda function</strong>.',
    renderedAt: new Date().toISOString(),
  });

  return {
    statusCode: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
    body: html,
  };
}
