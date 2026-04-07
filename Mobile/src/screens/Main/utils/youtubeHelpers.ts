import { Linking } from 'react-native';

export function sortCarNewsLatestFirst(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const ta =
      typeof a?.publishedAt === 'string'
        ? new Date(a.publishedAt).getTime()
        : 0;
    const tb =
      typeof b?.publishedAt === 'string'
        ? new Date(b.publishedAt).getTime()
        : 0;
    return tb - ta;
  });
}

/** Extract a YouTube video ID from watch, share, shorts, embed, and mobile URLs. */
export const getYouTubeVideoId = (url: unknown): string | null => {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      return null;
    }

    const parsedUrl = new URL(trimmedUrl);
    const hostname = parsedUrl.hostname
      .replace(/^www\./, '')
      .replace(/^m\./, '');

    if (hostname === 'youtu.be') {
      const shortId = parsedUrl.pathname.split('/').filter(Boolean)[0] ?? '';
      return shortId.length === 11 ? shortId : null;
    }

    const watchId = parsedUrl.searchParams.get('v');
    if (watchId?.length === 11) {
      return watchId;
    }

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const pathPrefixIndex = pathSegments.findIndex(segment =>
      ['embed', 'shorts', 'v'].includes(segment),
    );

    if (pathPrefixIndex >= 0) {
      const pathId = pathSegments[pathPrefixIndex + 1] ?? '';
      return pathId.length === 11 ? pathId : null;
    }

    const fallbackMatch = trimmedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/,
    );
    return fallbackMatch?.[1] ?? null;
  } catch {
    const fallbackMatch = url
      .trim()
      .match(
        /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/,
      );
    return fallbackMatch?.[1] ?? null;
  }
};

export const buildYouTubeEmbedUrl = (videoId: string) =>
  `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&controls=1&modestbranding=1&iv_load_policy=3&disablekb=1&enablejsapi=1&fs=0&origin=${encodeURIComponent('https://gupio.in')}&widget_referrer=${encodeURIComponent('https://gupio.in/')}`;

export const openYouTubeExternally = (requestUrl: string, videoId: string) => {
  const fallbackWebUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let externalUrl = fallbackWebUrl;

  try {
    if (
      requestUrl.startsWith('intent://') ||
      requestUrl.startsWith('youtube://') ||
      requestUrl.startsWith('vnd.youtube')
    ) {
      externalUrl = fallbackWebUrl;
    } else {
      const parsedUrl = new URL(requestUrl);
      const redirectTarget =
        parsedUrl.searchParams.get('q') ||
        parsedUrl.searchParams.get('u') ||
        parsedUrl.searchParams.get('url');

      if (redirectTarget) {
        externalUrl = redirectTarget.startsWith('http')
          ? redirectTarget
          : `https://www.youtube.com${redirectTarget.startsWith('/') ? '' : '/'}${redirectTarget}`;
      } else if (parsedUrl.hostname.includes('youtube-nocookie.com')) {
        externalUrl = requestUrl.replace('youtube-nocookie.com', 'youtube.com');
      } else if (
        parsedUrl.hostname.includes('youtube.com') ||
        parsedUrl.hostname.includes('youtu.be')
      ) {
        externalUrl = requestUrl;
      }
    }
  } catch {
    externalUrl = fallbackWebUrl;
  }

  Linking.openURL(`youtube://watch?v=${videoId}`)
    .catch(() => Linking.openURL(externalUrl))
    .catch(() => null);
};
