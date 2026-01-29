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
  latitude?: number;
  longitude?: number;
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
  latitude?: number;
  longitude?: number;
}
