export interface VideoPost {
  id?: number;
  title: string;
  description: string;
  tags: string[];
  thumbnailUrl?: string;
  videoUrl?: string;
  videoSize?: number;
  createdAt?: string;
  location?: string;
  userId: number;
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
  userId: number;
}
