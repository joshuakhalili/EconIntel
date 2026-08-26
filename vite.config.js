import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// The React source lives in src/client and builds into public/, which is the
// directory Express already serves statically — so the server needs no change
// to know where the front end went.
//
// publicDir is named static-assets rather than the Vite default "public" so
// there is only ever one folder called "public" in this repo, and it is the
// build output.
export default defineConfig({
  root: 'src/client',
  publicDir: 'static-assets',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/client', import.meta.url)),
    },
  },
  build: {
    outDir: '../../public',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    // The browser never talks to a data provider directly — every /api call
    // goes to the Express process, which is where the keys live. Proxying in
    // dev means fetch('/api/...') is written the same way it is in production.
    proxy: {
      '/api': 'http://localhost:3000',
      '/healthz': 'http://localhost:3000',
    },
  },
});
