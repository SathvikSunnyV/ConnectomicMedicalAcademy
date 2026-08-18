import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev server proxies /api to the Express backend on :4100. In production,
// `npm run build` outputs to dist/, which server.js serves directly at
// the same origin as the API, so no proxy is needed there.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4100'
    }
  },
  build: {
    outDir: 'dist'
  }
});
