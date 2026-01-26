import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { finalize } from 'rxjs/operators';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';
import { TrendingVideo } from '../../models/trending-video';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './video-list.component.html',
  styleUrl: './video-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoListComponent implements OnInit {
  videos: VideoPost[] = [];
  trending: TrendingVideo[] = [];
  trendingLoading: boolean = false;
  trendingError: string = '';
  trendingRunMessage: string = '';
  trendingLocation: string = '';
  loading: boolean = true;
  error: string = '';
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(
    private videoService: VideoService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Učitaj videe odmah
    this.loadVideos();
    if (this.authService.isAuthenticated()) {
      this.loadTrending();
    }
    
    // Takođe, osluškuj route navigacije - ako korisnik ide na /videos, osvezi videe
    this.route.url.subscribe(() => {
      console.log('[VideoList] Route activated, reloading videos...');
      this.loadVideos();
      if (this.authService.isAuthenticated()) {
        this.loadTrending();
      }
    });
  }

  loadVideos(): void {
    this.loading = true;
    this.error = '';
    console.log('[VideoList] Fetching videos from API...');
    this.videoService
      .getAllVideos()
      .pipe(
        finalize(() => {
          // Uvek ugasi loading, čak i ako dođe do mrežne greške
          this.loading = false;
          // Force change detection jer koristimo OnPush
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (videos) => {
          console.log('[VideoList] Received videos:', videos);
          // Ako backend vraća paginirani objekat, pokušaj izvući content
          const anyData: any = videos as unknown as any;
          const list: any = Array.isArray(anyData) ? anyData : (anyData?.content || anyData?.items);
          this.videos = Array.isArray(list) ? list : (Array.isArray(videos) ? videos : []);
          
          // Sortiraj videos po createdAt (najnovije prvo)
          this.videos.sort((a, b) => {
            const dateA = new Date(a.createdAt || a.uploadedAt || 0).getTime();
            const dateB = new Date(b.createdAt || b.uploadedAt || 0).getTime();
            return dateB - dateA; // Opadajući redosled (najnovije prvo)
          });
          
          // Osiguraj da loading bude ugašen i u success grani
          this.loading = false;
          console.log('[VideoList] Videos set:', this.videos.length, 'items');
          // Force change detection
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading videos:', err);
          const status = err?.status;
          if (status === 401) {
            this.error = 'Please login to view videos.';
          } else if (status === 403) {
            this.error = 'You do not have permission to view videos.';
          } else {
            this.error = 'Failed to load videos. Please try again later.';
          }
          // Force change detection
          this.cdr.markForCheck();
        }
      });
  }

  loadTrending(): void {
    this.trendingLoading = true;
    this.trendingError = '';
    this.trendingRunMessage = '';
    this.videoService
      .getTrendingVideos(this.trendingLocation || undefined)
      .pipe(
        finalize(() => {
          this.trendingLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (items) => {
          this.trending = Array.isArray(items) ? items : [];
          this.cdr.markForCheck();
        },
        error: (err) => {
          console.error('Error loading trending videos:', err);
          if (err?.status === 401) {
            this.trendingError = 'Please login to view trending videos.';
          } else {
            this.trendingError = 'Failed to load trending videos.';
          }
          this.cdr.markForCheck();
        }
      });
  }

  runTrendingPipeline(): void {
    this.trendingLoading = true;
    this.trendingError = '';
    this.trendingRunMessage = '';
    this.videoService.runTrendingPipeline().subscribe({
      next: () => {
        this.trendingRunMessage = 'Trending pipeline pokrenut. Osvezavam listu...';
        this.loadTrending();
      },
      error: (err) => {
        console.error('Error running trending pipeline:', err);
        if (err?.status === 401) {
          this.trendingError = 'Please login to run the trending pipeline.';
        } else {
          this.trendingError = 'Failed to run trending pipeline.';
        }
        this.trendingLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  getThumbnailUrl(video: VideoPost): string {
    return `${this.apiBaseUrl}${video.thumbnailUrl}`;
  }

  getVideoUrl(video: VideoPost): string {
    const url = (video as any).videoUrl || (video as any).videoUrl1 || '';
    return url ? `${this.apiBaseUrl}${url}` : '#';
  }

  formatDate(dateString: string): string {
    return this.formatDateSafe(dateString);
  }

  getDisplayDate(video: VideoPost): string {
    const raw = video.uploadedAt || video.createdAt;
    return this.formatDateSafe(raw);
  }

  hasValidDate(video: VideoPost): boolean {
    const raw = video.uploadedAt || video.createdAt;
    return this.isValidDate(raw);
  }

  private formatDateSafe(dateString?: string): string {
    if (!dateString) return 'Date unavailable';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Date unavailable';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private isValidDate(dateString?: string): boolean {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  formatFileSize(bytes: number): string {
    return this.videoService.formatFileSize(bytes);
  }
}
