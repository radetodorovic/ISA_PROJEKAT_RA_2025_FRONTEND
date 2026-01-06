import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ISA_PROJEKAT_RA_2025_FRONTEND');

  isAuthenticated = signal(false);

  constructor(private authService: AuthService) {
    this.updateAuthStatus();
  }

  private updateAuthStatus(): void {
    this.isAuthenticated.set(this.authService.isAuthenticated());
  }

  logout(): void {
    this.authService.logout();
    this.updateAuthStatus();
  }
}
