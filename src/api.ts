import axios, { InternalAxiosRequestConfig } from 'axios';

// Base URL is provided via Vite define in vite.config.ts; fallback to host:8080
const API_BASE_URL: string = (globalThis as any).__VITE_API_BASE_URL__ ||
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:8080`
    : 'http://localhost:8080');

export interface Video {
  id: number;
  title: string;
  thumbnailUrl: string;
  videoUrl: string;
  description?: string;
  likesCount: number;
}

export interface Comment {
  id: number;
  author: string;
  text: string;
  createdAt: string; // ISO string
}

// Axios instance configured to attach Authorization header from localStorage token
const api = axios.create({ baseURL: API_BASE_URL });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export default api;
