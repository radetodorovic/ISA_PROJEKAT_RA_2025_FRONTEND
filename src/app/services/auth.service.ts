import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'jwt_token';
  private readonly USER_ID_KEY = 'user_id';
  private readonly USER_LOCATION_KEY = 'user_location';
  private readonly USER_RADIUS_KEY = 'user_radius_m';
  private readonly apiBaseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) { }

  setToken(token: string): void {
    // Store under both keys for Angular and React compatibility
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem('token', token);
    
    // Try to extract userId from JWT token
    try {
      const payload = this.decodeJWT(token);
      console.log('Decoded JWT payload:', payload);
      const tokenUserId = this.getUserIdFromPayload(payload);
      if (tokenUserId) {
        console.log('Setting userId from JWT:', tokenUserId);
        this.setUserId(tokenUserId);
      } else {
        console.warn('No numeric userId found in JWT payload');
      }
    } catch (e) {
      console.error('Failed to decode JWT token:', e);
    }
  }

  private decodeJWT(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
      }).join(''));
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('token');
  }

  setUserId(userId: number): void {
      console.log('Storing userId in localStorage:', userId);
    localStorage.setItem(this.USER_ID_KEY, userId.toString());
  }

  getUserId(): number | null {
    const userId = localStorage.getItem(this.USER_ID_KEY);
      console.log('Retrieved userId from localStorage:', userId);
    return userId ? parseInt(userId, 10) : null;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  logout(): void {
    this.removeToken();
    localStorage.removeItem(this.USER_ID_KEY);
    localStorage.removeItem(this.USER_LOCATION_KEY);
    localStorage.removeItem(this.USER_RADIUS_KEY);
  }

  setUserLocation(lat: number, lng: number): void {
    localStorage.setItem(this.USER_LOCATION_KEY, JSON.stringify({ lat, lng }));
  }

  getUserLocation(): { lat: number; lng: number } | null {
    const raw = localStorage.getItem(this.USER_LOCATION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
        return { lat: parsed.lat, lng: parsed.lng };
      }
    } catch (e) {
      return null;
    }
    return null;
  }

  clearUserLocation(): void {
    localStorage.removeItem(this.USER_LOCATION_KEY);
  }

  setUserRadius(radiusMeters: number): void {
    localStorage.setItem(this.USER_RADIUS_KEY, radiusMeters.toString());
  }

  getUserRadius(): number | null {
    const raw = localStorage.getItem(this.USER_RADIUS_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  // Ensure userId is known after login (or app refresh)
  async ensureUserId(): Promise<number | null> {
    const existing = this.getUserId();
    if (existing) return existing;
    const token = this.getToken();
    if (!token) return null;

    // Try to derive userId directly from the JWT first (no HTTP)
    const payload = this.decodeJWT(token);
    const tokenUserId = this.getUserIdFromPayload(payload);
    if (tokenUserId) {
      this.setUserId(tokenUserId);
      return tokenUserId;
    }

    const email = this.getEmailFromToken();

    // Try common endpoints to resolve current user
    const endpoints: string[] = [
      `/api/auth/me`,
      `/api/users/me`,
      `/api/user/me`,
      `/api/users/current`,
      `/api/auth/current-user`,
    ];
    if (email) {
      const e = encodeURIComponent(email);
      endpoints.push(
        `/api/users/by-email?email=${e}`,
        `/api/user/by-email?email=${e}`
      );
    }

    for (const url of endpoints) {
      try {
        const res: any = await firstValueFrom(this.http.get(url));
        const id = this.extractUserId(res);
        if (id) {
          this.setUserId(id);
          return id;
        }
      } catch (err) {
        // ignore and try next
      }
    }
    return null;
  }

  private extractUserId(res: any): number | null {
    const raw = res?.id ?? res?.user?.id ?? res?.data?.id ?? null;
    if (raw == null) return null;
    const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  private getEmailFromToken(): string | null {
    const token = this.getToken();
    if (!token) return null;
    const payload = this.decodeJWT(token);
    // Treat `sub` as email only if it looks like an email; otherwise it may be numeric id
    const sub = payload?.sub;
    const looksLikeEmail = typeof sub === 'string' && sub.includes('@');
    return payload?.email || (looksLikeEmail ? sub : null);
  }

  // Extract numeric userId from common JWT fields
  private getUserIdFromPayload(payload: any): number | null {
    if (!payload) return null;
    const candidates = [payload.userId, payload.id, payload.user_id, payload.uid, payload.sub];
    for (const c of candidates) {
      const n = typeof c === 'string' ? parseInt(c, 10) : Number(c);
      if (Number.isFinite(n)) return n;
    }
    return null;
  }
}
