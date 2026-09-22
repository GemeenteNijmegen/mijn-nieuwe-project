/**
 * Lets TypeScript (and esbuild, via the `text` loader configured on the
 * NodejsFunction that bundles these handlers) treat `.mustache` files as
 * plain string imports. Without this, `import x from './foo.mustache'`
 * would fail to type-check.
 */
declare module '*.mustache' {
  const content: string;
  export default content;
}
