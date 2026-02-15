// Environment configuration
// The API_BASE_URL is set at build time by Vite from VITE_API_BASE_URL env var
// Falls back to localhost:8080 if not configured
declare const globalThis: {
  __VITE_API_BASE_URL__?: string;
};

export const environment = {
  get apiBaseUrl(): string {
    if (typeof globalThis.__VITE_API_BASE_URL__ === 'string') {
      return globalThis.__VITE_API_BASE_URL__ as string;
    }
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
    return `${protocol}//${host}:8080`;
  }
};
