// Environment configuration
// The API_BASE_URL is set at build time by Vite from VITE_API_BASE_URL env var
// Falls back to localhost:8080 if not configured
declare const globalThis: {
  __VITE_API_BASE_URL__?: string;
};

export const environment = {
  get apiBaseUrl(): string {
    return (globalThis.__VITE_API_BASE_URL__ ?? 'http://localhost:8080') as string;
  }
};
