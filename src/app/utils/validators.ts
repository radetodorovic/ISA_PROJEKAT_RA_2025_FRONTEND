export interface ValidationError {
  field: string;
  message: string;
}

export class ValidationUtils {
  static validateEmail(email: string): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return 'Email is required';
    }
    if (!emailRegex.test(email)) {
      return 'Invalid email format';
    }
    return null;
  }

  static validateUsername(username: string): string | null {
    if (!username) {
      return 'Username is required';
    }
    if (username.length < 3) {
      return 'Username must be at least 3 characters';
    }
    return null;
  }

  static validatePassword(password: string): string | null {
    if (!password) {
      return 'Password is required';
    }
    if (password.length < 8) {
      return 'Password must be at least 8 characters';
    }
    return null;
  }

  static validatePasswordMatch(password: string, confirmPassword: string): string | null {
    if (password !== confirmPassword) {
      return 'Passwords do not match';
    }
    return null;
  }

  static validateRequired(value: string, fieldName: string): string | null {
    if (!value || value.trim() === '') {
      return `${fieldName} is required`;
    }
    return null;
  }

  static validateRegisterForm(data: {
    email: string;
    username: string;
    password: string;
    confirmPassword: string;
    firstName: string;
    lastName: string;
    address: string;
  }): ValidationError[] {
    const errors: ValidationError[] = [];

    const emailError = this.validateEmail(data.email);
    if (emailError) errors.push({ field: 'email', message: emailError });

    const usernameError = this.validateUsername(data.username);
    if (usernameError) errors.push({ field: 'username', message: usernameError });

    const passwordError = this.validatePassword(data.password);
    if (passwordError) errors.push({ field: 'password', message: passwordError });

    const matchError = this.validatePasswordMatch(data.password, data.confirmPassword);
    if (matchError) errors.push({ field: 'confirmPassword', message: matchError });

    const firstNameError = this.validateRequired(data.firstName, 'First name');
    if (firstNameError) errors.push({ field: 'firstName', message: firstNameError });

    const lastNameError = this.validateRequired(data.lastName, 'Last name');
    if (lastNameError) errors.push({ field: 'lastName', message: lastNameError });

    const addressError = this.validateRequired(data.address, 'Address');
    if (addressError) errors.push({ field: 'address', message: addressError });

    return errors;
  }

  static validateLoginForm(data: { email: string; password: string }): ValidationError[] {
    const errors: ValidationError[] = [];

    const emailError = this.validateEmail(data.email);
    if (emailError) errors.push({ field: 'email', message: emailError });

    const passwordError = this.validatePassword(data.password);
    if (passwordError) errors.push({ field: 'password', message: passwordError });

    return errors;
  }
}
