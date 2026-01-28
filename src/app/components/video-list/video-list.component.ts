import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VideoService } from '../../services/video.service';
import { finalize } from 'rxjs/operators';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';
import { TrendingVideo } from '../../models/trending-video';

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
  loading: boolean = true;
  error: string = '';
  private apiBaseUrl = environment.apiBaseUrl;

  trending: TrendingVideo[] = [];
  trendingLoading = false;
  trendingError = '';
  trendingRadius = 10;
  trendingLimit = 6;
  trendingPage = 0;
  locationPhase: 'pending' | 'granted' | 'denied' | 'unavailable' = 'pending';
  locationMessage = 'Koristimo približnu lokaciju da pokažemo popularne videe u blizini.';
  lastUpdated: string | null = null;
  coords: { lat: number; lon: number } | null = null;

  constructor(
    private videoService: VideoService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Učitaj videe odmah
    this.loadVideos();

    // Učitaj trending odmah (pokuša lokaciju, fallback na globalno)
    this.requestLocationAndLoadTrending();
    
    // Takođe, osluškuj route navigacije - ako korisnik ide na /videos, osvezi videe
    this.route.url.subscribe(() => {
      console.log('[VideoList] Route activated, reloading videos...');
      this.loadVideos();
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

  private requestLocationAndLoadTrending(): void {
    if (!navigator.geolocation) {
      this.locationPhase = 'unavailable';
      this.loadTrending();
      this.cdr.markForCheck();
      return;
    }

    this.locationPhase = 'pending';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        this.locationPhase = 'granted';
        this.locationMessage = 'Prikazujemo trendove blizu vas.';
        this.loadTrending();
        this.cdr.markForCheck();
      },
      () => {
        this.coords = null;
        this.locationPhase = 'denied';
        this.locationMessage = 'Lokacija odbijena; prikazujemo globalne trendove.';
        this.loadTrending();
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  }

  loadTrending(forcePage?: number): void {
    this.trendingLoading = true;
    this.trendingError = '';
    const page = forcePage ?? this.trendingPage;
    this.videoService
      .getTrendingVideos({
        lat: this.coords?.lat,
        lon: this.coords?.lon,
        radius: this.trendingRadius,
        limit: this.trendingLimit,
        page
      })
      .pipe(
        finalize(() => {
          this.trendingLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (data) => {
          this.trending = data || [];
          this.trendingPage = page;
          this.lastUpdated = new Date().toLocaleTimeString();
        },
        error: (err) => {
          console.error('[Trending Error]', err);
          const status = err?.status;
          const message = err?.error?.message || err?.error?.error || err?.message || '';
          if (status === 404) {
            this.trendingError = 'Trending endpoint ne postoji na backendu (/api/videos/trending).';
          } else if (status === 401) {
            this.trendingError = 'Prijavite se da biste videli trendove.';
          } else if (status === 400) {
            this.trendingError = `Loši parametri: ${message || 'Backend odbacio zahtev (400)'}`;
          } else {
            this.trendingError = `Greška ${status || 'nepoznata'}: ${message || 'Neuspešno učitavanje trending videa'}`;
          }
        }
      });
  }

  distanceLabel(distanceKm?: number | null): string {
    if (distanceKm == null || Number.isNaN(distanceKm)) return 'Udaljenost nije dostupna';
    if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
    return `${distanceKm.toFixed(1)} km`;
  }

  refreshTrending(): void {
    this.loadTrending();
  }

  onRadiusChange(value: number): void {
    // Ograniči radius između 1 i 200 km
    this.trendingRadius = Math.min(Math.max(1, value || 10), 200);
    this.trendingPage = 0;
    this.loadTrending(0);
  }

  onLimitChange(value: number): void {
    // Ograniči limit između 1 i 50
    this.trendingLimit = Math.min(Math.max(1, value || 6), 50);
    this.trendingPage = 0;
    this.loadTrending(0);
  }

  prevPage(): void {
    if (this.trendingPage === 0) return;
    const nextPage = this.trendingPage - 1;
    this.loadTrending(nextPage);
  }

  nextPage(): void {
    const nextPage = this.trendingPage + 1;
    this.loadTrending(nextPage);
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

  coordText(): string {
    if (!this.coords) return '';
    const lat = this.coords.lat.toFixed(6);
    const lon = this.coords.lon.toFixed(6);
    return `${lat}, ${lon}`;
  }

  copyCoords(): void {
    const text = this.coordText();
    if (!text) return;
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      navigator.clipboard.writeText(text).then(() => {
        console.log('[VideoList] Coordinates copied:', text);
      }).catch((err) => {
        console.warn('[VideoList] Clipboard write failed:', err);
      });
    }
  }

  openMaps(): void {
    if (!this.coords) return;
    const { lat, lon } = this.coords;
    const url = `https://www.google.com/maps?q=${lat},${lon}`;
    window.open(url, '_blank');
  }

  getVideoLocationDisplay(video: VideoPost): string | null {
    if (!video) return null;
    if (video.location && String(video.location).trim().length > 0) {
      return String(video.location).trim();
    }
    const lat = (video.latitude ?? video.lat);
    const lon = (video.longitude ?? video.lon);
    if (typeof lat === 'number' && typeof lon === 'number') {
      const latStr = lat.toFixed(6);
      const lonStr = lon.toFixed(6);
      return `${latStr}, ${lonStr}`;
    }
    return null;
  }
}
