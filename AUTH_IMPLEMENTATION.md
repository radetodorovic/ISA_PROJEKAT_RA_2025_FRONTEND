# Authentication Implementation Guide

## Overview
This document describes the authentication system implemented for the ISA Project Frontend, including registration, email activation, login, and protected routes.

## Features Implemented

### 1. Registration (`/register`)
- Form fields: email, username, password, confirmPassword, firstName, lastName, address
- **Client-side validations:**
  - Email format validation (regex)
  - Username minimum length 3
  - Password minimum length 8
  - Passwords must match
  - All required fields must be filled
  - Inline validation messages displayed for each field
- **On successful registration:**
  - Calls `POST /api/auth/register` endpoint
  - Shows success message: "Check your email to activate your account"
  - Redirects to login page after 2 seconds
- **Error handling:**
  - Displays backend validation errors inline
  - Shows field-specific error messages

### 2. Email Activation (`/activate`)
- Reads activation token from query parameter `?token=...`
- Calls `GET /api/auth/activate?token=...` endpoint
- Shows success message and redirects to login on success
- Shows error message if activation fails
- Loading state with spinner during activation

### 3. Login (`/login`)
- Form fields: email, password
- **Client-side validations:**
  - Email format validation
  - Password minimum length 8
  - Inline error messages
- **On successful login:**
  - Calls `POST /api/auth/login` endpoint
  - Stores JWT token in `localStorage` under key `authToken`
  - Stores user info
  - Redirects to `/dashboard` (protected route)
- **Error handling:**
  - Displays backend error messages
  - Shows "Account not activated" error if applicable
  - **Rate limiting (429 response):** Shows "Too many login attempts, try again in 1 minute"
  - **Local attempt counter:** Disables login button after 5 failed attempts
- **Pending state:**
  - Disables inputs and submit button while request in flight
  - Shows loading spinner

### 4. Protected Routes
- **Dashboard** (`/dashboard`) - Protected example page
- Implemented using `AuthGuardService` that checks for valid auth token
- Redirects unauthenticated users to `/login`
- Can be applied to any route with `canActivate: [AuthGuardService]`

### 5. Authentication Storage & Request Handling
- **Token Storage:**
  - JWT stored in `localStorage` under key `authToken`
  - Can also support httpOnly cookies set by backend
- **API Requests:**
  - `Authorization: Bearer <token>` header automatically added via `authInterceptor`
  - Centralized in `ApiService`
- **Token Expiry/401 Handling:**
  - Global 401 response handling redirects to `/login`
  - Token cleared from storage
  - User session invalidated

### 6. User Navigation
- **Navigation bar shows:**
  - For unauthenticated users: "Login" and "Register" links
  - For authenticated users: "Dashboard" link and "Logout" button
- Links dynamically updated based on authentication state

## Project Structure

```
src/app/
├── config/
│   └── environment.ts              # Environment configuration
├── guards/
│   └── auth.guard.ts               # AuthGuard for protected routes
├── interceptors/
│   └── auth.interceptor.ts         # HTTP interceptor for Auth header
├── models/
│   ├── user.ts                     # User & Auth request/response types
│   └── video-post.ts               # Existing video model
├── pages/
│   ├── register/
│   │   ├── register.component.ts
│   │   ├── register.component.html
│   │   └── register.component.css
│   ├── login/
│   │   ├── login.component.ts
│   │   ├── login.component.html
│   │   └── login.component.css
│   ├── activate/
│   │   ├── activate.component.ts
│   │   ├── activate.component.html
│   │   └── activate.component.css
│   └── dashboard/
│       ├── dashboard.component.ts
│       ├── dashboard.component.html
│       └── dashboard.component.css
├── services/
│   ├── auth.service.ts             # Auth state management (token, user id)
│   ├── api.service.ts              # Centralized API calls
│   └── video.service.ts            # Existing video service
├── utils/
│   ├── validators.ts               # Validation utilities
│   └── validators.spec.ts          # Validation tests
├── app.routes.ts                   # Updated routes with new pages
├── app.ts                          # Updated with auth state
├── app.html                        # Updated with auth links
└── app.css                         # Updated navbar styles
└── services/
    └── auth.integration.spec.ts    # Integration tests
.env                                # Local environment config
.env.example                        # Environment template
```

## API Endpoints

All endpoints use the base URL configured via `VITE_API_BASE_URL` environment variable (default: `http://localhost:8080`).

### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "secure_password",
  "firstName": "John",
  "lastName": "Doe",
  "address": "123 Main St"
}

Response (201):
{
  "message": "Registration successful. Check your email to activate your account."
}

Error (400):
{
  "message": "Email already exists",
  "errors": {
    "email": ["Email is already in use"]
  }
}
```

### Activate
```
GET /api/auth/activate?token={activation_token}

Response (200):
{
  "message": "Account activated successfully"
}

Error (400):
{
  "message": "Invalid or expired activation token"
}
```

### Login
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}

Response (200):
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "address": "123 Main St",
    "activated": true
  }
}

Error (400):
{
  "message": "Account not activated. Please check your email."
}

Error (401):
{
  "message": "Invalid credentials"
}

Error (429):
{
  "message": "Too many login attempts. Please try again later."
}
```

## Configuration

### Environment Variables
Create a `.env` file in the project root (or use `.env.example` as template):

```env
# API Base URL - defaults to http://localhost:8080 if not set
VITE_API_BASE_URL=http://localhost:8080

# For production
# VITE_API_BASE_URL=https://api.yourdomain.com
```

### Local Development
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Update `VITE_API_BASE_URL` if your backend is on a different URL

3. Start the dev server:
   ```bash
   npm start
   ```

4. Access at `http://localhost:4200`

## Running Tests

### Validation Tests
Tests for all validation utilities:
```bash
npm test -- validators.spec.ts
```

### Integration Tests
Tests for the complete auth flow (register -> activate -> login):
```bash
npm test -- auth.integration.spec.ts
```

## Services

### AuthService
Manages authentication state:
```typescript
// Store/retrieve JWT token
authService.setToken(token: string);
authService.getToken(): string | null;
authService.removeToken(): void;

// Manage user ID
authService.setUserId(userId: number): void;
authService.getUserId(): number | null;

// Check auth status
authService.isAuthenticated(): boolean;

// Logout
authService.logout(): void;
```

### ApiService
Centralized API calls:
```typescript
register(data: RegisterRequest): Observable<{ message: string }>;
activate(token: string): Observable<{ message: string }>;
login(data: LoginRequest): Observable<LoginResponse>;

// Static helper for error messages
ApiService.getErrorMessage(error: any): string;
```

### ValidationUtils
Reusable validation functions:
```typescript
ValidationUtils.validateEmail(email: string): string | null;
ValidationUtils.validateUsername(username: string): string | null;
ValidationUtils.validatePassword(password: string): string | null;
ValidationUtils.validatePasswordMatch(password: string, confirmPassword: string): string | null;
ValidationUtils.validateRequired(value: string, fieldName: string): string | null;
ValidationUtils.validateRegisterForm(data: {...}): ValidationError[];
ValidationUtils.validateLoginForm(data: {...}): ValidationError[];
```

## Error Handling

### Validation Errors
- Client-side validation errors shown inline next to form fields
- Form not submitted if validation fails

### Backend Errors
- Field-level errors displayed inline if backend returns error object
- General error message displayed at top of form
- 401 errors trigger automatic logout and redirect to login

### Rate Limiting (429)
- Backend returns 429 for too many login attempts per IP
- Frontend shows: "Too many login attempts, try again in 1 minute"
- Local counter also disables login button after 5 failed attempts for better UX

## Security Considerations

1. **Token Storage:**
   - JWT stored in localStorage (accessible to XSS)
   - Consider httpOnly cookies for sensitive environments
   - Backend can set httpOnly cookie and frontend will use it

2. **HTTPS:**
   - Use HTTPS in production
   - Set `Secure` flag on cookies

3. **Token Expiry:**
   - Backend should set reasonable JWT expiry times
   - Frontend automatically redirects on 401

4. **CORS:**
   - Configure backend CORS to allow frontend domain
   - Credentials should be included in requests if using cookies

## Customization

### Add Protected Route
To protect a new route, add it to `app.routes.ts`:

```typescript
{
  path: 'profile',
  component: ProfileComponent,
  canActivate: [AuthGuardService]
}
```

### Customize Validation
Edit validation rules in `src/app/utils/validators.ts`

### Customize Styling
Update component CSS files:
- `register.component.css`
- `login.component.css`
- `activate.component.css`
- `dashboard.component.css`
- `app.css`

## Troubleshooting

### "VITE_API_BASE_URL is not defined"
- Create `.env` file with `VITE_API_BASE_URL=http://localhost:8080`
- Restart dev server after creating `.env` file

### CORS Errors
- Backend must allow requests from frontend origin
- Check backend CORS configuration

### Token not persisting
- Check browser localStorage is enabled
- Clear localStorage and login again

### Protected route redirecting to login
- Verify JWT is stored in localStorage under key `authToken`
- Check token validity with backend

## Trending Videos (Geo-aware)

### Overview
- Frontend supports geo-aware trending videos via `GET /api/videos/trending`.
- If geolocation is granted, requests include `lat` and `lon` with `radius`, `limit`, `page`.
- If denied/unavailable, requests exclude `lat`/`lon` and backend returns global trends.

### Implementation (Angular)
- Service: `src/app/services/video.service.ts`
  - `getTrendingVideos({ lat?, lon?, radius=10, limit=6, page=0 })` builds query params without empty strings.
- Component: `src/app/components/video-list/video-list.component.ts`
  - Attempts geolocation on init; sets UI state and calls service accordingly.
  - UI messages: loading, denied/unavailable fallback, no results, and errors.
- Template: `src/app/components/video-list/video-list.component.html`
  - Controls for radius, limit, refresh, simple pagination.

### Checklist
- DONE: Do not send empty strings for `lat`/`lon` (omit params if not available).
- DONE: Geolocation handling with `navigator.geolocation.getCurrentPosition` and graceful fallback.
- DONE: Display message: "Lokacija odbijena; prikazujemo globalne trendove" when denied.
- DONE: UI states for loading / no results / global fallback; controls for refresh/radius/limit.
- TODO: Verify in DevTools → Network that `GET /api/videos/trending` carries correct params (names `lat`/`lon`).

### Quick Copilot Prompt (srpski)
"Dodaj/izmeni frontend logiku za 'local trending' na stranici sa video listom:
1) Napravi funkciju koja pokušava da dohvati geolokaciju preko `navigator.geolocation.getCurrentPosition`.
2) Ako korisnik dozvoli, pozovi backend GET /api/videos/trending sa query parametrima `lat` i `lon` (decimalne vrednosti) i prosledi `radius`, `limit` i `page`.
3) Ako korisnik odbije ili geolokacija nije dostupna, pozovi isti endpoint BEZ `lat`/`lon` (samo `radius`/`limit`), i prikaži poruku 'Lokacija odbijena; prikazujemo globalne trendove'.
4) Rukuj greškama i prikaži poruku korisniku ako backend vrati grešku.
5) Dovrši UI status porukama: loading, nema videa u radijusu, prikaz globalnih trendova. Koristi Angular HttpClient i minimalne izmene u postojećem servisu/komponenti."
