import React, { useState } from 'react';
import api, { Comment } from '../api';
import { useAuth } from '../contexts/AuthContext';

type Props = {
  videoId: number;
  onAdd: (comment: Comment) => void;
};

const CommentForm: React.FC<Props> = ({ videoId, onAdd }) => {
  const { isAuthenticated } = useAuth();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <div className="muted">Login to post a comment.</div>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<Comment>(`/api/videos/${videoId}/comments`, { text });
      onAdd(res.data);
      setText('');
    } catch (err: any) {
      setError(err?.message || 'Failed to post comment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="comment-form">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment…"
        rows={3}
      />
      <div className="row">
        <button type="submit" disabled={loading}>
          {loading ? 'Posting…' : 'Post Comment'}
        </button>
        {error && <span className="error small">{error}</span>}
      </div>
    </form>
  );
};

export default CommentForm;
