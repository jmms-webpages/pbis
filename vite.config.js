import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  // GitHub Pages serves a project site from a subpath —
  // https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/ — so every built
  // asset URL needs that prefix baked in, or the deployed site will load
  // a blank white page while the browser 404s on every JS/CSS file.
  // EDIT THIS to match your actual repo name (with leading/trailing slashes):
  base: '/pbis/',
});
