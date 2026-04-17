import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    // Vite root: resolves index.html and all /src/* absolute paths from frontend/
    root: path.resolve(__dirname, 'frontend'),
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        // @ maps to frontend/ to match the new directory structure
        '@': path.resolve(__dirname, 'frontend'),
      },
    },
    build: {
      // Explicit outDir prevents Vite from defaulting to frontend/dist when root is not CWD
      outDir: path.resolve(__dirname, 'dist'),
      emptyOutDir: true,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify — file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy /api/* to Express backend — avoids CORS in development
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
