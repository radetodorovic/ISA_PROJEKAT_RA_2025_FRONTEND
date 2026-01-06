import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ValidationUtils, ValidationError } from '../../utils/validators';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  email = signal('');
  username = signal('');
  password = signal('');
  confirmPassword = signal('');
  firstName = signal('');
  lastName = signal('');
  address = signal('');

  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  fieldErrors = signal<Record<string, string>>({});

  constructor(
    private apiService: ApiService,
    private router: Router
  ) {}

  validateForm(): boolean {
    const data = {
      email: this.email(),
      username: this.username(),
      password: this.password(),
      confirmPassword: this.confirmPassword(),
      firstName: this.firstName(),
      lastName: this.lastName(),
      address: this.address()
    };

    const validationErrors = ValidationUtils.validateRegisterForm(data);
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
    this.successMessage.set('');

    if (!this.validateForm()) {
      return;
    }

    this.isLoading.set(true);

    const registerData = {
      email: this.email(),
      username: this.username(),
      password: this.password(),
      confirmPassword: this.confirmPassword(),
      firstName: this.firstName(),
      lastName: this.lastName(),
      address: this.address()
    };

    console.log('Sending registration data:', registerData);

    this.apiService.register(registerData).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        this.successMessage.set('Check your email to activate your account');
        // Reset form
        this.resetForm();
        // Optionally redirect to login after delay
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (error) => {
        this.isLoading.set(false);
        console.error('Registration error:', error);
        console.error('Error detail:', error.error);
        
        let message = ApiService.getErrorMessage(error);
        
        // If backend returns 400 without message, show helpful error
        if (error.status === 400 && (!message || message === 'Unknown Error')) {
          message = 'Registration failed. Email or username may already be taken.';
        }
        
        this.errorMessage.set(message || 'Registration failed. Please try again.');

        // Set field-level errors if available
        if (error.errors && typeof error.errors === 'object') {
          const fieldErrors: Record<string, string> = {};
          Object.entries(error.errors).forEach(([field, messages]: [string, any]) => {
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

  private resetForm(): void {
    this.email.set('');
    this.username.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.firstName.set('');
    this.lastName.set('');
    this.address.set('');
    this.fieldErrors.set({});
  }

  getFieldError(fieldName: string): string {
    return this.fieldErrors()[fieldName] || '';
  }

  hasFieldError(fieldName: string): boolean {
    return !!this.fieldErrors()[fieldName];
  }
}
