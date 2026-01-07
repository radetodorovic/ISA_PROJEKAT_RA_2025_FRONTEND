import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly TOKEN_KEY = 'jwt_token';
  private readonly USER_ID_KEY = 'user_id';

  constructor() { }

  setToken(token: string): void {
    // Store under both keys for Angular and React compatibility
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem('token', token);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem('token');
  }

  setUserId(userId: number): void {
    localStorage.setItem(this.USER_ID_KEY, userId.toString());
  }

  getUserId(): number | null {
    const userId = localStorage.getItem(this.USER_ID_KEY);
    return userId ? parseInt(userId, 10) : null;
  }

  isAuthenticated(): boolean {
    return this.getToken() !== null;
  }

  logout(): void {
    this.removeToken();
    localStorage.removeItem(this.USER_ID_KEY);
  }
}
