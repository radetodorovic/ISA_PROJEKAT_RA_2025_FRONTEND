import React from 'react';
import type { TrendingVideo } from '../types/TrendingVideo';

type Props = {
  video: TrendingVideo;
};

const distanceLabel = (distanceKm?: number | null): string => {
  if (distanceKm == null || Number.isNaN(distanceKm)) return 'Distance unavailable';
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(1)} km`;
};

const TrendingCard: React.FC<Props> = ({ video }) => {
  const thumb =
    video.thumbnailPath ||
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180" fill="none"><rect width="320" height="180" fill="%23e5e7eb"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%23666" font-size="16">No thumbnail</text></svg>';

  const score = Number.isFinite(video.trendingScore)
    ? Math.round(video.trendingScore)
    : 0;

  return (
    <article className="trending-card" aria-label={`Trending video ${video.title}`}>
      <div className="trending-thumb-wrap">
        <img src={thumb} alt={video.title} className="trending-thumb" loading="lazy" />
        <span className="trending-score" aria-label={`Trending score ${score}`}>
          Score {score}
        </span>
      </div>
      <div className="trending-body">
        <h4 className="trending-title">{video.title}</h4>
        <p className="trending-meta">{distanceLabel(video.distanceKm)}</p>
      </div>
    </article>
  );
};

export default TrendingCard;
