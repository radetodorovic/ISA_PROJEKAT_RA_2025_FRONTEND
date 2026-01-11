import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { VideoPost, VideoUploadRequest } from '../models/video-post';
import { Comment, PaginatedComments } from '../models/comment';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private readonly API_URL = 'http://localhost:8080/api/videos';
  private readonly MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
  private readonly UPLOAD_TIMEOUT = 600000; // 10 minuta
  private readonly COMMENTS_CACHE_DURATION = 5 * 60 * 1000; // 5 minuta
  private commentsCache = new Map<number, Map<number, Observable<PaginatedComments>>>();
  private commentsCacheExpiry = new Map<number, number>();

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }

  /**
   * Get all videos
   */
  getAllVideos(): Observable<VideoPost[]> {
    return this.http.get<VideoPost[]>(this.API_URL);
  }

  /**
   * Get single video by ID
   */
  getVideoById(id: number): Observable<VideoPost> {
    const token = this.authService.getToken();
    const headers = token ? new HttpHeaders().set('Authorization', `Bearer ${token}`) : new HttpHeaders();
    return this.http.get<VideoPost>(`${this.API_URL}/${id}`, { headers });
  }

  /**
   * Get stream URL for video
   */
  getStreamUrl(filename: string): string {
    return `${this.API_URL}/stream/${filename}`;
  }

  /**
   * Upload video with progress tracking
   */
  uploadVideo(request: VideoUploadRequest): Observable<HttpEvent<VideoPost>> {
    // Proveri JWT token pre upload-a
    const token = this.authService.getToken();
    if (!token) {
      throw new Error('Morate biti ulogovani da biste postavili video');
    }

    // Validacija
    if (!this.isValidVideoFile(request.video)) {
      throw new Error('Video mora biti MP4 format i maksimalno 200MB');
    }

    if (!this.isValidThumbnailFile(request.thumbnail)) {
      throw new Error('Thumbnail mora biti slika (JPG, PNG, WEBP)');
    }

    // Kreiranje FormData
    const formData = new FormData();
    formData.append('title', request.title);
    formData.append('description', request.description);
    
    // Tags - šalju se kao jedan string odvojen zarezima
    formData.append('tags', request.tags.join(','));
    
    formData.append('thumbnail', request.thumbnail);
    formData.append('video', request.video);
    
    if (request.location) {
      formData.append('location', request.location);
    }

    // NAPOMENA: userId se NE šalje - backend ga uzima iz JWT tokena

    // Headers sa JWT tokenom
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    // HttpRequest sa reportProgress za progress tracking i timeout
    const httpRequest = new HttpRequest(
      'POST',
      `${this.API_URL}/upload`,
      formData,
      {
        headers,
        reportProgress: true
      }
    );

    return this.http.request<VideoPost>(httpRequest);
  }

  /**
   * Validate video file
   */
  isValidVideoFile(file: File): boolean {
    // Provera da li je MP4
    if (file.type !== 'video/mp4') {
      return false;
    }

    // Provera veličine (max 200MB)
    if (file.size > this.MAX_VIDEO_SIZE) {
      return false;
    }

    return true;
  }

  /**
   * Validate thumbnail file
   */
  isValidThumbnailFile(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return validTypes.includes(file.type);
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get comments for a video with pagination and caching
   * @param videoId - The video ID
   * @param page - Page number (0-indexed), default 0
   * @param size - Page size, default 10
   * @returns Observable of paginated comments
   */
  getComments(videoId: number, page: number = 0, size: number = 10): Observable<any> {
    // Proveri da li je cache istekao
    const now = Date.now();
    const expiry = this.commentsCacheExpiry.get(videoId);
    if (expiry && now > expiry) {
      // Cache je istekao, obriši ga
      this.commentsCache.delete(videoId);
      this.commentsCacheExpiry.delete(videoId);
    }

    // Proveri keš za ovu stranicu
    let videoCache = this.commentsCache.get(videoId);
    if (!videoCache) {
      videoCache = new Map();
      this.commentsCache.set(videoId, videoCache);
    }

    // Ako postoji kesirana vrednost za ovu stranicu, vrati je
    if (videoCache.has(page)) {
      console.log(`[VideoService] Returning cached comments for video ${videoId}, page ${page}`);
      return videoCache.get(page) as Observable<PaginatedComments>;
    }

    // Inače, učitaj sa API-ja
    const observable$ = this.http.get<PaginatedComments>(
      `${this.API_URL}/${videoId}/comments?page=${page}&size=${size}`
    ).pipe(
      // Kesiramo resurs za 5 minuta ili dok ne istekne
      tap((comments) => {
        console.log(`[VideoService] Cached comments for video ${videoId}, page ${page}`);
        this.commentsCacheExpiry.set(videoId, now + this.COMMENTS_CACHE_DURATION);
      }),
      // shareReplay čuva rezultat i deli ga svim subscribers-ima bez ponovnog API poziva
      shareReplay(1)
    );

    videoCache.set(page, observable$);
    return observable$;
  }

  /**
   * Get comments without pagination (fallback for backward compatibility)
   * @param videoId - The video ID
   * @returns Observable of comments array
   */
  getCommentsOld(videoId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.API_URL}/${videoId}/comments`);
  }

  /**
   * Post a comment on a video and invalidate cache
   */
  postComment(videoId: number, text: string): Observable<any> {
    const formData = new FormData();
    formData.append('text', text);
    
    return this.http.post(`${this.API_URL}/${videoId}/comments`, formData).pipe(
      tap((response) => {
        // Invalidiraj keš za ovaj video kada se novi komentar postavi
        console.log(`[VideoService] Invalidating comment cache for video ${videoId}`);
        this.commentsCache.delete(videoId);
        this.commentsCacheExpiry.delete(videoId);
      })
    );
  }

  /**
   * Clear comment cache for a video
   */
  clearCommentCache(videoId: number): void {
    this.commentsCache.delete(videoId);
    this.commentsCacheExpiry.delete(videoId);
    console.log(`[VideoService] Cleared comment cache for video ${videoId}`);
  }

  /**
   * Clear all comment cache
   */
  clearAllCommentCache(): void {
    this.commentsCache.clear();
    this.commentsCacheExpiry.clear();
    console.log('[VideoService] Cleared all comment cache');
  }

  /**
   * Like a video
   */
  likeVideo(videoId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${videoId}/like`, {}, { responseType: 'text' });
  }

  /**
   * Unlike a video
   */
  unlikeVideo(videoId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/${videoId}/like`, {}, { responseType: 'text' });
  }
}
