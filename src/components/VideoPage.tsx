import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api, { Comment, Video } from '../api';
import { useAuth } from '../contexts/AuthContext';
import CommentList from './CommentList';
import CommentForm from './CommentForm';

const VideoPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const videoId = useMemo(() => Number(id), [id]);
  const { isAuthenticated } = useAuth();

  const [video, setVideo] = useState<Video | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    // Fetch video, comments, and likes count in parallel
    Promise.all([
      api.get<Video>(`/api/videos/${videoId}`),
      api.get<Comment[]>(`/api/videos/${videoId}/comments`),
      api
        .get<number>(`/api/videos/${videoId}/likes`)
        .then((r) => ({ data: r.data }))
        .catch(() => ({ data: undefined as unknown as number })),
    ])
      .then(([vRes, cRes, lRes]) => {
        if (!active) return;
        const v = vRes.data;
        setVideo(v);
        setComments(cRes.data);
        // If separate likes endpoint provided use it; else fallback to video.likesCount
        setLikes(typeof lRes.data === 'number' ? lRes.data : v.likesCount || 0);
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Failed to load video');
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [videoId]);

  const toggleLike = useCallback(async () => {
    if (!isAuthenticated) return;
    // Optimistic update
    setLiked((prev) => !prev);
    setLikes((prev) => prev + (liked ? -1 : 1));
    try {
      if (!liked) {
        await api.post(`/api/videos/${videoId}/likes`);
      } else {
        // Try DELETE to unlike; if not supported, try POST toggle pattern
        try {
          await api.delete(`/api/videos/${videoId}/likes`);
        } catch {
          await api.post(`/api/videos/${videoId}/likes`);
        }
      }
    } catch {
      // Revert optimistic update on failure
      setLiked((prev) => !prev);
      setLikes((prev) => prev + (liked ? 1 : -1));
    }
  }, [isAuthenticated, liked, videoId]);

  const addComment = (c: Comment) => setComments((prev) => [c, ...prev]);

  if (loading) return <div className="container">Loading video…</div>;
  if (error) return <div className="container error">{error}</div>;
  if (!video) return <div className="container">Video not found.</div>;

  return (
    <div className="container">
      <div className="video-wrapper">
        <video className="video-player" controls src={video.videoUrl} />
      </div>
      <h1 className="video-title">{video.title}</h1>
      {video.description && <p className="video-desc">{video.description}</p>}

      <div className="row gap">
        <button onClick={toggleLike} disabled={!isAuthenticated}>
          {liked ? 'Unlike' : 'Like'} • {likes}
        </button>
        {!isAuthenticated && <span className="muted">Login to like</span>}
      </div>

      <h2>Comments</h2>
      <CommentForm videoId={videoId} onAdd={addComment} />
      <CommentList comments={comments} />
    </div>
  );
};

export default VideoPage;
