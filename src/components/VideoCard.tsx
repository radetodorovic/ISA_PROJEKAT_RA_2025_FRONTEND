import React from 'react';
import { Link } from 'react-router-dom';
import type { Video } from '../api';

type Props = { video: Video };

const VideoCard: React.FC<Props> = ({ video }) => {
  return (
    <div className="card">
      <Link to={`/videos/${video.id}`} className="card-link">
        <img src={video.thumbnailUrl} alt={video.title} className="card-thumb" />
        <div className="card-body">
          <h3 className="card-title">{video.title}</h3>
        </div>
      </Link>
    </div>
  );
};

export default VideoCard;
