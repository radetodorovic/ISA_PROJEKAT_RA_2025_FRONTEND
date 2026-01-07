import React from 'react';
import type { Comment } from '../api';

type Props = { comments: Comment[] };

const CommentList: React.FC<Props> = ({ comments }) => {
  if (!comments.length) return <div>No comments yet.</div>;
  return (
    <ul className="comments">
      {comments.map((c) => (
        <li key={c.id} className="comment">
          <div className="comment-meta">
            <strong>{c.author}</strong>
            <span> • {new Date(c.createdAt).toLocaleString()}</span>
          </div>
          <div>{c.text}</div>
        </li>
      ))}
    </ul>
  );
};

export default CommentList;
