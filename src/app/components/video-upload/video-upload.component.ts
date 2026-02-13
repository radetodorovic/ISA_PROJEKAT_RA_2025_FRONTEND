import { Component, OnInit, AfterViewInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { VideoPost, VideoUploadRequest } from '../../models/video-post';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

@Component({
  selector: 'app-video-upload',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-upload.component.html',
  styleUrl: './video-upload.component.css',
})
export class VideoUploadComponent implements OnInit, AfterViewInit, OnDestroy {
  // Form polja
  title: string = '';
  description: string = '';
  tagsInput: string = '';
  tags: string[] = [];
  location: string = '';
  videoLatitude: number | null = null;
  videoLongitude: number | null = null;
  scheduledAtInput: string = '';
  availableTranscodeProfiles = [
    { id: '360p', label: '360p (640x360)' },
    { id: '720p', label: '720p (1280x720)' },
    { id: '1080p', label: '1080p (1920x1080)' }
  ];
  selectedTranscodeProfiles: string[] = ['360p', '720p'];
  
  // Fajlovi
  thumbnailFile: File | null = null;
  videoFile: File | null = null;
  thumbnailPreview: string | null = null;
  
  // Upload state
  isUploading: boolean = false;
  uploadProgress: number = 0;
  uploadComplete: boolean = false;
  uploadedVideo: VideoPost | null = null;
  uploadStartTime: number = 0;
  uploadTimeoutWarning: boolean = false;
  progressInterval: any = null;
  
  // Validacija i errori
  errors: { [key: string]: string } = {};
  generalError: string = '';
  
  constructor(
    private videoService: VideoService,
    private authService: AuthService,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  private uploadMarkerIcon: L.Icon | null = null;
  
  ngOnInit(): void {
    // Proveri da li je korisnik ulogovan
    if (!this.authService.getToken()) {
      this.generalError = 'Morate biti ulogovani da biste postavili video';
    }
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    const container = document.getElementById('upload-map');
    if (!container) return;

    this.uploadMarkerIcon = L.icon({
      iconUrl: this.getClassicPinIconUrl(),
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -36]
    });

    this.map = L.map(container).setView([44.8176, 20.4633], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.map.on('click', (e: L.LeafletMouseEvent) => {
      this.setVideoLocation(e.latlng.lat, e.latlng.lng);
    });
  }

  setVideoLocation(lat: number, lng: number): void {
    this.videoLatitude = Number(lat.toFixed(6));
    this.videoLongitude = Number(lng.toFixed(6));

    if (this.map) {
      if (!this.marker) {
        this.marker = L.marker([this.videoLatitude, this.videoLongitude], {
          icon: this.uploadMarkerIcon || undefined
        }).addTo(this.map);
      } else {
        this.marker.setLatLng([this.videoLatitude, this.videoLongitude]);
      }
    }

    if (!this.location.trim()) {
      this.location = `${this.videoLatitude}, ${this.videoLongitude}`;
    }
  }

  private getClassicPinIconUrl(): string {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">
        <path d="M15 0C8.1 0 2.5 5.6 2.5 12.5C2.5 22 15 42 15 42C15 42 27.5 22 27.5 12.5C27.5 5.6 21.9 0 15 0Z" fill="#e53935"/>
        <circle cx="15" cy="12.5" r="5.5" fill="#ffffff"/>
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
  }

  useMyLocationForVideo(): void {
    if (!navigator.geolocation) {
      this.generalError = 'Geolocation nije podrÅ¾an u ovom pregledaÄu.';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.setVideoLocation(pos.coords.latitude, pos.coords.longitude);
        if (this.map) {
          this.map.setView([this.videoLatitude || pos.coords.latitude, this.videoLongitude || pos.coords.longitude], 14);
        }
      },
      () => {
        this.generalError = 'NeuspeÅ¡no preuzimanje lokacije.';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }
  
  /**
   * Handle thumbnail file selection
   */
  onThumbnailSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      if (!this.videoService.isValidThumbnailFile(file)) {
        this.errors['thumbnail'] = 'Thumbnail must be an image (JPG, PNG, WEBP)';
        this.thumbnailFile = null;
        this.thumbnailPreview = null;
        return;
      }
      
      this.thumbnailFile = file;
      this.errors['thumbnail'] = '';
      
      // Kreiraj preview
      const reader = new FileReader();
      reader.onload = (e) => {
        this.thumbnailPreview = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  }
  
  /**
   * Handle video file selection
   */
  onVideoSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      if (!this.videoService.isValidVideoFile(file)) {
        this.errors['video'] = 'Video must be MP4 format and maximum 200MB';
        this.videoFile = null;
        return;
      }
      
      this.videoFile = file;
      this.errors['video'] = '';
    }
  }
  
  /**
   * Dodaj tag iz input polja
   */
  addTag(): void {
    const tag = this.tagsInput.trim();
    if (tag && !this.tags.includes(tag)) {
      this.tags.push(tag);
      this.tagsInput = '';
      this.errors['tags'] = '';
    }
  }
  
  /**
   * Ukloni tag
   */
  removeTag(tag: string): void {
    this.tags = this.tags.filter(t => t !== tag);
  }

  onTranscodeProfileToggle(profileId: string, checked: boolean): void {
    if (checked && !this.selectedTranscodeProfiles.includes(profileId)) {
      this.selectedTranscodeProfiles = [...this.selectedTranscodeProfiles, profileId];
      return;
    }
    if (!checked) {
      this.selectedTranscodeProfiles = this.selectedTranscodeProfiles.filter(p => p !== profileId);
    }
  }

  getTranscodeSummary(): string {
    if (!this.selectedTranscodeProfiles || this.selectedTranscodeProfiles.length === 0) {
      return 'default profiles';
    }
    return this.selectedTranscodeProfiles.join(', ');
  }
  
  /**
   * Handle Enter key u tag input polju
   */
  onTagInputKeypress(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag();
    }
  }
  
  /**
   * Validacija forme pre upload-a
   */
  validateForm(): boolean {
    this.errors = {};
    let isValid = true;
    
    if (!this.title.trim()) {
      this.errors['title'] = 'Title is required';
      isValid = false;
    }
    
    if (!this.description.trim()) {
      this.errors['description'] = 'Description is required';
      isValid = false;
    }
    
    if (this.tags.length === 0) {
      this.errors['tags'] = 'Add at least one tag';
      isValid = false;
    }
    
    if (!this.thumbnailFile) {
      this.errors['thumbnail'] = 'Thumbnail is required';
      isValid = false;
    }
    
    if (!this.videoFile) {
      this.errors['video'] = 'Video is required';
      isValid = false;
    }
    
    return isValid;
  }
  
  /**
   * Submit forme - upload videa
   */
  onSubmit(): void {
    if (!this.validateForm()) {
      return;
    }

    // Dodatna provera JWT tokena
    if (!this.authService.getToken()) {
      this.generalError = 'Morate biti ulogovani da biste postavili video';
      return;
    }
    
    const uploadRequest: VideoUploadRequest = {
      title: this.title.trim(),
      description: this.description.trim(),
      tags: this.tags,
      thumbnail: this.thumbnailFile!,
      video: this.videoFile!,
      location: this.location.trim() || undefined,
      latitude: this.videoLatitude ?? undefined,
      longitude: this.videoLongitude ?? undefined,
      transcodeProfiles: this.selectedTranscodeProfiles,
      scheduledAt: this.scheduledAtInput ? this.scheduledAtInput : undefined
    };
    
    this.isUploading = true;
    this.uploadProgress = 5;
    this.generalError = '';
    this.uploadTimeoutWarning = false;
    this.uploadStartTime = Date.now();
    this.cdr.detectChanges();
    
    // Simuliraj progress - rekurzivno sa setTimeout
    const updateProgress = () => {
      if (this.isUploading && this.uploadProgress < 95) {
        if (this.uploadProgress < 85) {
          this.uploadProgress += 3;
        } else {
          this.uploadProgress += 1;
        }
        console.log('Progress:', this.uploadProgress);
        this.cdr.detectChanges();
        setTimeout(updateProgress, 400);
      }
    };
    setTimeout(updateProgress, 400);
    
    // Timeout warning posle 5 minuta
    const timeoutWarning = setTimeout(() => {
      if (this.isUploading) {
        this.uploadTimeoutWarning = true;
      }
    }, 300000);
    
    this.videoService.uploadVideo(uploadRequest).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.Response) {
          this.isUploading = false;
          this.uploadProgress = 100;
          this.uploadComplete = true;
          this.uploadedVideo = event.body;
          clearTimeout(timeoutWarning);
          this.cdr.detectChanges();
          console.log('Upload uspešan:', this.uploadedVideo);
          
          setTimeout(() => {
            this.resetForm();
            this.cdr.detectChanges();
          }, 5000);
        }
      },
      error: (error) => {
        this.isUploading = false;
        clearTimeout(timeoutWarning);
        console.error('Upload error:', error);
        
        // Parsiranje greške sa backa
        let errorMessage = 'Došlo je do greške prilikom upload-a. Pokušajte ponovo.';
        
        if (error.status === 401) {
          errorMessage = 'Niste autorizovani. Molimo prijavite se ponovo.';
        } else if (error.status === 400) {
          errorMessage = error.error?.message || 'Neispravni podaci. Proverite formu.';
        } else if (error.status === 500) {
          errorMessage = 'Greška na serveru. Upload je otkazan (rollback izvršen).';
        } else if (error.error?.message) {
          errorMessage = error.error.message;
        }
        
        this.generalError = errorMessage;
        this.isUploading = false;
        this.uploadProgress = 0;
        this.uploadTimeoutWarning = false;
      }
    });
  }
  
  /**
   * Reset forme
   */
  resetForm(): void {
    this.title = '';
    this.description = '';
    this.tagsInput = '';
    this.tags = [];
    this.location = '';
    this.videoLatitude = null;
    this.videoLongitude = null;
    this.scheduledAtInput = '';
    this.selectedTranscodeProfiles = ['360p', '720p'];
    this.thumbnailFile = null;
    this.videoFile = null;
    this.thumbnailPreview = null;
    this.isUploading = false;
    this.uploadProgress = 0;
    this.uploadComplete = false;
    this.uploadedVideo = null;
    this.errors = {};
    this.generalError = '';
    this.uploadTimeoutWarning = false;
    this.uploadStartTime = 0;

    if (this.marker && this.map) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
    
    // Reset file inputs
    const thumbnailInput = document.getElementById('thumbnail') as HTMLInputElement;
    const videoInput = document.getElementById('video') as HTMLInputElement;
    if (thumbnailInput) thumbnailInput.value = '';
    if (videoInput) videoInput.value = '';
    
    this.cdr.detectChanges();
  }
  
  /**
   * Format file size za prikaz
   */
  getFileSize(file: File | null): string {
    if (!file) return '';
    return this.videoService.formatFileSize(file.size);
  }
}



