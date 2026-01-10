import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { VideoService } from '../../services/video.service';
import { VideoPost } from '../../models/video-post';

@Component({
  selector: 'app-video-player',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './video-player.component.html',
  styleUrl: './video-player.component.css'
})
export class VideoPlayerComponent implements OnInit, OnDestroy {
  video: VideoPost | null = null;
  streamUrl: string = '';
  loading: boolean = true;
  error: string = '';
  private viewRefreshTimeout: any;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private videoService: VideoService
  ) {}

  ngOnInit(): void {
    const videoId = Number(this.route.snapshot.paramMap.get('id'));
    if (videoId) {
      this.loadVideo(videoId);
    } else {
      this.error = 'Invalid video ID';
      this.loading = false;
    }
  }

  ngOnDestroy(): void {
    if (this.viewRefreshTimeout) {
      clearTimeout(this.viewRefreshTimeout);
    }
  }

  loadVideo(id: number): void {
    this.loading = true;
    this.videoService.getVideoById(id).subscribe({
      next: (video) => {
        this.video = video;
        // Extract filename from videoUrl
        if (video.videoUrl) {
          const filename = video.videoUrl.split('/').pop();
          if (filename) {
            this.streamUrl = this.videoService.getStreamUrl(filename);
          }
        }
        this.loading = false;
        
        // Refresh view count after video starts playing (2 seconds delay)
        this.scheduleViewRefresh(id);
      },
      error: (err) => {
        console.error('Error loading video:', err);
        this.error = 'Failed to load video. Please try again.';
        this.loading = false;
      }
    });
  }

  private scheduleViewRefresh(videoId: number): void {
    // Refresh view count after 2 seconds (when backend has incremented it)
    this.viewRefreshTimeout = setTimeout(() => {
      this.videoService.getVideoById(videoId).subscribe({
        next: (video) => {
          if (this.video) {
            this.video.viewCount = video.viewCount;
            console.log('View count refreshed:', video.viewCount);
          }
        },
        error: (err) => console.error('Error refreshing view count:', err)
      });
    }, 2000);
  }

  onVideoPlay(): void {
    console.log('Video started playing - view count will be incremented automatically by backend');
  }

  goBack(): void {
    this.router.navigate(['/videos']);
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}
