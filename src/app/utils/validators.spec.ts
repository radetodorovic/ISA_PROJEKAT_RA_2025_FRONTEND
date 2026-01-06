import { describe, it, expect } from 'vitest';
import { ValidationUtils } from './validators';

describe('ValidationUtils', () => {
  describe('validateEmail', () => {
    it('should return null for valid email', () => {
      const result = ValidationUtils.validateEmail('test@example.com');
      expect(result).toBeNull();
    });

    it('should return error for invalid email format', () => {
      const result = ValidationUtils.validateEmail('invalid-email');
      expect(result).toBeTruthy();
    });

    it('should return error for empty email', () => {
      const result = ValidationUtils.validateEmail('');
      expect(result).toBeTruthy();
    });
  });

  describe('validateUsername', () => {
    it('should return null for valid username', () => {
      const result = ValidationUtils.validateUsername('user123');
      expect(result).toBeNull();
    });

    it('should return error for username less than 3 characters', () => {
      const result = ValidationUtils.validateUsername('ab');
      expect(result).toBeTruthy();
    });

    it('should return error for empty username', () => {
      const result = ValidationUtils.validateUsername('');
      expect(result).toBeTruthy();
    });
  });

  describe('validatePassword', () => {
    it('should return null for valid password', () => {
      const result = ValidationUtils.validatePassword('password123');
      expect(result).toBeNull();
    });

    it('should return error for password less than 8 characters', () => {
      const result = ValidationUtils.validatePassword('pass123');
      expect(result).toBeTruthy();
    });

    it('should return error for empty password', () => {
      const result = ValidationUtils.validatePassword('');
      expect(result).toBeTruthy();
    });
  });

  describe('validatePasswordMatch', () => {
    it('should return null when passwords match', () => {
      const result = ValidationUtils.validatePasswordMatch('password123', 'password123');
      expect(result).toBeNull();
    });

    it('should return error when passwords do not match', () => {
      const result = ValidationUtils.validatePasswordMatch('password123', 'password456');
      expect(result).toBeTruthy();
    });
  });

  describe('validateRequired', () => {
    it('should return null for non-empty value', () => {
      const result = ValidationUtils.validateRequired('value', 'Field');
      expect(result).toBeNull();
    });

    it('should return error for empty value', () => {
      const result = ValidationUtils.validateRequired('', 'Field');
      expect(result).toBeTruthy();
    });

    it('should return error for whitespace only', () => {
      const result = ValidationUtils.validateRequired('   ', 'Field');
      expect(result).toBeTruthy();
    });
  });

  describe('validateRegisterForm', () => {
    it('should return no errors for valid form data', () => {
      const data = {
        email: 'test@example.com',
        username: 'testuser',
        password: 'password123',
        confirmPassword: 'password123',
        firstName: 'John',
        lastName: 'Doe',
        address: '123 Main St'
      };
      const errors = ValidationUtils.validateRegisterForm(data);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid form data', () => {
      const data = {
        email: 'invalid',
        username: 'ab',
        password: 'short',
        confirmPassword: 'short2',
        firstName: '',
        lastName: '',
        address: ''
      };
      const errors = ValidationUtils.validateRegisterForm(data);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => e.field === 'email')).toBe(true);
      expect(errors.some(e => e.field === 'username')).toBe(true);
      expect(errors.some(e => e.field === 'password')).toBe(true);
    });
  });

  describe('validateLoginForm', () => {
    it('should return no errors for valid login data', () => {
      const data = {
        email: 'test@example.com',
        password: 'password123'
      };
      const errors = ValidationUtils.validateLoginForm(data);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid login data', () => {
      const data = {
        email: 'invalid',
        password: 'short'
      };
      const errors = ValidationUtils.validateLoginForm(data);
      expect(errors.length).toBeGreaterThan(0);
    });
  });
});
