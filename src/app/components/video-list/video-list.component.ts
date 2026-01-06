import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';

@Component({
  selector: 'app-video-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './video-list.component.html',
  styleUrl: './video-list.component.css',
})
export class VideoListComponent implements OnInit {
  videos: VideoPost[] = [];
  loading: boolean = true;
  error: string = '';
  private apiBaseUrl = environment.apiBaseUrl;

  constructor(private videoService: VideoService) {}

  ngOnInit(): void {
    this.loadVideos();
  }

  loadVideos(): void {
    this.loading = true;
    this.videoService.getAllVideos().subscribe({
      next: (videos) => {
        this.videos = videos;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading videos:', err);
        this.error = 'Failed to load videos. Please try again later.';
        this.loading = false;
      }
    });
  }

  getThumbnailUrl(video: VideoPost): string {
    return `${this.apiBaseUrl}${video.thumbnailUrl}`;
  }

  getVideoUrl(video: VideoPost): string {
    return `${this.apiBaseUrl}${video.videoUrl}`;
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
