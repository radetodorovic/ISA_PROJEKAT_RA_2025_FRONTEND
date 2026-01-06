import { defineConfig } from 'vite';
import angular from '@angular/build';

export default defineConfig({
  plugins: [angular()],
  define: {
    'globalThis.__VITE_API_BASE_URL__': JSON.stringify(
      process.env.VITE_API_BASE_URL || 'http://localhost:8080'
    )
  }
});
