import { defineConfig, type Plugin } from 'vite';

// connect-src 'none' makes the privacy promise enforceable: in the built app the browser
// itself refuses any network request, so an image can't leave the device. It is added at
// build time only, because the dev server needs a WebSocket for hot reload.
const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "worker-src 'self'",
  "connect-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const contentSecurityPolicy = (): Plugin => ({
  name: 'content-security-policy',
  apply: 'build',
  transformIndexHtml: () => [
    {
      tag: 'meta',
      attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP },
      injectTo: 'head-prepend',
    },
  ],
});

export default defineConfig({
  base: './', // relative paths, so the build works on GitHub Pages sub-folders too
  plugins: [contentSecurityPolicy()],
  worker: { format: 'es' },
});
