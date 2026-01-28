export interface TrendingVideo {
  id: number;
  title: string;
  trendingScore: number;
  distanceKm?: number | null;
  thumbnailPath?: string;
  videoPath?: string;
  description?: string;
  author?: string;
  uploadedAt?: string;
}
