import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { ValidationUtils, ValidationError } from '../../utils/validators';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  email = signal('');
  password = signal('');

  isLoading = signal(false);
  errorMessage = signal('');
  fieldErrors = signal<Record<string, string>>({});
  loginAttempts = signal(0);
  maxLoginAttempts = 5;
  isLocked = signal(false);

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private router: Router
  ) {}

  validateForm(): boolean {
    const data = {
      email: this.email(),
      password: this.password()
    };

    const validationErrors = ValidationUtils.validateLoginForm(data);
    const errors: Record<string, string> = {};

    validationErrors.forEach(error => {
      errors[error.field] = error.message;
    });

    this.fieldErrors.set(errors);
    this.errorMessage.set('');
    return validationErrors.length === 0;
  }

  onSubmit(): void {
    this.errorMessage.set('');

    if (this.isLocked()) {
      this.errorMessage.set('Too many login attempts. Please try again later.');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.isLoading.set(true);

    const loginData = {
      email: this.email(),
      password: this.password()
    };

    console.log('Sending login data:', loginData);

    this.apiService.login(loginData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.loginAttempts.set(0);

        // Store token and user info (backend may not return user)
        if (response?.token) {
          this.authService.setToken(response.token);
        }
        const userId = (response as any)?.user?.id;
        if (typeof userId === 'number') {
          this.authService.setUserId(userId);
        }

        // Redirect to home (which redirects to /videos)
        this.router.navigate(['/']);
      },
      error: (error) => {
        this.isLoading.set(false);
        const attempts = this.loginAttempts() + 1;
        this.loginAttempts.set(attempts);

        // Check for rate limiting (429)
        if (error.status === 429) {
          this.errorMessage.set('Too many login attempts, try again in 1 minute');
          this.isLocked.set(true);
          return;
        }

        // Check if max attempts reached locally
        if (attempts >= this.maxLoginAttempts) {
          this.isLocked.set(true);
          this.errorMessage.set(
            `Too many failed attempts. Please try again later.`
          );
          return;
        }

        // Display backend error
        const message = ApiService.getErrorMessage(error);
        this.errorMessage.set(message);

        // Set field-level errors if available
        if (error.errors && typeof error.errors === 'object') {
          const fieldErrors: Record<string, string> = {};
          Object.entries(error.errors).forEach(([field, messages]: [field: string, messages: any]) => {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[field] = messages[0];
            }
          });
          if (Object.keys(fieldErrors).length > 0) {
            this.fieldErrors.set(fieldErrors);
          }
        }
      }
    });
  }

  getFieldError(fieldName: string): string {
    return this.fieldErrors()[fieldName] || '';
  }

  hasFieldError(fieldName: string): boolean {
    return !!this.fieldErrors()[fieldName];
  }
}
