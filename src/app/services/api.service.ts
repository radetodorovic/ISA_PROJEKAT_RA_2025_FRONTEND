import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';
import { RegisterRequest, LoginRequest, LoginResponse, AuthError } from '../models/user';
import { environment } from '../config/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiBaseUrl: string;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private router: Router
  ) {
    this.apiBaseUrl = environment.apiBaseUrl;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    const token = this.authService.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  register(data: RegisterRequest): Observable<any> {
    return this.http.post(
      `${this.apiBaseUrl}/api/auth/register`,
      data,
      { responseType: 'text' }
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  activate(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(
      `${this.apiBaseUrl}/api/auth/activate?token=${encodeURIComponent(token)}`
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  login(data: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(
      `${this.apiBaseUrl}/api/auth/login`,
      data
    ).pipe(
      catchError(this.handleError.bind(this))
    );
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'An error occurred';
    let statusCode = error.status;

    console.log('Full error object:', error);
    console.log('Error status:', error.status);
    console.log('Error error:', error.error);
    console.log('Error message:', error.message);

    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = error.error.message;
    } else if (error.error instanceof ProgressEvent) {
      // CORS or network error
      errorMessage = 'Cannot connect to server. Please check if backend is running and CORS is configured.';
    } else {
      // Server-side error
      errorMessage = error.error?.message || error.statusText || errorMessage;
    }

    // Handle 401 - unauthorized (token expired or invalid)
    if (statusCode === 401) {
      this.authService.logout();
      this.router.navigate(['/login']);
    }

    // Return error with status code for caller to handle
    const authError: AuthError = {
      message: errorMessage,
      errors: error.error?.errors || {}
    };

    return throwError(() => ({
      status: statusCode,
      ...authError
    }));
  }

  // Helper to extract error message with support for both single message and field-level errors
  static getErrorMessage(error: any): string {
    if (typeof error?.message === 'string') {
      return error.message;
    }
    if (error?.errors && typeof error.errors === 'object') {
      const firstError = Object.values(error.errors)[0];
      if (Array.isArray(firstError) && firstError.length > 0) {
        return String(firstError[0]);
      }
    }
    return 'An unexpected error occurred';
  }
}
