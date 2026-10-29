import Mustache from 'mustache';
import footerTemplate from '../../templates/footer.mustache';
import headerTemplate from '../../templates/header.mustache';

export function render(template: string, data: Record<string, unknown>, partials?: Record<string, string>): string {
  return Mustache.render(template, data, { header: headerTemplate, footer: footerTemplate, ...partials });
}