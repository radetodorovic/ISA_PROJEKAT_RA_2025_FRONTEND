import './polyfills';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Set default environment variable if not set by Vite
if (typeof (globalThis as any).__VITE_API_BASE_URL__ === 'undefined') {
  (globalThis as any).__VITE_API_BASE_URL__ = 'http://localhost:8080';
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
