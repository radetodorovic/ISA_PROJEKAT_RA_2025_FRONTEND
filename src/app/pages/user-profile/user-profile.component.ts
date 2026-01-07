import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { VideoService } from '../../services/video.service';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';

interface UserProfile {
  id: number;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  address?: string;
}

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent implements OnInit {
  user = signal<UserProfile | null>(null);
  videos = signal<VideoPost[]>([]);
  loading = signal(true);
  error = signal('');
  
  private apiBaseUrl = environment.apiBaseUrl;
  private userId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.userId = Number(params['id']);
      if (this.userId) {
        this.loadUserProfile();
        this.loadUserVideos();
      }
    });
  }

  loadUserProfile(): void {
    // Pokušaj da učitaš profil korisnika
    // Ako endpoint ne postoji, prikaži osnovne informacije
    this.http.get<UserProfile>(`${this.apiBaseUrl}/api/users/${this.userId}`).subscribe({
      next: (user: UserProfile) => {
        this.user.set(user);
        this.loading.set(false);
      },
      error: (err: any) => {
        console.error('Error loading user profile:', err);
        // Ako endpoint ne postoji (404), prikaži samo ID
        if (err?.status === 404) {
          this.user.set({
            id: this.userId,
            username: `User ${this.userId}`
          });
        } else {
          this.error.set('Failed to load user profile');
        }
        this.loading.set(false);
      }
    });
  }

  loadUserVideos(): void {
    // Učitaj sve videe, pa filtriraj one od ovog korisnika
    this.videoService.getAllVideos().subscribe({
      next: (videos: any) => {
        const list = Array.isArray(videos) ? videos : (videos?.content || []);
        // Filtriraj videe od ovog korisnika (ako postoji userId polje)
        const userVideos = list.filter((v: any) => v.userId === this.userId);
        
        // Sortiraj po datumu (najnovije prvo)
        userVideos.sort((a: any, b: any) => {
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
        
        this.videos.set(userVideos);
      },
      error: (err) => {
        console.error('Error loading user videos:', err);
      }
    });
  }

  getThumbnailUrl(video: VideoPost): string {
    return `${this.apiBaseUrl}${video.thumbnailUrl}`;
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  }

  getUserDisplayName(): string {
    const u = this.user();
    if (!u) return 'Loading...';
    if (u.firstName && u.lastName) {
      return `${u.firstName} ${u.lastName}`;
    }
    return u.username || `User ${u.id}`;
  }
}
