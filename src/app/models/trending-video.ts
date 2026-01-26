import { VideoPost } from './video-post';

export interface TrendingVideo {
  video: VideoPost;
  score: number;
  rank: number;
  location: string;
  runAt: string;
}
