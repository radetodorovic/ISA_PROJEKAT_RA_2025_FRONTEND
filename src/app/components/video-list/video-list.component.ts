import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { finalize } from 'rxjs/operators';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './video-list.component.html',
  styleUrl: './video-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoListComponent implements OnInit {
  videos: VideoPost[] = [];
  loading: boolean = true;
  error: string = '';
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(
    private videoService: VideoService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Učitaj videe odmah
    this.loadVideos();
    
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

  getThumbnailUrl(video: VideoPost): string {
    return `${this.apiBaseUrl}${video.thumbnailUrl}`;
  }

  getVideoUrl(video: VideoPost): string {
    const url = (video as any).videoUrl || (video as any).videoUrl1 || '';
    return url ? `${this.apiBaseUrl}${url}` : '#';
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatFileSize(bytes: number): string {
    return this.videoService.formatFileSize(bytes);
  }
}
