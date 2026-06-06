import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Linking,
  RefreshControl,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import { api } from '../../services/api';
import BackButton from '../../components/BackButton';
import { getDIYGuidesCache, setDIYGuidesCache } from '../../services/storage';
import LoadingSpinner from '../../components/LoadingSpinner';
import { vehicleService } from '../../services/vehicleService';

const GUIDE_CATEGORIES = ['MAINTENANCE', 'REPAIR', 'CLEANING', 'ESSENTIALS'] as const;
type GuideCategory = (typeof GUIDE_CATEGORIES)[number];
const CATEGORY_TARGET_COUNT = 6;

interface DIYVehicleContext {
  id?: string;
  make?: string;
  model?: string;
  vehicleType?: string;
  isPrimary?: boolean;
}

interface DIYGuideSeed {
  title: string;
  description: string;
  duration: string;
  category: GuideCategory;
  searchQuery: string;
}

interface DIYGuide {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  category: GuideCategory;
  searchQuery?: string;
}

const GENERIC_FALLBACK_GUIDES: DIYGuideSeed[] = [
  {
    title: 'Engine Oil Change Basics',
    description: 'Step-by-step engine oil replacement for first-time DIY owners.',
    duration: '7:10',
    category: 'MAINTENANCE',
    searchQuery: 'car engine oil change diy tutorial',
  },
  {
    title: 'Air Filter Replacement Guide',
    description: 'Improve airflow and mileage with a simple air filter swap.',
    duration: '4:50',
    category: 'MAINTENANCE',
    searchQuery: 'car air filter replacement tutorial',
  },
  {
    title: 'Cabin Filter Change Tutorial',
    description: 'Keep your cabin air fresh with an easy filter change.',
    duration: '4:20',
    category: 'MAINTENANCE',
    searchQuery: 'car cabin filter change tutorial',
  },
  {
    title: 'Spark Plug Inspection Basics',
    description: 'Check spark plugs and spot early signs of engine trouble.',
    duration: '5:40',
    category: 'MAINTENANCE',
    searchQuery: 'car spark plug inspection tutorial',
  },
  {
    title: 'Brake Fluid Flush Guide',
    description: 'Brake fluid maintenance explained for safer braking.',
    duration: '6:15',
    category: 'MAINTENANCE',
    searchQuery: 'car brake fluid flush tutorial',
  },
  {
    title: 'Transmission Fluid Check',
    description: 'A beginner-friendly guide to checking transmission fluid.',
    duration: '5:35',
    category: 'MAINTENANCE',
    searchQuery: 'car transmission fluid check tutorial',
  },
  {
    title: 'Brake Pad Replacement',
    description: 'Replace worn brake pads before they damage the rotor.',
    duration: '7:00',
    category: 'REPAIR',
    searchQuery: 'car brake pad replacement tutorial',
  },
  {
    title: 'Battery Replacement Guide',
    description: 'Swap a weak battery and get back on the road fast.',
    duration: '5:05',
    category: 'REPAIR',
    searchQuery: 'car battery replacement tutorial',
  },
  {
    title: 'Coolant Leak Troubleshooting',
    description: 'How to inspect hoses and spot common coolant leaks.',
    duration: '6:00',
    category: 'REPAIR',
    searchQuery: 'car coolant leak check tutorial',
  },
  {
    title: 'Headlight Bulb Replacement',
    description: 'A simple headlight replacement guide for better night visibility.',
    duration: '4:45',
    category: 'REPAIR',
    searchQuery: 'car headlight bulb replacement tutorial',
  },
  {
    title: 'Fuse Replacement Basics',
    description: 'Find and replace blown fuses safely in your car.',
    duration: '4:25',
    category: 'REPAIR',
    searchQuery: 'car fuse replacement tutorial',
  },
  {
    title: 'Wiper Motor Fix Guide',
    description: 'Troubleshoot and fix common wiper motor issues.',
    duration: '6:10',
    category: 'REPAIR',
    searchQuery: 'car wiper motor fix tutorial',
  },
  {
    title: 'Understanding Your Dashboard Lights',
    description: 'A complete guide to what every warning light on your dashboard means.',
    duration: '8:15',
    category: 'ESSENTIALS',
    searchQuery: 'car dashboard lights meaning',
  },
  {
    title: 'How to Jump-start a Car Safely',
    description: 'Emergency guide on how to jump-start your vehicle without damaging the electronics.',
    duration: '4:45',
    category: 'ESSENTIALS',
    searchQuery: 'how to jump start a car safely',
  },
  {
    title: 'Basic Car Tool Kit Essentials',
    description: 'The 10 tools every car owner should keep in their boot.',
    duration: '6:20',
    category: 'ESSENTIALS',
    searchQuery: 'car tool kit essentials',
  },
  {
    title: 'How to Check Tyre Pressure',
    description: 'A quick guide to checking tyre pressure for safer daily driving.',
    duration: '4:30',
    category: 'ESSENTIALS',
    searchQuery: 'how to check tyre pressure car',
  },
  {
    title: 'Wiper Blade Replacement Guide',
    description: 'Replace worn-out wipers before the next rain drive.',
    duration: '5:05',
    category: 'ESSENTIALS',
    searchQuery: 'car wiper blade replacement tutorial',
  },
  {
    title: 'Coolant Top-up Basics',
    description: 'Learn when and how to top up coolant without damaging the engine.',
    duration: '5:10',
    category: 'ESSENTIALS',
    searchQuery: 'car coolant top up tutorial',
  },
  {
    title: 'Interior Deep Cleaning',
    description: 'A proper step-by-step car interior deep-clean process.',
    duration: '6:30',
    category: 'CLEANING',
    searchQuery: 'car interior deep cleaning tutorial',
  },
  {
    title: 'Exterior Foam Wash Guide',
    description: 'Wash your car safely without scratching the paint.',
    duration: '5:25',
    category: 'CLEANING',
    searchQuery: 'car exterior foam wash tutorial',
  },
  {
    title: 'Alloy Wheel Cleaning Basics',
    description: 'Clean brake dust and restore shine to your wheels.',
    duration: '4:55',
    category: 'CLEANING',
    searchQuery: 'alloy wheel cleaning tutorial car',
  },
  {
    title: 'Windshield Glass Care',
    description: 'Improve visibility with proper windshield cleaning and care.',
    duration: '4:15',
    category: 'CLEANING',
    searchQuery: 'car windshield glass care tutorial',
  },
  {
    title: 'Seat Upholstery Cleaning',
    description: 'Remove stains and refresh your seats at home.',
    duration: '5:45',
    category: 'CLEANING',
    searchQuery: 'car seat upholstery cleaning tutorial',
  },
  {
    title: 'Engine Bay Cleaning',
    description: 'Clean the engine bay carefully without harming electronics.',
    duration: '5:10',
    category: 'CLEANING',
    searchQuery: 'car engine bay cleaning tutorial',
  },
];

const CAR_GUIDE_TOPICS = [
  { name: 'Engine Oil Change', category: 'MAINTENANCE' as const, duration: '5:30' },
  { name: 'Air Filter Replacement', category: 'MAINTENANCE' as const, duration: '4:40' },
  { name: 'Cabin Filter Change', category: 'MAINTENANCE' as const, duration: '4:20' },
  { name: 'Spark Plug Inspection', category: 'MAINTENANCE' as const, duration: '5:40' },
  { name: 'Brake Fluid Flush', category: 'MAINTENANCE' as const, duration: '6:15' },
  { name: 'Transmission Fluid Check', category: 'MAINTENANCE' as const, duration: '5:35' },
  { name: 'Brake Pad Replacement', category: 'REPAIR' as const, duration: '7:05' },
  { name: 'Battery Replacement', category: 'REPAIR' as const, duration: '5:15' },
  { name: 'Coolant Leak Check', category: 'REPAIR' as const, duration: '6:00' },
  { name: 'Headlight Bulb Replacement', category: 'REPAIR' as const, duration: '4:45' },
  { name: 'Fuse Replacement', category: 'REPAIR' as const, duration: '4:25' },
  { name: 'Wiper Motor Fix', category: 'REPAIR' as const, duration: '6:10' },
  { name: 'Coolant Top-up', category: 'ESSENTIALS' as const, duration: '3:50' },
  { name: 'Wiper Blade Replacement', category: 'ESSENTIALS' as const, duration: '5:05' },
  { name: 'Tyre Pressure Inspection', category: 'ESSENTIALS' as const, duration: '4:30' },
  { name: 'Dashboard Warning Lights Guide', category: 'ESSENTIALS' as const, duration: '8:15' },
  { name: 'Jump Start A Car Safely', category: 'ESSENTIALS' as const, duration: '4:45' },
  { name: 'Car Tool Kit Essentials', category: 'ESSENTIALS' as const, duration: '6:20' },
  { name: 'Interior Deep Cleaning', category: 'CLEANING' as const, duration: '6:05' },
  { name: 'Exterior Foam Wash', category: 'CLEANING' as const, duration: '5:25' },
  { name: 'Alloy Wheel Cleaning', category: 'CLEANING' as const, duration: '4:55' },
  { name: 'Windshield Glass Care', category: 'CLEANING' as const, duration: '4:15' },
  { name: 'Seat Upholstery Cleaning', category: 'CLEANING' as const, duration: '5:45' },
  { name: 'Engine Bay Cleaning', category: 'CLEANING' as const, duration: '6:05' },
];

const BIKE_GUIDE_TOPICS = [
  { name: 'Engine Oil Change', category: 'MAINTENANCE' as const, duration: '5:20' },
  { name: 'Chain Cleaning and Lubing', category: 'MAINTENANCE' as const, duration: '4:30' },
  { name: 'Air Filter Cleaning', category: 'MAINTENANCE' as const, duration: '4:40' },
  { name: 'Spark Plug Service', category: 'MAINTENANCE' as const, duration: '4:50' },
  { name: 'Brake Fluid Check', category: 'MAINTENANCE' as const, duration: '5:15' },
  { name: 'Clutch Cable Adjustment', category: 'MAINTENANCE' as const, duration: '4:35' },
  { name: 'Spark Plug Check', category: 'REPAIR' as const, duration: '4:10' },
  { name: 'Brake Pad Replacement', category: 'REPAIR' as const, duration: '6:10' },
  { name: 'Battery Maintenance', category: 'REPAIR' as const, duration: '5:05' },
  { name: 'Puncture Repair', category: 'REPAIR' as const, duration: '5:35' },
  { name: 'Headlight Bulb Replacement', category: 'REPAIR' as const, duration: '4:20' },
  { name: 'Fuse Box Troubleshooting', category: 'REPAIR' as const, duration: '4:30' },
  { name: 'Tyre Pressure Inspection', category: 'ESSENTIALS' as const, duration: '3:15' },
  { name: 'Chain Slack Inspection', category: 'ESSENTIALS' as const, duration: '3:40' },
  { name: 'Pre-Ride Safety Check', category: 'ESSENTIALS' as const, duration: '5:00' },
  { name: 'Bike Tool Kit Essentials', category: 'ESSENTIALS' as const, duration: '4:50' },
  { name: 'Motorcycle Jump Start Guide', category: 'ESSENTIALS' as const, duration: '4:35' },
  { name: 'Dashboard Warning Light Guide', category: 'ESSENTIALS' as const, duration: '5:20' },
  { name: 'Body Polish', category: 'CLEANING' as const, duration: '5:00' },
  { name: 'Foam Wash Technique', category: 'CLEANING' as const, duration: '5:15' },
  { name: 'Alloy Wheel Cleaning', category: 'CLEANING' as const, duration: '4:40' },
  { name: 'Windshield And Visor Cleaning', category: 'CLEANING' as const, duration: '4:10' },
  { name: 'Seat Care And Cleaning', category: 'CLEANING' as const, duration: '4:30' },
  { name: 'Chrome Parts Polishing', category: 'CLEANING' as const, duration: '4:45' },
];

function isGuideCategory(value: unknown): value is GuideCategory {
  return typeof value === 'string' && GUIDE_CATEGORIES.includes(value as GuideCategory);
}

function extractYouTubeSearchQuery(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').replace(/^m\./, '');
    if (hostname !== 'youtube.com' && hostname !== 'www.youtube.com') return null;
    if (parsedUrl.pathname !== '/results') return null;
    return parsedUrl.searchParams.get('search_query');
  } catch {
    return null;
  }
}

function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function isYouTubeThumbnailUrl(url: string): boolean {
  return /(?:img\.youtube\.com|i\.ytimg\.com)\//i.test(url);
}

function getVehicleLabel(vehicle?: DIYVehicleContext | null): string {
  return [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim();
}

function sanitizeGuideTopic(title: string): string {
  return title.includes(':') ? title.split(':').slice(-1)[0].trim() : title.trim();
}

function buildGuideSearchCandidates(guide: DIYGuide): string[] {
  const topic = sanitizeGuideTopic(guide.title);
  const baseQuery = guide.searchQuery?.trim() || extractYouTubeSearchQuery(guide.videoUrl) || topic;
  const genericByCategory: Record<GuideCategory, string[]> = {
    MAINTENANCE: [
      'car maintenance diy tutorial',
      'bike maintenance diy tutorial',
      'vehicle service tips tutorial',
    ],
    REPAIR: [
      'car repair diy tutorial',
      'motorcycle repair diy tutorial',
      'vehicle troubleshooting tutorial',
    ],
    CLEANING: [
      'car detailing diy tutorial',
      'bike cleaning diy tutorial',
      'vehicle cleaning tutorial',
    ],
    ESSENTIALS: [
      'car owner tips tutorial',
      'bike owner essentials tutorial',
      'vehicle care essentials tutorial',
    ],
  };

  return Array.from(
    new Set(
      [
        baseQuery,
        `${baseQuery} diy tutorial`,
        `${baseQuery} how to`,
        `${baseQuery} full guide`,
        `${topic} diy tutorial`,
        `${topic} how to`,
        `${topic} trending tutorial`,
        ...genericByCategory[guide.category],
      ]
        .map(query => query.trim())
        .filter(Boolean),
    ),
  );
}

function normalizeGuide(rawGuide: unknown, index: number): DIYGuide | null {
  if (!rawGuide || typeof rawGuide !== 'object') return null;

  const guide = rawGuide as Partial<DIYGuide> & Record<string, unknown>;
  const rawCategory = typeof guide.category === 'string' ? guide.category.trim().toUpperCase() : '';
  const category: GuideCategory = isGuideCategory(rawCategory) ? rawCategory : 'ESSENTIALS';
  const title = typeof guide.title === 'string' && guide.title.trim()
    ? guide.title.trim()
    : `DIY Guide ${index + 1}`;
  const description = typeof guide.description === 'string' && guide.description.trim()
    ? guide.description.trim()
    : 'Step-by-step DIY support for common vehicle maintenance.';
  const thumbnail = typeof guide.thumbnail === 'string' ? guide.thumbnail.trim() : '';
  const duration = typeof guide.duration === 'string' && guide.duration.trim()
    ? guide.duration.trim()
    : '5:30';
  const fallbackVideoQuery = `${title} ${category.toLowerCase()} diy`.trim();
  const videoUrl = typeof guide.videoUrl === 'string' && guide.videoUrl.trim()
    ? guide.videoUrl.trim()
    : '';
  const searchQuery =
    typeof guide.searchQuery === 'string' && guide.searchQuery.trim()
      ? guide.searchQuery.trim()
      : extractYouTubeSearchQuery(videoUrl) ?? fallbackVideoQuery;

  return {
    id: typeof guide.id === 'string' && guide.id.trim() ? guide.id.trim() : `diy-guide-${index}`,
    title,
    description,
    thumbnail,
    videoUrl,
    duration,
    category,
    searchQuery,
  };
}

function normalizeGuides(rawGuides: unknown): DIYGuide[] {
  if (!Array.isArray(rawGuides)) return [];

  return rawGuides
    .map((guide, index) => normalizeGuide(guide, index))
    .filter((guide): guide is DIYGuide => Boolean(guide));
}

function extractGuides(response: unknown): DIYGuide[] {
  const payload = response as Record<string, unknown> | null;
  const candidates = [
    response,
    payload?.data,
    (payload?.data as Record<string, unknown> | undefined)?.data,
    (payload?.data as Record<string, unknown> | undefined)?.guides,
    payload?.guides,
  ];

  for (const candidate of candidates) {
    const guides = normalizeGuides(candidate);
    if (guides.length > 0) {
      return guides;
    }
  }

  return [];
}

function buildVehicleFallbackGuides(vehicle?: DIYVehicleContext | null): DIYGuide[] {
  if (!vehicle) {
    return GENERIC_FALLBACK_GUIDES.map((guide, index) => ({
      id: `generic-diy-${index}`,
      title: guide.title,
      description: guide.description,
      thumbnail: '',
      videoUrl: '',
      duration: guide.duration,
      category: guide.category,
      searchQuery: guide.searchQuery,
    }));
  }

  const isBike = (vehicle.vehicleType ?? '').toUpperCase().includes('BIKE');
  const vehicleLabel = getVehicleLabel(vehicle);
  const vehicleSearchTag = isBike ? 'motorcycle scooter' : 'car';
  const guideTopics = isBike ? BIKE_GUIDE_TOPICS : CAR_GUIDE_TOPICS;
  const subject = vehicleLabel || (isBike ? 'your bike' : 'your car');

  return guideTopics.map((topic, index) => {
    const searchQuery = [vehicleLabel, topic.name, vehicleSearchTag, 'DIY'].filter(Boolean).join(' ');
    return {
      id: `${vehicle.id ?? 'vehicle'}-diy-${index}`,
      title: vehicleLabel ? `${vehicleLabel}: ${topic.name}` : topic.name,
      description: `Step-by-step guide on how to perform ${topic.name.toLowerCase()} for ${subject}.`,
      thumbnail: '',
      videoUrl: '',
      duration: topic.duration,
      category: topic.category,
      searchQuery,
    };
  });
}

async function getFallbackDIYGuides(): Promise<DIYGuide[]> {
  try {
    const vehicles = await vehicleService.getVehicles();
    const primaryVehicle =
      vehicles.find(vehicle => vehicle.isPrimary) ??
      vehicles.find(vehicle => vehicle.isActive !== false) ??
      vehicles[0];

    return buildVehicleFallbackGuides(primaryVehicle);
  } catch {
    return buildVehicleFallbackGuides(null);
  }
}

function getYouTubeVideoId(url: unknown): string | null {
  if (typeof url !== 'string') return null;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (hostname === 'youtu.be') {
      const shortId = parsedUrl.pathname.split('/').filter(Boolean)[0] ?? '';
      return shortId.length === 11 ? shortId : null;
    }

    const watchId = parsedUrl.searchParams.get('v');
    if (watchId?.length === 11) return watchId;

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const pathPrefixIndex = pathSegments.findIndex((segment) =>
      ['embed', 'shorts', 'v'].includes(segment)
    );

    if (pathPrefixIndex >= 0) {
      const pathId = pathSegments[pathPrefixIndex + 1] ?? '';
      return pathId.length === 11 ? pathId : null;
    }

    const fallbackMatch = trimmedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/
    );
    return fallbackMatch?.[1] ?? null;
  } catch {
    const fallbackMatch = trimmedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/
    );
    return fallbackMatch?.[1] ?? null;
  }
}

function extractYouTubeVideoIds(html: string): string[] {
  const regex = /"videoId":"([A-Za-z0-9_-]{11})"/g;
  const ids = new Set<string>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html)) !== null) {
    ids.add(match[1]);
    if (ids.size >= 8) break;
  }

  return Array.from(ids);
}

async function resolveYouTubePreviewBySearch(searchQuery: string): Promise<{ videoUrl: string; thumbnail: string } | null> {
  const normalizedQuery = searchQuery.trim();
  if (!normalizedQuery) return null;

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(normalizedQuery)}&sp=EgIQAQ%253D%253D`;
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();
    const videoId = extractYouTubeVideoIds(html)[0];
    if (!videoId) return null;

    return {
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: getYouTubeThumbnailUrl(videoId),
    };
  } catch (error) {
    console.warn('Failed to resolve YouTube preview on device:', error);
    return null;
  }
}

async function resolveYouTubePreviewBySearchQueries(searchQueries: string[]): Promise<{ videoUrl: string; thumbnail: string } | null> {
  for (const query of searchQueries) {
    const result = await resolveYouTubePreviewBySearch(query);
    if (result) return result;
  }

  return null;
}

async function ensureGuideHasRealVideoPreview(guide: DIYGuide): Promise<DIYGuide | null> {
  const directVideoId = getYouTubeVideoId(guide.videoUrl);
  if (directVideoId) {
    return {
      ...guide,
      thumbnail: getYouTubeThumbnailUrl(directVideoId),
    };
  }

  const candidateQueries = buildGuideSearchCandidates(guide);
  const resolvedPreview = await resolveYouTubePreviewBySearchQueries(candidateQueries);
  if (!resolvedPreview) {
    return null;
  }

  return {
    ...guide,
    videoUrl: resolvedPreview.videoUrl,
    thumbnail: resolvedPreview.thumbnail,
    searchQuery: candidateQueries[0],
  };
}

async function hydrateGuidesWithRealVideoPreviews(guides: DIYGuide[]): Promise<DIYGuide[]> {
  if (guides.length === 0) return guides;

  const hydratedGuides = await Promise.all(guides.map(guide => ensureGuideHasRealVideoPreview(guide)));
  return hydratedGuides.filter((guide): guide is DIYGuide => guide !== null);
}

async function ensureCategoryGuideCounts(guides: DIYGuide[]): Promise<DIYGuide[]> {
  const result = [...guides];
  const genericFallbacks = buildVehicleFallbackGuides(null);

  for (const category of GUIDE_CATEGORIES) {
    const currentCount = result.filter(guide => guide.category === category).length;
    if (currentCount >= CATEGORY_TARGET_COUNT) continue;

    const missingCount = CATEGORY_TARGET_COUNT - currentCount;
    const supplementCandidates = genericFallbacks.filter(
      guide =>
        guide.category === category &&
        !result.some(
          existing =>
            existing.title.toLowerCase() === guide.title.toLowerCase() ||
            (existing.videoUrl && guide.videoUrl && existing.videoUrl === guide.videoUrl),
        ),
    );

    const hydratedSupplements = await hydrateGuidesWithRealVideoPreviews(supplementCandidates);
    result.push(...hydratedSupplements.slice(0, missingCount));
  }

  return result;
}

function getGuidePreviewSource(guide: DIYGuide) {
  const youtubeId = getYouTubeVideoId(guide.videoUrl);
  if (youtubeId) {
    return { uri: getYouTubeThumbnailUrl(youtubeId) };
  }

  const trimmedThumbnail = typeof guide.thumbnail === 'string' ? guide.thumbnail.trim() : '';
  if (trimmedThumbnail && isYouTubeThumbnailUrl(trimmedThumbnail)) {
    return { uri: trimmedThumbnail };
  }

  return null;
}

export default function DIYGuides() {
  const navigation = useNavigation();
  const [guides, setGuides] = useState<DIYGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchGuides = useCallback(async (isManualRefresh = false) => {
    const cachedGuides = normalizeGuides(getDIYGuidesCache());

    try {
      if (cachedGuides.length > 0 && !isManualRefresh) {
        const hydratedCachedGuides = await hydrateGuidesWithRealVideoPreviews(cachedGuides);
        const completeCachedGuides = await ensureCategoryGuideCounts(hydratedCachedGuides);
        if (completeCachedGuides.length > 0) {
          setGuides(completeCachedGuides);
          setDIYGuidesCache(completeCachedGuides);
          setLoading(false);
        }
      } else if (!isManualRefresh) {
        setLoading(true);
      }

      const response = await api.get<unknown>('/v1/diy/guides');
      const liveGuides = extractGuides(response);

      if (liveGuides.length > 0) {
        const hydratedGuides = await hydrateGuidesWithRealVideoPreviews(liveGuides);
        const completeGuides = await ensureCategoryGuideCounts(hydratedGuides);
        if (completeGuides.length > 0) {
          setGuides(completeGuides);
          setDIYGuidesCache(completeGuides);
          setStatusMessage(null);
          return;
        }
      }

      throw new Error('DIY guides endpoint did not return playable video guides.');
    } catch (error) {
      console.error('Failed to fetch DIY guides:', error);

      const fallbackGuides = await getFallbackDIYGuides();
      if (fallbackGuides.length > 0) {
        const hydratedFallbackGuides = await hydrateGuidesWithRealVideoPreviews(fallbackGuides);
        const completeFallbackGuides = await ensureCategoryGuideCounts(hydratedFallbackGuides);
        if (completeFallbackGuides.length > 0) {
          setGuides(completeFallbackGuides);
          setDIYGuidesCache(completeFallbackGuides);
          setStatusMessage(null);
        }
      } else if (cachedGuides.length > 0) {
        const hydratedCachedGuides = await hydrateGuidesWithRealVideoPreviews(cachedGuides);
        const completeCachedGuides = await ensureCategoryGuideCounts(hydratedCachedGuides);
        if (completeCachedGuides.length > 0) {
          setGuides(completeCachedGuides);
          setStatusMessage(null);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchGuides();
  }, [fetchGuides]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchGuides(true);
  }, [fetchGuides]);

  const filteredGuides = activeCategory === 'ALL' 
    ? guides 
    : guides.filter(g => g.category === activeCategory);

  const categories = ['ALL', 'MAINTENANCE', 'REPAIR', 'ESSENTIALS', 'CLEANING'];

  const handleWatchVideo = (url: string) => {
    if (!getYouTubeVideoId(url)) return;
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <BackButton style={styles.backBtn} onPress={() => navigation.goBack()} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Engine Mastery</Text>
          <Text style={styles.headerSubtitle}>EXPERT MECHANICAL GUIDES</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Master Your Machine</Text>
          <Text style={styles.heroDesc}>Professional tutorials for vehicle maintenance. Performance precision in every step.</Text>
        </View>

        {statusMessage ? (
          <View style={styles.statusBanner}>
            <IconMC name="information-outline" size={wp(4)} color="#D4D4D8" />
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        ) : null}

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>CATEGORIES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.tab,
                  activeCategory === cat && styles.activeTab,
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabText,
                  activeCategory === cat && styles.activeTabText,
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>TUTORIALS</Text>
             <Text style={styles.countBadge}>{filteredGuides.length} GUIDES</Text>
          </View>

          {filteredGuides.map((guide) => (
            <TouchableOpacity 
              key={guide.id} 
              style={styles.guideCard}
              onPress={() => handleWatchVideo(guide.videoUrl)}
              activeOpacity={0.9}
            >
              <View style={styles.thumbnailContainer}>
                {(() => {
                  const previewSource = getGuidePreviewSource(guide);
                  return (
                    <>
                      {previewSource ? (
                        <FastImage
                          source={{
                            ...(previewSource as any),
                            priority: FastImage.priority.high,
                          }}
                          style={styles.cardThumbnail}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      ) : (
                        <View style={styles.previewPlaceholder}>
                          <Text style={styles.previewPlaceholderEyebrow}>TRENDING DIY</Text>
                          <Text style={styles.previewPlaceholderTitle} numberOfLines={2}>
                            {guide.title}
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
                <View style={styles.thumbnailShade} />
                <View style={styles.playOverlay}>
                  <IconMC name="play" size={wp(5)} color="#000" />
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{guide.duration}</Text>
                </View>
              </View>
              
              <View style={styles.cardInfo}>
                 <View style={styles.cardInfoTop}>
                    <View style={styles.categoryBadge}>
                       <Text style={styles.categoryText}>{guide.category}</Text>
                    </View>
                    <IconMC name="youtube" size={wp(3.5)} color="#444" />
                 </View>
                 <Text style={styles.cardTitle} numberOfLines={2}>{guide.title}</Text>
                 <Text style={styles.cardDesc} numberOfLines={2}>{guide.description}</Text>
                 
                 <View style={styles.cardFooter}>
                    <View style={styles.verifiedTag}>
                       <IconMC name="shield-check" size={wp(3.2)} color="#22C55E" />
                       <Text style={styles.verifiedText}>GUPIO VERIFIED</Text>
                    </View>
                    <View style={styles.watchLink}>
                       <Text style={styles.watchLinkText}>WATCH NOW</Text>
                       <IconMC name="arrow-right" size={wp(3)} color="#fff" />
                    </View>
                 </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredGuides.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                 <IconMC name="toolbox-outline" size={wp(10)} color="#1a1a1a" />
              </View>
              <Text style={styles.emptyTitle}>New Guides Incoming</Text>
              <Text style={styles.emptyText}>Our experts are documenting new tutorials. Check back soon.</Text>
            </View>
          )}
        </View>
        
        <View style={styles.disclaimer}>
           <IconMC name="alert-circle-outline" size={wp(3.5)} color="#222" />
           <Text style={styles.disclaimerText}>FOLLOW SAFETY PROTOCOLS. DATA SOURCED FROM OEM MANUALS.</Text>
        </View>
      </ScrollView>
      <LoadingSpinner visible={loading && guides.length === 0} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2),
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  backBtn: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#111' },
  headerTitleContainer: { flex: 1, marginLeft: wp(4) },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff' },
  headerSubtitle: { fontSize: wp(2.5), fontFamily: 'Outfit-Black', color: '#444' },
  content: { flex: 1 },
  heroSection: { paddingHorizontal: wp(6), paddingVertical: hp(4), backgroundColor: '#030303' },
  heroTitle: { color: '#fff', fontSize: wp(7.5), fontFamily: 'Outfit-Black' },
  heroDesc: { color: '#444', fontSize: wp(3.5), fontFamily: 'Outfit-Medium', marginTop: hp(1), lineHeight: wp(5.5) },
  statusBanner: {
    marginHorizontal: wp(5),
    marginTop: hp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1F2937',
    backgroundColor: '#0A0A0A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusText: {
    flex: 1,
    color: '#D4D4D8',
    fontSize: wp(3),
    lineHeight: wp(4.4),
    fontFamily: 'Outfit-Medium',
  },
  
  filterSection: { paddingVertical: hp(2.5) },
  filterLabel: { color: '#222', fontSize: wp(2.8), fontFamily: 'Outfit-Black', marginLeft: wp(6), marginBottom: hp(1.5), letterSpacing: 1 },
  tabsContent: { paddingHorizontal: wp(6), gap: wp(2) },
  tab: { paddingHorizontal: wp(5), paddingVertical: hp(1), borderRadius: 12, backgroundColor: '#050505', borderWidth: 1, borderColor: '#111' },
  activeTab: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { fontSize: wp(3), fontFamily: 'Outfit-Bold', color: '#444' },
  activeTabText: { color: '#000' },

  listSection: { paddingHorizontal: wp(5) },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp(3), paddingHorizontal: wp(1) },
  sectionTitle: { color: '#fff', fontSize: wp(3.2), fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
  countBadge: { color: '#222', fontSize: wp(2.5), fontFamily: 'Outfit-Black' },
  
  guideCard: { backgroundColor: '#050505', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#111', marginBottom: hp(3) },
  thumbnailContainer: {
    height: hp(20),
    width: '100%',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cardThumbnail: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  previewPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#090909',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2.2),
    justifyContent: 'flex-end',
  },
  previewPlaceholderEyebrow: {
    color: '#D4D4D8',
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Black',
    letterSpacing: 1,
  },
  previewPlaceholderTitle: {
    marginTop: hp(0.8),
    color: '#fff',
    fontSize: wp(4.2),
    lineHeight: wp(5.6),
    fontFamily: 'Outfit-Bold',
  },
  thumbnailShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  playOverlay: { position: 'absolute', width: wp(12), height: wp(12), borderRadius: wp(6), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  durationBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  durationText: { color: '#fff', fontSize: wp(2.5), fontFamily: 'Outfit-Bold' },
  
  cardInfo: { padding: wp(5) },
  cardInfoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#111', borderRadius: 6 },
  categoryText: { color: '#fff', fontSize: wp(2.4), fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
  cardTitle: { fontSize: wp(4.5), fontFamily: 'Outfit-Bold', color: '#fff', lineHeight: wp(6) },
  cardDesc: { marginTop: 8, fontSize: wp(3.2), fontFamily: 'Outfit-Regular', color: '#444', lineHeight: wp(5) },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hp(2.5), paddingTop: hp(2), borderTopWidth: 1, borderTopColor: '#111' },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedText: { fontSize: wp(2.4), color: '#22C55E', fontFamily: 'Outfit-Black' },
  watchLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  watchLinkText: { color: '#fff', fontFamily: 'Outfit-Black', fontSize: wp(2.8) },

  emptyState: { alignItems: 'center', marginTop: hp(5), gap: hp(2) },
  emptyIconCircle: { width: wp(20), height: wp(20), borderRadius: wp(10), backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#111' },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5) },
  emptyText: { color: '#444', fontFamily: 'Outfit-Regular', fontSize: wp(3.5), textAlign: 'center', paddingHorizontal: wp(10) },
  
  disclaimer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: hp(6), paddingHorizontal: wp(10) },
  disclaimerText: { fontSize: wp(2.2), color: '#1a1a1a', textAlign: 'center', fontFamily: 'Outfit-Black', letterSpacing: 1 }
});
