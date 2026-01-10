import React, { useEffect, useState } from 'react';
import api, { Video } from '../api';
import VideoCard from './VideoCard';

const VideoList: React.FC = () => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<Video[]>('/api/videos')
      .then((res) => {
        if (!active) return;
        setVideos(res.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Failed to load videos');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  if (loading) return <div className="container">Loading videos…</div>;
  if (error) return <div className="container error">{error}</div>;

  return (
    <div className="container">
      <div className="grid">
        {videos.map((v) => (
          <VideoCard key={v.id} video={v} />
        ))}
      </div>
    </div>
  );
};

export default VideoList;
