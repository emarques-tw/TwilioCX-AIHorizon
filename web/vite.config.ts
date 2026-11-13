import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the app from /<repo-name>/. Set VITE_BASE in CI (the workflow does this).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
});
