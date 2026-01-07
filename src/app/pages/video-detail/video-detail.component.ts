import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { VideoPost } from '../../models/video-post';
import { environment } from '../../config/environment';
import { finalize } from 'rxjs/operators';

interface Comment {
  id: number;
  author: string;
  text: string;
  createdAt: string;
  userId?: number;
}

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './video-detail.component.html',
  styleUrl: './video-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetailComponent implements OnInit {
  video: VideoPost | null = null;
  comments: Comment[] = [];
  liked: boolean = false;
  
  loading: boolean = true;
  error: string = '';
  commentsLoading: boolean = false;
  commentText: string = '';
  submitCommentLoading: boolean = false;
  
  videoUrl: string = ''; // Blob URL za video
  
  private apiBaseUrl = environment.apiBaseUrl;
  private videoId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.videoId = Number(params['id']);
      if (this.videoId) {
        this.loadVideoDetails();
        this.loadComments();
      }
    });
  }

  loadVideoDetails(): void {
    this.loading = true;
    console.log('[VideoDetail] Loading video', this.videoId);
    this.videoService
      .getAllVideos()
      .pipe(
        finalize(() => {
          this.loading = false;
          this.cdr.markForCheck();
        })
      )
      .subscribe({
        next: (videos: any) => {
          // Pronađi video sa tim ID-om
          const list = Array.isArray(videos) ? videos : (videos?.content || []);
          this.video = list.find((v: any) => v.id === this.videoId) || null;
          console.log('[VideoDetail] Video loaded:', this.video);
          if (!this.video) {
            this.error = 'Video not found';
          } else {
            // Fetch video kao Blob sa Authorization header-om
            this.loadVideoBlob();
          }
        },
        error: (err) => {
          console.error('Error loading video:', err);
          this.error = 'Failed to load video details';
        }
      });
  }

  loadComments(): void {
    this.commentsLoading = true;
    console.log('[VideoDetail] Loading comments for video', this.videoId);
    this.videoService.getComments(this.videoId).subscribe({
      next: (comments) => {
        console.log('[VideoDetail] Comments loaded:', comments);
        // Mapiraj userId u author ako backend ne vraća author polje
        this.comments = Array.isArray(comments) ? comments.map((c: any) => ({
          id: c.id,
          author: c.author || (c.userId ? `User ${c.userId}` : 'Anonymous'),
          text: c.text,
          createdAt: c.createdAt,
          userId: c.userId
        })) : [];
        this.commentsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[VideoDetail] Error loading comments:', err);
        // Ako endpoint ne postoji, samo prikaži praznu listu
        this.comments = [];
        this.commentsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleLike(): void {
    if (!this.isAuthenticated()) {
      alert('Morate biti prijavljeni da biste lajkovali objave. Prijavite se ili registrujte.');
      this.error = 'Please login to like videos';
      this.cdr.markForCheck();
      return;
    }

    // Optimistički update
    const previousLiked = this.liked;
    const previousCount = this.video?.likeCount || 0;
    
    this.liked = !this.liked;
    if (this.video) {
      this.video.likeCount = previousCount + (this.liked ? 1 : -1);
    }
    this.cdr.markForCheck();

    console.log('[VideoDetail] Toggled like, liked =', this.liked);
    
    // Pozovi API sa fallback-om
    const apiCall = this.liked 
      ? this.videoService.likeVideo(this.videoId)
      : this.videoService.unlikeVideo(this.videoId);

    apiCall.subscribe({
      next: (response) => {
        console.log('[VideoDetail] Like action succeeded:', response);
        // Ako backend vraća likes count, ažuriraj
        if (response?.likesCount !== undefined && this.video) {
          this.video.likeCount = response.likesCount;
          this.cdr.markForCheck();
        }
      },
      error: (err) => {
        console.error('[VideoDetail] Like action failed:', err);
        console.error('Error status:', err?.status, 'message:', err?.error?.message || err?.message);
        // Ako je 404, endpoint nije dostupan - prikaži bolju poruku
        if (err?.status === 404) {
          this.error = 'Like feature is not available on this server';
        } else if (err?.status === 401) {
          this.error = 'Please login again to like';
        } else {
          this.error = 'Failed to like video: ' + (err?.error?.message || err?.message || 'Unknown error');
        }
        // Vrati na prethodno stanje
        this.liked = previousLiked;
        if (this.video) {
          this.video.likeCount = previousCount;
        }
        this.cdr.markForCheck();
      }
    });
  }

  submitComment(): void {
    if (!this.isAuthenticated()) {
      alert('Morate biti prijavljeni da biste komentarisali. Prijavite se ili registrujte.');
      this.error = 'Please login to comment';
      this.cdr.markForCheck();
      return;
    }

    if (!this.commentText.trim()) {
      return;
    }

    this.submitCommentLoading = true;
    console.log('[VideoDetail] Submitting comment:', this.commentText);

    this.videoService.postComment(this.videoId, this.commentText).subscribe({
      next: (response) => {
        console.log('[VideoDetail] Comment posted:', response);
        // Backend vraća { id, text, userId, videoPostId, createdAt }
        const newComment: Comment = {
          id: response.id || Math.random(),
          author: response.userId ? `User ${response.userId}` : 'You',
          text: response.text || this.commentText,
          createdAt: response.createdAt || new Date().toISOString(),
          userId: response.userId
        };
        this.comments.unshift(newComment);
        this.commentText = '';
        this.submitCommentLoading = false;
        this.error = ''; // Obriši prethodnu grešku
        this.cdr.markForCheck();
        console.log('[VideoDetail] Comment added, total:', this.comments.length);
      },
      error: (err) => {
        console.error('[VideoDetail] Error posting comment:', err);
        console.error('Error status:', err?.status, 'message:', err?.error?.message || err?.message);
        this.submitCommentLoading = false;
        // Ako je 404, endpoint nije dostupan - prikaži bolju poruku
        if (err?.status === 404) {
          this.error = 'Comments feature is not available on this server';
        } else if (err?.status === 401) {
          this.error = 'Please login again to comment';
        } else {
          this.error = 'Failed to post comment: ' + (err?.error?.message || err?.message || 'Unknown error');
        }
        this.cdr.markForCheck();
      }
    });
  }

  isAuthenticated(): boolean {
    return !!this.authService.getToken();
  }

  getVideoUrl(): string {
    return this.videoUrl; // Vraća Blob URL
  }

  loadVideoBlob(): void {
    if (!this.video) return;
    const url = (this.video as any).videoUrl || (this.video as any).videoUrl1 || '';
    if (!url) return;

    const fullUrl = `${this.apiBaseUrl}${url}`;
    console.log('[VideoDetail] Fetching video blob from:', fullUrl);

    // Koristi HttpClient sa interceptor-om (automatski dodaje Authorization header)
    this.http.get(fullUrl, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        console.log('[VideoDetail] Blob received, size:', blob.size, 'type:', blob.type);
        this.videoUrl = URL.createObjectURL(blob);
        this.cdr.markForCheck();
        console.log('[VideoDetail] Video blob URL created:', this.videoUrl);
      },
      error: (err: HttpErrorResponse) => {
        console.error('[VideoDetail] Error loading video blob:', err);
        this.error = 'Failed to load video';
      }
    });
  }

  getThumbnailUrl(): string {
    if (!this.video) return '';
    return `${this.apiBaseUrl}${this.video.thumbnailUrl || ''}`;
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
  }
}
