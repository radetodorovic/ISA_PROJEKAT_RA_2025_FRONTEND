import '@testing-library/jest-dom';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TrendingList from './TrendingList';
import { getTrending } from '../services/videoApi';

vi.mock('../services/videoApi', () => ({
  getTrending: vi.fn(),
}));

const mockGetTrending = getTrending as unknown as vi.MockedFunction<typeof getTrending>;

describe('TrendingList', () => {
  const position: GeolocationPosition = {
    coords: {
      latitude: 44.0,
      longitude: 20.0,
      accuracy: 5,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    },
    timestamp: Date.now(),
  };

  beforeEach(() => {
    mockGetTrending.mockResolvedValue([
      {
        id: 1,
        title: 'Test video',
        trendingScore: 12.3,
        distanceKm: 1.2,
        thumbnailPath: '/thumb.jpg',
        videoPath: '/video.mp4',
      },
    ]);

    Object.defineProperty(global.navigator, 'geolocation', {
      value: {
        getCurrentPosition: (success: PositionCallback) => success(position),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('renders loading state then shows results', async () => {
    render(<TrendingList />);

    expect(screen.getByText(/Loading trending videos/i)).toBeInTheDocument();

    const title = await screen.findByText('Test video');
    expect(title).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetTrending).toHaveBeenCalled();
    });
  });
});
