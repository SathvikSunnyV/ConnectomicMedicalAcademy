import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express backend on :4100. In production,
// `npm run build` outputs to dist/, which server.js serves directly at
// the same origin as the API, so no proxy is needed there.
// og:image / og:url must be absolute for social-media previews. Set SITE_URL
// (e.g. https://academy.example.com) in the build environment or in
// backend/.env. If unset, falls back to relative URLs (previews won't work,
// but nothing breaks).
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, '../backend', ''), ...process.env };
  const siteUrl = (env.SITE_URL || '').replace(/\/+$/, '');
  return {
  plugins: [
    react(),
    {
      name: 'site-url-html',
      transformIndexHtml: html => html.replace(/__SITE_URL__/g, siteUrl)
    }
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4100'
    }
  },
  build: {
    outDir: 'dist'
  }
};
});
