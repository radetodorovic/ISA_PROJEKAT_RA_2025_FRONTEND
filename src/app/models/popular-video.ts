import { VideoPost } from './video-post';

export interface PopularVideo {
  video: VideoPost;
  score: number;
  rank: number;
  runAt: string;
}
