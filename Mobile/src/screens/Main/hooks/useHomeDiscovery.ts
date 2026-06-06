import { useCallback, useState } from 'react';
import { api } from '../../../services/api';
import { sortCarNewsLatestFirst } from '../utils/youtubeHelpers';

export function useHomeDiscovery() {
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [trendingNews, setTrendingNews] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const fetchDiscoveryContent = useCallback(async () => {
    try {
      setDiscoveryLoading(true);
      const res = await api.get<{
        success?: boolean;
        data?: { news?: unknown; videos?: unknown };
      }>(`/v1/discovery/trending?refresh=1&t=${Date.now()}`);
      const body = res as { data?: { news?: unknown; videos?: unknown } };
      const inner = body?.data ?? (res as { news?: unknown; videos?: unknown });
      const newsRaw = inner?.news;
      const videosRaw = inner?.videos;
      setTrendingNews(
        sortCarNewsLatestFirst(Array.isArray(newsRaw) ? newsRaw : []),
      );
      setTrendingVideos(Array.isArray(videosRaw) ? videosRaw : []);
    } catch (error) {
      console.error('Error fetching discovery content:', error);
      setTrendingNews([]);
      setTrendingVideos([]);
    } finally {
      setDiscoveryLoading(false);
    }
  }, []);

  return {
    trendingVideos,
    trendingNews,
    discoveryLoading,
    fetchDiscoveryContent,
  };
}
