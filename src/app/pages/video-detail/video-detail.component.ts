import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { VideoService } from '../../services/video.service';
import { AuthService } from '../../services/auth.service';
import { VideoPost } from '../../models/video-post';
import { Comment, PaginatedComments } from '../../models/comment';
import { ChatMessage } from '../../models/chat-message';
import { environment } from '../../config/environment';
import { VideoChatService } from '../../services/video-chat.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './video-detail.component.html',
  styleUrl: './video-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VideoDetailComponent implements OnInit, OnDestroy {
  video: VideoPost | null = null;
  comments: Comment[] = [];
  liked: boolean = false;
  
  loading: boolean = true;
  error: string = '';
  commentsLoading: boolean = false;
  commentText: string = '';
  submitCommentLoading: boolean = false;
  scheduledNotice: string = '';
  private scheduledOffsetSeconds: number | null = null;
  chatMessages: ChatMessage[] = [];
  chatInput: string = '';
  chatStatus: string = 'disconnected';
  private chatUsername: string = 'Guest';
  @ViewChild('chatInputEl') private chatInputEl?: ElementRef<HTMLInputElement>;
  
  // Paginacija
  currentPage: number = 0;
  pageSize: number = 5;
  totalPages: number = 0;
  totalElements: number = 0;
  hasNextPage: boolean = false;
  hasPreviousPage: boolean = false;
  
  // Ograničenje komentara - kontrolisano sa backend-a
  maxCommentsPerHour: number = 60;
  commentsRemainingThisHour: number = 60;
  userCommentTimestamps: number[] = [];
  nextCommentAvailableAt: number = 0;
  rateLimitError: string = ''; // Greška od backend-a
  
  videoUrl: string = ''; // Blob URL za video
  
  private apiBaseUrl = environment.apiBaseUrl;
  private videoId: number = 0;

  constructor(
    private route: ActivatedRoute,
    private videoService: VideoService,
    private authService: AuthService,
    private cdr: ChangeDetectorRef,
    private http: HttpClient,
    private videoChatService: VideoChatService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      this.videoId = Number(params['id']);
      if (this.videoId) {
        this.loadVideoDetails();
        this.loadUserCommentHistory();
      }
    });
  }

  ngOnDestroy(): void {
    this.videoChatService.disconnect();
  }

  loadVideoDetails(): void {
    this.loading = true;
    this.scheduledNotice = '';
    this.scheduledOffsetSeconds = null;
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
            if (this.isScheduledInFuture()) {
              this.scheduledNotice = `Video je zakazan za ${this.formatDate(this.video.scheduledAt as string)}.`;
              this.cdr.markForCheck();
              return;
            }
            // Fetch video kao Blob sa Authorization header-om
            this.loadVideoBlob();
            this.loadComments();
            this.startChat();
          }
        },
        error: (err) => {
          console.error('Error loading video:', err);
          this.error = 'Failed to load video details';
        }
      });
  }

  loadComments(): void {
    if (this.video && this.isScheduledInFuture()) {
      this.comments = [];
      this.commentsLoading = false;
      this.cdr.markForCheck();
      return;
    }
    this.commentsLoading = true;
    console.log('[VideoDetail] Loading comments for video', this.videoId, 'page', this.currentPage);
    
    // Prvo učitaj sve komentare bez paginacije
    this.videoService.getCommentsOld(this.videoId).subscribe({
      next: (response) => {
        console.log('[VideoDetail] Comments loaded:', response);
        
        const allComments = Array.isArray(response) ? response : [];
        
        // Sortiraj od najnovijeg ka najstarijem
        const sortedComments = allComments.sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        // Postavi ukupno elemenata
        this.totalElements = sortedComments.length;
        
        // Izračunaj broj stranica
        this.totalPages = Math.ceil(this.totalElements / this.pageSize);
        
        // Validacija trenutne stranice
        if (this.currentPage >= this.totalPages && this.totalPages > 0) {
          this.currentPage = this.totalPages - 1;
        }
        
        // Uzmi samo komentare za trenutnu stranicu
        const startIndex = this.currentPage * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageComments = sortedComments.slice(startIndex, endIndex);
        
        // Mapiraj u Comment interfejse
        this.comments = pageComments.map((c: any) => ({
          id: c.id,
          author: c.author || (c.userId ? `User ${c.userId}` : 'Anonymous'),
          text: c.text,
          createdAt: c.createdAt,
          userId: c.userId,
          videoPostId: c.videoPostId || this.videoId
        }));
        
        // Postavi paginacijske parametre
        this.hasNextPage = endIndex < this.totalElements;
        this.hasPreviousPage = this.currentPage > 0;
        
        console.log('[VideoDetail] Paginacija:', {
          currentPage: this.currentPage,
          totalPages: this.totalPages,
          totalElements: this.totalElements,
          hasNextPage: this.hasNextPage,
          hasPreviousPage: this.hasPreviousPage
        });
        
        this.commentsLoading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('[VideoDetail] Error loading comments:', err);
        // Ako endpoint ne postoji, samo prikaži praznu listu
        this.comments = [];
        this.totalPages = 0;
        this.totalElements = 0;
        this.commentsLoading = false;
        this.cdr.markForCheck();
      }
    });
  }

  /**
   * Učitaj sledeću stranicu komentara
   */
  loadNextCommentsPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadComments();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Učitaj prethodnu stranicu komentara
   */
  loadPreviousCommentsPage(): void {
    if (this.hasPreviousPage && this.currentPage > 0) {
      this.currentPage--;
      this.loadComments();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  /**
   * Idi na određenu stranicu
   */
  goToCommentsPage(page: number): void {
    if (page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.loadComments();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
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
        
        // Zabelezi vreme postavljanja komentara
        this.recordCommentTimestamp();
        this.updateCommentsRemaining();
        
        // Backend vraća { id, text, userId, videoPostId, createdAt }
        const newComment: Comment = {
          id: response.id || Math.random(),
          author: response.userId ? `User ${response.userId}` : 'You',
          text: response.text || this.commentText,
          createdAt: response.createdAt || new Date().toISOString(),
          userId: response.userId,
          videoPostId: response.videoPostId || this.videoId
        };
        
        // Dodaj novi komentar na početak liste (najnoviji prvi)
        this.comments.unshift(newComment);
        this.commentText = '';
        this.submitCommentLoading = false;
        this.error = ''; // Obriši prethodnu grešku
        this.rateLimitError = ''; // Obriši rate limit grešku
        this.cdr.markForCheck();
        
        // Resetuj na prvu stranicu komentara jer je dodan novi
        this.currentPage = 0;
        
        console.log('[VideoDetail] Comment added, total:', this.comments.length);
      },
      error: (err) => {
        console.error('[VideoDetail] Error posting comment:', err);
        console.error('Error status:', err?.status, 'message:', err?.error?.message || err?.message);
        this.submitCommentLoading = false;
        
        // Proveri da li je greška zbog ograničenja
        if (err?.status === 429) {
          // Too Many Requests - Rate limit dostignut
          this.rateLimitError = err?.error?.message || 'Dostigli ste limit komentara. Pokušajte ponovo kasnije.';
          this.error = this.rateLimitError;
          console.warn('[VideoDetail] Rate limit reached:', this.rateLimitError);
        } else if (err?.status === 404) {
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

  /**
   * Zabelezi vreme postavljanja komentara (samo za frontend prikaz)
   */
  recordCommentTimestamp(): void {
    const now = Date.now();
    this.userCommentTimestamps.push(now);
    
    // Čuva u localStorage za informaciju
    const userId = this.authService.getUserId() || 'anonymous';
    localStorage.setItem(`comment_timestamps_${userId}`, JSON.stringify(this.userCommentTimestamps));
  }

  /**
   * Ažuriraj broj preostalih komentara (samo referenca)
   */
  updateCommentsRemaining(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000); // 60 minuta u milisekundama
    
    // Filtriraj komentare koji su postavljeni u poslednjem satu
    this.userCommentTimestamps = this.userCommentTimestamps.filter(
      (timestamp) => timestamp > oneHourAgo
    );
    
    // Izračunaj preostale komentare (samo informativno - backend je authority)
    this.commentsRemainingThisHour = Math.max(
      0,
      this.maxCommentsPerHour - this.userCommentTimestamps.length
    );
    
    console.log('[VideoDetail] Comments remaining this hour (frontend estimate):', this.commentsRemainingThisHour);
  }

  /**
   * Učitaj istoriju komentara korisnika iz localStorage (samo za prikaz)
   */
  loadUserCommentHistory(): void {
    if (!this.isAuthenticated()) {
      return;
    }
    
    const userId = this.authService.getUserId() || 'anonymous';
    const stored = localStorage.getItem(`comment_timestamps_${userId}`);
    
    if (stored) {
      try {
        this.userCommentTimestamps = JSON.parse(stored);
        this.updateCommentsRemaining();
      } catch (e) {
        console.error('[VideoDetail] Error loading comment history:', e);
        this.userCommentTimestamps = [];
      }
    }
  }

  isAuthenticated(): boolean {
    return !!this.authService.getToken();
  }

  getVideoUrl(): string {
    return this.videoUrl; // Vraća Blob URL
  }

  loadVideoBlob(): void {
    if (!this.video) return;
    if (this.isScheduledInFuture()) {
      return;
    }
    const url = (this.video as any).videoUrl || (this.video as any).videoUrl1 || '';
    if (!url) return;

    const fullUrl = `${this.apiBaseUrl}${url}`;
    console.log('[VideoDetail] Fetching video blob from:', fullUrl);

    // Koristi HttpClient sa interceptor-om (automatski dodaje Authorization header)
    this.http.get(fullUrl, { responseType: 'blob' }).subscribe({
      next: (blob: Blob) => {
        console.log('[VideoDetail] Blob received, size:', blob.size, 'type:', blob.type);
        this.videoUrl = URL.createObjectURL(blob);
        this.scheduledOffsetSeconds = this.getScheduleOffsetSeconds();
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

  startChat(): void {
    const userId = this.authService.getUserId();
    this.chatUsername = userId ? `User ${userId}` : 'Guest';
    this.videoChatService.connect(
      this.videoId,
      this.chatUsername,
      (msg) => {
        this.chatMessages = [...this.chatMessages, msg];
        this.cdr.markForCheck();
      },
      (status) => {
        this.chatStatus = status;
        this.cdr.markForCheck();
      }
    );
    // Ensure the chat input is focusable even if user has trouble clicking.
    setTimeout(() => this.chatInputEl?.nativeElement.focus(), 0);
  }

  sendChatMessage(): void {
    if (!this.chatInput.trim()) return;
    this.videoChatService.sendMessage(this.videoId, this.chatUsername, this.chatInput);
    this.chatInput = '';
  }

  // Fallback: manually update chat input if key events are blocked.
  onChatKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.sendChatMessage();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Backspace') {
      event.preventDefault();
      this.chatInput = this.chatInput.slice(0, -1);
      this.cdr.markForCheck();
      return;
    }
    if (event.key.length === 1) {
      event.preventDefault();
      this.chatInput += event.key;
      this.cdr.markForCheck();
    }
  }

  onVideoMetadata(event: Event): void {
    const videoEl = event.target as HTMLVideoElement;
    if (!videoEl || this.scheduledOffsetSeconds === null) {
      return;
    }
    const duration = videoEl.duration || 0;
    const offset = Math.max(0, this.scheduledOffsetSeconds);
    if (duration > 0) {
      videoEl.currentTime = Math.min(duration - 0.1, offset);
    }
  }

  private getScheduledAtMs(): number | null {
    if (!this.video?.scheduledAt) return null;
    const ms = new Date(this.video.scheduledAt).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private getScheduleOffsetSeconds(): number | null {
    const scheduledAtMs = this.getScheduledAtMs();
    if (scheduledAtMs === null) return null;
    const diffMs = Date.now() - scheduledAtMs;
    return Math.max(0, Math.floor(diffMs / 1000));
  }

  isScheduledInFuture(): boolean {
    const scheduledAtMs = this.getScheduledAtMs();
    return scheduledAtMs !== null && Date.now() < scheduledAtMs;
  }
}
