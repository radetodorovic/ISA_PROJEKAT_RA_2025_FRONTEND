import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getTrending } from '../services/videoApi';
import type { TrendingVideo } from '../types/TrendingVideo';
import TrendingCard from './TrendingCard';

type LocationPhase = 'pending' | 'granted' | 'denied' | 'unavailable';

type CacheEntry = { data: TrendingVideo[]; timestamp: number };

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const AUTO_REFRESH_MS = 5 * 60 * 1000; // 5 minutes

const TrendingList: React.FC = () => {
  const [videos, setVideos] = useState<TrendingVideo[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState<number>(10);
  const [limit, setLimit] = useState<number>(8);
  const [page, setPage] = useState<number>(0);
  const [locationPhase, setLocationPhase] = useState<LocationPhase>('pending');
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const coordsRef = useRef<typeof coords>(null);
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    coordsRef.current = coords;
  }, [coords]);

  const fetchTrending = useCallback(
    async (
      options: {
        force?: boolean;
        overrideCoords?: { lat: number; lon: number } | null;
        overridePage?: number;
        overrideRadius?: number;
        overrideLimit?: number;
      } = {}
    ) => {
      const force = options.force ?? false;
      const activeCoords =
        options.overrideCoords !== undefined ? options.overrideCoords : coordsRef.current;
      const nextPage = options.overridePage ?? page;
      const nextRadius = options.overrideRadius ?? radius;
      const nextLimit = options.overrideLimit ?? limit;

      const cacheKey = JSON.stringify({
        lat: activeCoords?.lat,
        lon: activeCoords?.lon,
        radius: nextRadius,
        limit: nextLimit,
        page: nextPage,
      });

      const now = Date.now();
      const cached = cacheRef.current.get(cacheKey);
      if (!force && cached && now - cached.timestamp < CACHE_TTL_MS) {
        setVideos(cached.data);
        setError(null);
        setLoading(false);
        setLastUpdated(cached.timestamp);
        return;
      }

      inFlight.current?.abort();
      const controller = new AbortController();
      inFlight.current = controller;

      setLoading(true);
      setError(null);

      try {
        const data = await getTrending({
          lat: activeCoords?.lat,
          lon: activeCoords?.lon,
          radius: nextRadius,
          limit: nextLimit,
          page: nextPage,
          signal: controller.signal,
        });
        const fetchedAt = Date.now();
        cacheRef.current.set(cacheKey, { data, timestamp: fetchedAt });
        setVideos(data);
        setLastUpdated(fetchedAt);
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : 'Failed to load trending videos';
        setError(message);
        setVideos([]);
      } finally {
        if (inFlight.current === controller) {
          inFlight.current = null;
        }
        setLoading(false);
      }
    },
    [limit, page, radius]
  );

  useEffect(() => {
    let cancelled = false;

    if (!navigator.geolocation) {
      coordsRef.current = null;
      setCoords(null);
      setLocationPhase('unavailable');
      return () => {
        cancelled = true;
        inFlight.current?.abort();
      };
    }

    setLocationPhase('pending');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const next = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        coordsRef.current = next;
        setCoords(next);
        setLocationPhase('granted');
      },
      () => {
        if (cancelled) return;
        coordsRef.current = null;
        setCoords(null);
        setLocationPhase('denied');
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    return () => {
      cancelled = true;
      inFlight.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (locationPhase === 'pending') return;
    fetchTrending();
  }, [fetchTrending, locationPhase]);

  useEffect(() => {
    if (locationPhase === 'pending') return;
    const id = window.setInterval(() => fetchTrending({ force: true }), AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchTrending, locationPhase]);

  const locationMessage = (() => {
    if (locationPhase === 'pending') return 'We use your approximate location to show nearby trending videos.';
    if (locationPhase === 'granted') return 'Showing trends near you.';
    if (locationPhase === 'denied') return 'Location was denied; showing global trends.';
    return 'Location unavailable; showing global trends.';
  })();

  const handleRadiusChange = (value: number) => {
    setPage(0);
    setRadius(Math.max(1, value));
  };

  const handleLimitChange = (value: number) => {
    setPage(0);
    setLimit(Math.max(1, value));
  };

  const handleRefresh = () => fetchTrending({ force: true });

  return (
    <section className="trending-section" aria-live="polite">
      <div className="trending-header">
        <div>
          <p className="trending-overline">Local trending videos</p>
          <h2 className="trending-heading">Trending near you</h2>
          <p className="muted small" role="note">
            {locationMessage}
          </p>
        </div>
        <div className="trending-controls" aria-label="Trending filters">
          <label className="control">
            <span>Radius (km)</span>
            <input
              type="number"
              min={1}
              max={200}
              value={radius}
              onChange={(e) => handleRadiusChange(Number(e.target.value))}
              aria-label="Select search radius"
            />
          </label>
          <label className="control">
            <span>Limit</span>
            <select
              value={limit}
              onChange={(e) => handleLimitChange(Number(e.target.value))}
              aria-label="Items per page"
            >
              {[6, 8, 12, 16, 24].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="control actions">
            <button onClick={handleRefresh} disabled={loading} aria-label="Refresh trending list">
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="muted" role="status" aria-live="assertive">
          Loading trending videos…
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {!loading && !error && videos.length === 0 && (
        <div className="muted" role="status">
          No trending videos in the selected radius.
        </div>
      )}

      <div className="trending-grid" aria-busy={loading} aria-label="Trending video list">
        {videos.map((video) => (
          <TrendingCard key={video.id} video={video} />
        ))}
      </div>

      <div className="trending-footer">
        <div className="muted small">
          {lastUpdated ? `Updated at ${new Date(lastUpdated).toLocaleTimeString()}` : 'Not updated yet'}
        </div>
        <div className="pagination">
          <button
            onClick={() => {
              const nextPage = Math.max(0, page - 1);
              setPage(nextPage);
              fetchTrending({ overridePage: nextPage });
            }}
            disabled={page === 0 || loading}
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="muted">Page {page + 1}</span>
          <button
            onClick={() => {
              const nextPage = page + 1;
              setPage(nextPage);
              fetchTrending({ overridePage: nextPage });
            }}
            disabled={loading || videos.length < limit}
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default TrendingList;
