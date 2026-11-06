import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<user>.github.io/repwise/ on GitHub Pages.
export default defineConfig({
  base: '/repwise/',
  plugins: [react()],
});
