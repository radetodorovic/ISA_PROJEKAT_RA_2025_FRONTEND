export interface VideoPost {
  id?: number;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  videoSize?: number;
  uploadedAt?: string;
  createdAt?: string; // Backwards compatibility
  location?: string;
  user?: {
    id: number;
    username: string;
  };
  userId?: number; // Backwards compatibility
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
