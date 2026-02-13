import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Use React plugin for the React SPA. Angular uses Angular CLI separately.
  plugins: [react()],
  define: {
    global: 'globalThis',
    'globalThis.__VITE_API_BASE_URL__': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:8080'
    )
  }
});
