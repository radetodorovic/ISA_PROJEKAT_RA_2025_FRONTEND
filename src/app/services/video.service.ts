import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';
import { VideoPost, VideoUploadRequest } from '../models/video-post';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class VideoService {
  private readonly API_URL = 'http://localhost:8080/api/videos';
  private readonly MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200MB
  private readonly UPLOAD_TIMEOUT = 600000; // 10 minuta

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
}
