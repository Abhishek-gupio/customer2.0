import analytics from '@react-native-firebase/analytics';
import AsyncStorage from '@react-native-async-storage/async-storage';

type AnalyticsPrimitive = string | number | boolean | null | undefined;
type AnalyticsParams = Record<string, AnalyticsPrimitive>;

const MAX_EVENT_NAME_LENGTH = 40;
const LOCAL_ANALYTICS_KEY = 'trip_planner_local_analytics_v1';

type LocalAnalyticsStore = {
  eventCounts: Record<string, number>;
  dailyEventCounts: Record<string, Record<string, number>>;
  lastUpdated: number;
};

export type TripPlannerAnalyticsRange = '7d' | '30d' | 'all';

export type TripPlannerLocalAnalytics = {
  range: TripPlannerAnalyticsRange;
  generatedAt: number;
  lastUpdated: number;
  eventCounts: Record<string, number>;
  funnel: {
    calculateStarted: number;
    calculateSuccess: number;
    plannerOpened: number;
    addonsReviewed: number;
    tripsSaved: number;
    calcSuccessRate: number;
    plannerOpenRate: number;
    saveRate: number;
  };
};

let localAnalyticsCache: LocalAnalyticsStore | null = null;
let localAnalyticsQueue: Promise<void> = Promise.resolve();

const sanitizeEventName = (eventName: string) => {
  const trimmed = eventName.trim().toLowerCase();
  const normalized = trimmed
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const withPrefix = /^[a-z]/.test(normalized) ? normalized : `evt_${normalized}`;
  return withPrefix.slice(0, MAX_EVENT_NAME_LENGTH);
};

const sanitizeParams = (params?: AnalyticsParams) => {
  if (!params) return undefined;
  const normalized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'boolean') {
      normalized[key] = value ? 1 : 0;
      continue;
    }
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      normalized[key] = value;
      continue;
    }
    normalized[key] = value.slice(0, 100);
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
};

const getLocalDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getRangeStartDayKey = (range: Exclude<TripPlannerAnalyticsRange, 'all'>) => {
  const days = range === '7d' ? 7 : 30;
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (days - 1));
  return getLocalDayKey(date);
};

const loadLocalStore = async (): Promise<LocalAnalyticsStore> => {
  if (localAnalyticsCache) return localAnalyticsCache;
  try {
    const raw = await AsyncStorage.getItem(LOCAL_ANALYTICS_KEY);
    if (!raw) {
      localAnalyticsCache = { eventCounts: {}, dailyEventCounts: {}, lastUpdated: 0 };
      return localAnalyticsCache;
    }
    const parsed = JSON.parse(raw) as Partial<LocalAnalyticsStore>;
    localAnalyticsCache = {
      eventCounts: parsed.eventCounts || {},
      dailyEventCounts: parsed.dailyEventCounts || {},
      lastUpdated: parsed.lastUpdated || 0,
    };
    return localAnalyticsCache;
  } catch {
    localAnalyticsCache = { eventCounts: {}, dailyEventCounts: {}, lastUpdated: 0 };
    return localAnalyticsCache;
  }
};

const persistLocalStore = async () => {
  if (!localAnalyticsCache) return;
  try {
    await AsyncStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(localAnalyticsCache));
  } catch (error) {
    if (__DEV__) {
      console.warn('[analytics] local persist failed', error);
    }
  }
};

const queueLocalMutation = (mutate: (store: LocalAnalyticsStore) => void) => {
  localAnalyticsQueue = localAnalyticsQueue
    .then(async () => {
      const store = await loadLocalStore();
      mutate(store);
      store.lastUpdated = Date.now();
      await persistLocalStore();
    })
    .catch((error) => {
      if (__DEV__) {
        console.warn('[analytics] local mutation failed', error);
      }
    });
  return localAnalyticsQueue;
};

const incrementLocalTripEvent = (eventName: string) => {
  if (!eventName.startsWith('trip_')) return;
  const dayKey = getLocalDayKey(new Date());
  void queueLocalMutation((store) => {
    store.eventCounts[eventName] = (store.eventCounts[eventName] || 0) + 1;
    if (!store.dailyEventCounts[dayKey]) {
      store.dailyEventCounts[dayKey] = {};
    }
    store.dailyEventCounts[dayKey][eventName] = (store.dailyEventCounts[dayKey][eventName] || 0) + 1;
  });
};

const toPercent = (numerator: number, denominator: number) => {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
};

const aggregateCountsForRange = (
  store: LocalAnalyticsStore,
  range: TripPlannerAnalyticsRange,
) => {
  if (range === 'all') return store.eventCounts || {};
  const minDayKey = getRangeStartDayKey(range);
  const merged: Record<string, number> = {};
  for (const [dayKey, dayCounts] of Object.entries(store.dailyEventCounts || {})) {
    if (dayKey < minDayKey) continue;
    for (const [eventName, count] of Object.entries(dayCounts || {})) {
      merged[eventName] = (merged[eventName] || 0) + count;
    }
  }
  return merged;
};

const buildTripPlannerSnapshot = (
  store: LocalAnalyticsStore,
  range: TripPlannerAnalyticsRange,
): TripPlannerLocalAnalytics => {
  const counts = aggregateCountsForRange(store, range);
  const calculateStarted = counts.trip_calc_start || 0;
  const calculateSuccess = counts.trip_calc_success || 0;
  const plannerOpened = counts.trip_planner_open || 0;
  const addonsReviewed = counts.trip_explorer_continue || 0;
  const tripsSaved = counts.trip_planner_save || 0;

  return {
    range,
    generatedAt: Date.now(),
    lastUpdated: store.lastUpdated || 0,
    eventCounts: counts,
    funnel: {
      calculateStarted,
      calculateSuccess,
      plannerOpened,
      addonsReviewed,
      tripsSaved,
      calcSuccessRate: toPercent(calculateSuccess, calculateStarted),
      plannerOpenRate: toPercent(plannerOpened, calculateSuccess),
      saveRate: toPercent(tripsSaved, plannerOpened),
    },
  };
};

const safeLogEvent = async (eventName: string, params?: AnalyticsParams) => {
  const normalizedEvent = sanitizeEventName(eventName);
  incrementLocalTripEvent(normalizedEvent);
  try {
    await analytics().logEvent(normalizedEvent, sanitizeParams(params));
  } catch (error) {
    if (__DEV__) {
      console.warn('[analytics] logEvent failed', eventName, error);
    }
  }
};

const safeLogScreenView = async (screenName: string, screenClass?: string) => {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  } catch (error) {
    if (__DEV__) {
      console.warn('[analytics] logScreenView failed', screenName, error);
    }
  }
};

const safeSetUserId = async (userId?: string) => {
  try {
    await analytics().setUserId(userId || null);
  } catch (error) {
    if (__DEV__) {
      console.warn('[analytics] setUserId failed', error);
    }
  }
};

const safeSetUserProperty = async (name: string, value: string | null) => {
  try {
    await analytics().setUserProperty(name, value);
  } catch (error) {
    if (__DEV__) {
      console.warn('[analytics] setUserProperty failed', name, error);
    }
  }
};

export const analyticsService = {
  trackEvent: safeLogEvent,
  trackScreenView: safeLogScreenView,
  setUserId: safeSetUserId,
  setUserProperty: safeSetUserProperty,
  getTripPlannerLocalAnalytics: async (
    range: TripPlannerAnalyticsRange = 'all',
  ): Promise<TripPlannerLocalAnalytics> => {
    await localAnalyticsQueue;
    const store = await loadLocalStore();
    return buildTripPlannerSnapshot(store, range);
  },
  resetTripPlannerLocalAnalytics: async () => {
    localAnalyticsCache = { eventCounts: {}, dailyEventCounts: {}, lastUpdated: Date.now() };
    await AsyncStorage.setItem(LOCAL_ANALYTICS_KEY, JSON.stringify(localAnalyticsCache));
  },
};

export const tripPlannerAnalytics = {
  calculationStarted: (params: AnalyticsParams) => safeLogEvent('trip_calc_start', params),
  calculationSucceeded: (params: AnalyticsParams) => safeLogEvent('trip_calc_success', params),
  calculationFailed: (params: AnalyticsParams) => safeLogEvent('trip_calc_fail', params),
  routeChanged: (params: AnalyticsParams) => safeLogEvent('trip_route_change', params),
  trafficRefresh: (params: AnalyticsParams) => safeLogEvent('trip_traffic_refresh', params),
  trafficRefreshFailed: (params: AnalyticsParams) => safeLogEvent('trip_traffic_refresh_fail', params),
  trafficToggle: (params: AnalyticsParams) => safeLogEvent('trip_traffic_toggle', params),
  navigationStarted: (params: AnalyticsParams) => safeLogEvent('trip_nav_start', params),
  plannerOpened: (params: AnalyticsParams) => safeLogEvent('trip_planner_open', params),
  plannerStepViewed: (params: AnalyticsParams) => safeLogEvent('trip_planner_step_view', params),
  plannerStepChanged: (params: AnalyticsParams) => safeLogEvent('trip_planner_step_change', params),
  plannerExited: (params: AnalyticsParams) => safeLogEvent('trip_planner_exit', params),
  plannerSaved: (params: AnalyticsParams) => safeLogEvent('trip_planner_save', params),
  plannerSaveFailed: (params: AnalyticsParams) => safeLogEvent('trip_planner_save_fail', params),
  insightsOpened: (params: AnalyticsParams) => safeLogEvent('trip_planner_insights_open', params),
  historyOpened: (params: AnalyticsParams) => safeLogEvent('trip_history_open', params),
  historySelected: (params: AnalyticsParams) => safeLogEvent('trip_history_select', params),
  explorerTabChanged: (params: AnalyticsParams) => safeLogEvent('trip_explorer_tab', params),
  explorerFinished: (params: AnalyticsParams) => safeLogEvent('trip_explorer_continue', params),
  hotelSelected: (params: AnalyticsParams) => safeLogEvent('trip_hotel_select', params),
  activityToggled: (params: AnalyticsParams) => safeLogEvent('trip_activity_toggle', params),
  transportSelected: (params: AnalyticsParams) => safeLogEvent('trip_transport_select', params),
  amenitySearchStarted: (params: AnalyticsParams) => safeLogEvent('trip_amenity_search', params),
  amenitySearchResults: (params: AnalyticsParams) => safeLogEvent('trip_amenity_results', params),
  amenitySearchFailed: (params: AnalyticsParams) => safeLogEvent('trip_amenity_search_fail', params),
  fullMapOpened: (params: AnalyticsParams) => safeLogEvent('trip_full_map_open', params),
  fullMapClosed: (params: AnalyticsParams) => safeLogEvent('trip_full_map_close', params),
  breakdownToggled: (params: AnalyticsParams) => safeLogEvent('trip_breakdown_toggle', params),
};
