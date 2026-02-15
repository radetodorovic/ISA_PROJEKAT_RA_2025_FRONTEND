import './polyfills';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Set default API base to host:8080 when not set by Vite
if (typeof (globalThis as any).__VITE_API_BASE_URL__ === 'undefined') {
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  (globalThis as any).__VITE_API_BASE_URL__ = `${protocol}//${host}:8080`;
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
