import type { TrendingVideo } from '../types/TrendingVideo';

export type TrendingQuery = {
  lat?: number;
  lon?: number;
  radius?: number;
  limit?: number;
  page?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

const DEFAULT_RADIUS_KM = 10;
const DEFAULT_LIMIT = 12;
const DEFAULT_TIMEOUT_MS = 8000;
const ENDPOINT = '/api/videos/trending';

const buildUrl = (params: TrendingQuery): string => {
  const { lat, lon, radius, limit, page } = params;
  const search = new URLSearchParams();
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    search.set('lat', String(lat));
    search.set('lon', String(lon));
  }
  if (radius != null) search.set('radius', String(radius));
  if (limit != null) search.set('limit', String(limit));
  if (page != null) search.set('page', String(page));
  const query = search.toString();
  return query ? `${ENDPOINT}?${query}` : ENDPOINT;
};

export const getTrending = async (params: TrendingQuery = {}): Promise<TrendingVideo[]> => {
  const mergedParams: TrendingQuery = {
    radius: DEFAULT_RADIUS_KM,
    limit: DEFAULT_LIMIT,
    page: 0,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    ...params,
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => {
    controller.abort(new DOMException('Request timed out', 'TimeoutError'));
  }, mergedParams.timeoutMs);

  if (mergedParams.signal) {
    const outer = mergedParams.signal;
    if (outer.aborted) {
      controller.abort(outer.reason);
    } else {
      outer.addEventListener('abort', () => controller.abort(outer.reason), { once: true });
    }
  }

  const url = buildUrl(mergedParams);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`Trending request failed (${res.status})`);
    }
    const data = (await res.json()) as TrendingVideo[];
    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Network error');
  } finally {
    window.clearTimeout(timeoutId);
  }
};
