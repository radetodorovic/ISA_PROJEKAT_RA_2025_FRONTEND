import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';

describe('Auth Flow Integration Tests', () => {
  let apiService: ApiService;
  let authService: AuthService;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ApiService,
        AuthService,
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    });

    apiService = TestBed.inject(ApiService);
    authService = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  it('should complete register -> activate -> login flow', (done) => {
    // Step 1: Register
    const registerData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St'
    };

    apiService.register(registerData).subscribe({
      next: (response) => {
        expect(response).toBeDefined();
        expect(response.message).toBeTruthy();

        // Step 2: Activate
        const activationToken = 'mock-token-123';
        apiService.activate(activationToken).subscribe({
          next: (activateResponse) => {
            expect(activateResponse.message).toBeTruthy();

            // Step 3: Login
            const loginData = {
              email: 'test@example.com',
              password: 'password123'
            };

            apiService.login(loginData).subscribe({
              next: (loginResponse) => {
                expect(loginResponse.token).toBeDefined();
                expect(loginResponse.user).toBeDefined();
                expect(loginResponse.user.email).toBe('test@example.com');

                // Verify token is stored
                authService.setToken(loginResponse.token);
                expect(authService.getToken()).toBe(loginResponse.token);

                done();
              },
              error: (err) => {
                done(err);
              }
            });

            const loginReq = httpMock.expectOne('http://localhost:8080/api/auth/login');
            expect(loginReq.request.method).toBe('POST');
            loginReq.flush({
              token: 'jwt-token-123',
              user: {
                id: 1,
                email: 'test@example.com',
                username: 'testuser',
                firstName: 'John',
                lastName: 'Doe',
                address: '123 Main St',
                activated: true
              }
            });
          },
          error: (err) => {
            done(err);
          }
        });

        const activateReq = httpMock.expectOne(/api\/auth\/activate/);
        expect(activateReq.request.method).toBe('GET');
        activateReq.flush({ message: 'Account activated successfully' });
      },
      error: (err) => {
        done(err);
      }
    });

    const registerReq = httpMock.expectOne('http://localhost:8080/api/auth/register');
    expect(registerReq.request.method).toBe('POST');
    registerReq.flush({ message: 'Registration successful. Check your email.' });
  });

  it('should handle registration error', (done) => {
    const registerData = {
      email: 'existing@example.com',
      username: 'testuser',
      password: 'password123',
      firstName: 'John',
      lastName: 'Doe',
      address: '123 Main St'
    };

    apiService.register(registerData).subscribe({
      next: () => {
        done(new Error('Should have failed'));
      },
      error: (error) => {
        expect(error.message).toBeTruthy();
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/register');
    req.flush(
      { message: 'Email already exists' },
      { status: 400, statusText: 'Bad Request' }
    );
  });

  it('should handle rate limiting (429)', (done) => {
    const loginData = {
      email: 'test@example.com',
      password: 'wrong-password'
    };

    apiService.login(loginData).subscribe({
      next: () => {
        done(new Error('Should have failed'));
      },
      error: (error) => {
        expect(error.status).toBe(429);
        done();
      }
    });

    const req = httpMock.expectOne('http://localhost:8080/api/auth/login');
    req.flush(
      { message: 'Too many login attempts' },
      { status: 429, statusText: 'Too Many Requests' }
    );
  });
});
