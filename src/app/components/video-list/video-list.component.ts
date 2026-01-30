import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { finalize } from 'rxjs/operators';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';
import { TrendingVideo } from '../../models/trending-video';
import { AuthService } from '../../services/auth.service';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './video-list.component.html',
  styleUrl: './video-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoListComponent implements OnInit, AfterViewInit, OnDestroy {
  videos: VideoPost[] = [];
  trending: TrendingVideo[] = [];
  trendingLoading: boolean = false;
  trendingError: string = '';
  trendingRunMessage: string = '';
  selectedLatitude: number | null = null;
  selectedLongitude: number | null = null;
  radiusMeters: number = 200;
  loading: boolean = true;
  error: string = '';
  private apiBaseUrl = environment.apiBaseUrl;
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private radiusCircle: L.Circle | null = null;
  private videoMarkers: L.LayerGroup | null = null;

  constructor(
    private videoService: VideoService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Ucitaj videe odmah
    this.loadVideos();
    if (this.authService.isAuthenticated()) {
      this.loadSavedLocation();
      this.loadTrending();
    }

    // Takodje, osluskivaj route navigacije - ako korisnik ide na /videos, osvezi videe
    this.route.url.subscribe(() => {
      console.log('[VideoList] Route activated, reloading videos...');
      this.loadVideos();
      if (this.authService.isAuthenticated()) {
        this.loadSavedLocation();
        this.loadTrending();
      }
    });
  }

  ngAfterViewInit(): void {
    if (this.authService.isAuthenticated()) {
      this.initMap();
      this.renderTrendingMarkers();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
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
      .getTrendingVideos(this.getTrendingQuery())
      .pipe(
        finalize(() => {
          this.trendingLoading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (items) => {
          this.trending = Array.isArray(items) ? items : [];
          this.renderTrendingMarkers();
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

  private getTrendingQuery(): { latitude?: number; longitude?: number; radiusMeters?: number } | undefined {
    if (this.selectedLatitude != null && this.selectedLongitude != null) {
      return {
        latitude: this.selectedLatitude,
        longitude: this.selectedLongitude,
        radiusMeters: this.radiusMeters
      };
    }
    return undefined;
  }

  private loadSavedLocation(): void {
    const saved = this.authService.getUserLocation();
    const savedRadius = this.authService.getUserRadius();
    if (saved) {
      this.selectedLatitude = saved.lat;
      this.selectedLongitude = saved.lng;
    }
    if (typeof savedRadius === 'number' && savedRadius > 0) {
      this.radiusMeters = savedRadius;
    }
  }

  private initMap(): void {
    const container = document.getElementById('trending-map');
    if (!container) return;

    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
    });

    const initialLat = this.selectedLatitude ?? 44.8176;
    const initialLng = this.selectedLongitude ?? 20.4633;
    this.map = L.map(container).setView([initialLat, initialLng], 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.videoMarkers = L.layerGroup().addTo(this.map);

    if (this.selectedLatitude != null && this.selectedLongitude != null) {
      this.placeMarker(this.selectedLatitude, this.selectedLongitude);
      this.updateRadiusCircle();
    } else {
      // Ako nema sacuvane lokacije, automatski ucitaj trenutnu lokaciju korisnika
      this.autoLoadUserLocation();
    }

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.selectedLatitude = Number(e.latlng.lat.toFixed(6));
      this.selectedLongitude = Number(e.latlng.lng.toFixed(6));
      this.placeMarker(this.selectedLatitude, this.selectedLongitude);
      this.updateRadiusCircle();
      this.cdr.markForCheck();
    });
  }

  private autoLoadUserLocation(): void {
    if (!navigator.geolocation) {
      console.warn('Geolocation nije podržan - koristim backend aproksimaciju.');
      this.useBackendGeoIP();
      return;
    }
    
    // Prvo pokušaj tražiti preciznu lokaciju od korisnika
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Korisnik je dozvolio - koristi preciznu lokaciju
        this.selectedLatitude = Number(pos.coords.latitude.toFixed(6));
        this.selectedLongitude = Number(pos.coords.longitude.toFixed(6));
        this.placeMarker(this.selectedLatitude, this.selectedLongitude);
        this.updateRadiusCircle();
        if (this.map) {
          this.map.setView([this.selectedLatitude, this.selectedLongitude], 14);
        }
        console.log('✓ Precizna lokacija od korisnika:', { lat: this.selectedLatitude, lng: this.selectedLongitude });
        this.loadTrending();
        this.cdr.markForCheck();
      },
      (error) => {
        // Korisnik je odbio ili greška - fallback na backend aproksimaciju
        console.warn('Korisnik odbio lokaciju ili greška:', error.message);
        console.log('→ Koristim backend aproksimaciju sa IP adrese...');
        this.useBackendGeoIP();
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  private useBackendGeoIP(): void {
    console.log('🌍 Pozivam backend /api/geoip za aproksimaciju...');
    this.videoService.getUserLocationFromIP().subscribe({
      next: (response) => {
        console.log('Backend /api/geoip response:', response);
        if ('error' in response) {
          console.warn('❌ Backend GeoIP greška:', response.error);
          console.warn('Postavljam default lokaciju (Beograd) i osvežavam trending');
          // Postavi default koordinate da trending bude filtriran
          this.selectedLatitude = 44.8176;
          this.selectedLongitude = 20.4633;
          this.placeMarker(this.selectedLatitude, this.selectedLongitude);
          this.updateRadiusCircle();
          if (this.map) {
            this.map.setView([this.selectedLatitude, this.selectedLongitude], 14);
          }
          this.loadTrending();
          this.cdr.markForCheck();
        } else {
          // Uspešno dobili aproksimaciju sa backend-a
          this.selectedLatitude = Number(response.lat.toFixed(6));
          this.selectedLongitude = Number(response.lon.toFixed(6));
          this.placeMarker(this.selectedLatitude, this.selectedLongitude);
          this.updateRadiusCircle();
          if (this.map) {
            this.map.setView([this.selectedLatitude, this.selectedLongitude], 14);
          }
          console.log('✓ Aproksimirana lokacija sa backend-a (IP):', { lat: this.selectedLatitude, lng: this.selectedLongitude });
          this.loadTrending();
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('❌ Backend GeoIP endpoint nedostupan:', err);
        console.warn('Postavljam default lokaciju (Beograd) i osvežavam trending');
        // Postavi default koordinate da trending bude filtriran
        this.selectedLatitude = 44.8176;
        this.selectedLongitude = 20.4633;
        this.placeMarker(this.selectedLatitude, this.selectedLongitude);
        this.updateRadiusCircle();
        if (this.map) {
          this.map.setView([this.selectedLatitude, this.selectedLongitude], 14);
        }
        this.loadTrending();
        this.cdr.markForCheck();
      }
    });
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.map) return;
    if (!this.marker) {
      this.marker = L.marker([lat, lng], { icon: this.getUserLocationIcon() }).addTo(this.map);
    } else {
      this.marker.setLatLng([lat, lng]);
    }
  }

  private getUserLocationIcon(): L.DivIcon {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="34" height="42" viewBox="0 0 34 42">
        <circle cx="17" cy="10" r="5" stroke="#1f3b73" stroke-width="2" fill="#ffffff"/>
        <line x1="17" y1="15" x2="17" y2="28" stroke="#1f3b73" stroke-width="2"/>
        <line x1="10" y1="20" x2="24" y2="20" stroke="#1f3b73" stroke-width="2"/>
        <line x1="17" y1="28" x2="11" y2="36" stroke="#1f3b73" stroke-width="2"/>
        <line x1="17" y1="28" x2="23" y2="36" stroke="#1f3b73" stroke-width="2"/>
        <circle cx="17" cy="10" r="6.5" stroke="#4f8bff" stroke-width="2" fill="none" opacity="0.6"/>
      </svg>
    `;
    const html = `<div style="width:34px;height:42px;">${svg}</div>`;
    return L.divIcon({
      className: 'user-location-marker',
      html,
      iconSize: [34, 42],
      iconAnchor: [17, 36]
    });
  }

  updateRadiusCircle(): void {
    if (!this.map || this.selectedLatitude == null || this.selectedLongitude == null) {
      return;
    }
    if (!this.radiusCircle) {
      this.radiusCircle = L.circle([this.selectedLatitude, this.selectedLongitude], {
        radius: this.radiusMeters,
        color: '#4caf50',
        fillColor: '#4caf50',
        fillOpacity: 0.15
      }).addTo(this.map);
    } else {
      this.radiusCircle.setLatLng([this.selectedLatitude, this.selectedLongitude]);
      this.radiusCircle.setRadius(this.radiusMeters);
    }
  }

  useMyLocationForTrending(): void {
    if (!navigator.geolocation) {
      this.trendingError = 'Geolocation nije podrzan u ovom pregledacu.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.selectedLatitude = Number(pos.coords.latitude.toFixed(6));
        this.selectedLongitude = Number(pos.coords.longitude.toFixed(6));
        this.placeMarker(this.selectedLatitude, this.selectedLongitude);
        this.updateRadiusCircle();
        if (this.map) {
          this.map.setView([this.selectedLatitude, this.selectedLongitude], 14);
        }
        this.cdr.markForCheck();
      },
      () => {
        this.trendingError = 'Neuspesno preuzimanje lokacije.';
        this.cdr.markForCheck();
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  saveTrendingLocation(): void {
    if (this.selectedLatitude == null || this.selectedLongitude == null) {
      this.trendingError = 'Izaberi lokaciju na mapi pre cuvanja.';
      return;
    }
    this.authService.setUserLocation(this.selectedLatitude, this.selectedLongitude);
    this.authService.setUserRadius(this.radiusMeters);
    this.trendingRunMessage = 'Lokacija sacuvana. Osvezavam trending...';
    this.loadTrending();
  }

  clearTrendingLocation(): void {
    this.selectedLatitude = null;
    this.selectedLongitude = null;
    this.authService.clearUserLocation();
    if (this.radiusCircle && this.map) {
      this.map.removeLayer(this.radiusCircle);
      this.radiusCircle = null;
    }
    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    this.trendingRunMessage = 'Lokacija uklonjena. Prikazujem globalni trending.';
    this.loadTrending();
  }

  private renderTrendingMarkers(): void {
    if (!this.map || !this.videoMarkers) return;
    this.videoMarkers.clearLayers();

    const items = Array.isArray(this.trending) ? this.trending : [];
    for (const item of items) {
      const video = item?.video;
      if (!video || typeof video.latitude !== 'number' || typeof video.longitude !== 'number') {
        continue;
      }
      const thumbUrl = this.getThumbnailUrl(video);
      const icon = L.divIcon({
        className: 'video-thumb-marker',
        html: `<div class="video-thumb-marker__pin"><div class="video-thumb-marker__thumb" style="background-image:url('${thumbUrl}')"></div></div>`,
        iconSize: [48, 56],
        iconAnchor: [24, 54]
      });

      const marker = L.marker([video.latitude, video.longitude], { icon });
      marker.bindPopup(`<strong>${video.title || 'Video'}</strong>`);
      marker.addTo(this.videoMarkers);
    }
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



