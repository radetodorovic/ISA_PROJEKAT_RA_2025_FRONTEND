import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthService } from './services/auth.service';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('ISA_PROJEKAT_RA_2025_FRONTEND');

  isAuthenticated = signal(false);
  currentUserId = signal<number | null>(null);
  isLoadingUserId = signal(false);

  constructor(private authService: AuthService, private router: Router) {
    this.initializeAuth();
    
    // Osluškuj navigacione događaje i ažuriraj status
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.updateAuthStatus();
    });
  }

  // Inicijalizuj auth pri startu aplikacije
  private async initializeAuth(): Promise<void> {
    this.updateAuthStatus();
    
    // Ako je autentifikovan ali nema userId, učitaj ga
    if (this.isAuthenticated() && !this.currentUserId()) {
      this.isLoadingUserId.set(true);
      console.log('Initializing userId...');
      const id = await this.authService.ensureUserId();
      if (id) {
        console.log('UserId initialized:', id);
        this.currentUserId.set(id);
      } else {
        console.warn('Failed to initialize userId');
      }
      this.isLoadingUserId.set(false);
    }
  }

  private updateAuthStatus(): void {
    this.isAuthenticated.set(this.authService.isAuthenticated());
    const uid = this.authService.getUserId();
    this.currentUserId.set(uid);
    
    console.log('Auth status updated:', {
      isAuthenticated: this.isAuthenticated(),
      userId: this.currentUserId()
    });
  }

  logout(): void {
    this.authService.logout();
    this.updateAuthStatus();
    this.router.navigate(['/login']);
  }

  goToMyProfile(event: Event): void {
    event.preventDefault();
    
    if (this.isLoadingUserId()) {
      console.log('Still loading user ID, please wait...');
      return;
    }
    
    const id = this.currentUserId();
    
    if (id) {
      console.log('Navigating to profile:', id);
      this.router.navigate(['/users', id]);
      return;
    }
    
    if (!this.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    
    // Ako JOŠ UVEK nema ID (ne bi trebalo da se desi), pokušaj ponovo
    console.warn('No userId found, attempting to resolve...');
    this.isLoadingUserId.set(true);
    this.authService.ensureUserId().then((resolved) => {
      this.isLoadingUserId.set(false);
      if (resolved) {
        this.currentUserId.set(resolved);
        this.router.navigate(['/users', resolved]);
      } else {
        console.error('Failed to resolve userId');
        this.router.navigate(['/dashboard']);
      }
    });
  }
}