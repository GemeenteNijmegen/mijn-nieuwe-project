import Mustache from 'mustache';
import footerTemplate from '../../templates/footer.mustache';
import headerTemplate from '../../templates/header.mustache';
import navTemplate from '../../templates/nav.mustache';

/**
 * Renders a page with the shared layout partials ({{> header}},
 * {{> nav}}, {{> footer}}). `renderedAt` is filled in here because the
 * footer needs it on every page, so handlers can't forget it.
 */
export function render(template: string, data: Record<string, unknown>, partials?: Record<string, string>): string {
  return Mustache.render(
    template,
    { renderedAt: new Date().toISOString(), ...data },
    { header: headerTemplate, nav: navTemplate, footer: footerTemplate, ...partials },
  );
}
