export interface VideoPost {
  id?: number;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  videoSize?: number;
  createdAt?: string;
  uploadedAt?: string;
  location?: string;
  // Optional geo coordinates (backend may return latitude/longitude or lat/lon)
  latitude?: number;
  longitude?: number;
  lat?: number;
  lon?: number;
  userId?: number;
  user?: {
    id: number;
    username: string;
  };
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export interface VideoUploadRequest {
  title: string;
  description: string;
  tags: string[];
  thumbnail: File;
  video: File;
  location?: string;
}
