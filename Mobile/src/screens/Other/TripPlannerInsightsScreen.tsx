import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { ArrowLeft, RefreshCw, Route, Sparkles, CheckCircle2, Save } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '../../lib/react-navigation-native';
import {
  analyticsService,
  tripPlannerAnalytics,
  type TripPlannerLocalAnalytics,
  type TripPlannerAnalyticsRange,
} from '../../services/analytics';

const statColor = '#5F9EA0';
const RANGE_OPTIONS: { id: TripPlannerAnalyticsRange; label: string }[] = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: 'all', label: 'ALL' },
];
const RANGE_PREF_KEY = 'trip_planner_insights_range_v1';

const formatTimestamp = (value?: number) => {
  if (!value) return 'No events yet';
  const date = new Date(value);
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getOrderedEvents = (eventCounts: Record<string, number>) => {
  return Object.entries(eventCounts)
    .sort((a, b) => b[1] - a[1])
    .filter(([name]) => name.startsWith('trip_'));
};

export default function TripPlannerInsightsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshot, setSnapshot] = useState<TripPlannerLocalAnalytics | null>(null);
  const [range, setRange] = useState<TripPlannerAnalyticsRange>('7d');
  const [rangeReady, setRangeReady] = useState(false);

  const loadSnapshot = useCallback(async (nextRange: TripPlannerAnalyticsRange, showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setRefreshing(true);
    try {
      const data = await analyticsService.getTripPlannerLocalAnalytics(nextRange);
      setSnapshot(data);
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    analyticsService.trackScreenView('trip_planner_insights_screen');
    tripPlannerAnalytics.insightsOpened({ source: 'insights_screen' });
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(RANGE_PREF_KEY);
        if (!isMounted || !saved) return;
        if (saved === '7d' || saved === '30d' || saved === 'all') {
          setRange(saved);
        }
      } finally {
        if (isMounted) setRangeReady(true);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!rangeReady) return;
    loadSnapshot(range, true);
  }, [loadSnapshot, range, rangeReady]);

  useFocusEffect(
    useCallback(() => {
      if (!rangeReady) return;
      loadSnapshot(range, false);
    }, [loadSnapshot, range, rangeReady]),
  );

  const handleRangeChange = useCallback((nextRange: TripPlannerAnalyticsRange) => {
    setRange(nextRange);
    AsyncStorage.setItem(RANGE_PREF_KEY, nextRange).catch((error) => {
      if (__DEV__) {
        console.warn('Failed to save insights range preference', error);
      }
    });
  }, []);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Reset insights?',
      'This clears local trip planner analytics on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            setRefreshing(true);
            try {
              await analyticsService.resetTripPlannerLocalAnalytics();
            } finally {
              await loadSnapshot(range, false);
            }
          },
        },
      ],
    );
  }, [loadSnapshot, range]);

  const funnel = snapshot?.funnel;
  const eventRows = useMemo(() => getOrderedEvents(snapshot?.eventCounts || {}), [snapshot?.eventCounts]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          accessibilityHint="Returns to trip planner"
        >
          <ArrowLeft size={22} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Trip Planner Insights</Text>
          <Text style={styles.headerSub}>Local funnel metrics from this device session</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => loadSnapshot(range, false)}
          accessibilityRole="button"
          accessibilityLabel="Refresh insights"
          accessibilityHint="Loads latest planner analytics metrics"
          accessibilityState={{ busy: refreshing }}
        >
          <RefreshCw size={18} color={refreshing ? '#5F9EA0' : '#FFF'} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={statColor} />
          <Text style={styles.loadingText}>Preparing analytics snapshot...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.metaText}>Last update: {formatTimestamp(snapshot?.lastUpdated)}</Text>
          <View style={styles.toolbarRow}>
            <View style={styles.rangeRow}>
              {RANGE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[styles.rangeChip, range === option.id && styles.rangeChipActive]}
                  onPress={() => handleRangeChange(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Show ${option.label} analytics`}
                  accessibilityState={{ selected: range === option.id }}
                >
                  <Text style={[styles.rangeChipText, range === option.id && styles.rangeChipTextActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              accessibilityRole="button"
              accessibilityLabel="Reset insights"
              accessibilityHint="Clears local planner analytics counters"
            >
              <Text style={styles.resetBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Route size={16} color={statColor} />
              <Text style={styles.metricLabel}>Calculations</Text>
              <Text style={styles.metricValue}>{funnel?.calculateStarted || 0}</Text>
            </View>
            <View style={styles.metricCard}>
              <CheckCircle2 size={16} color={statColor} />
              <Text style={styles.metricLabel}>Route Success</Text>
              <Text style={styles.metricValue}>{funnel?.calculateSuccess || 0}</Text>
            </View>
            <View style={styles.metricCard}>
              <Sparkles size={16} color={statColor} />
              <Text style={styles.metricLabel}>Planner Opens</Text>
              <Text style={styles.metricValue}>{funnel?.plannerOpened || 0}</Text>
            </View>
            <View style={styles.metricCard}>
              <Save size={16} color={statColor} />
              <Text style={styles.metricLabel}>Trips Saved</Text>
              <Text style={styles.metricValue}>{funnel?.tripsSaved || 0}</Text>
            </View>
          </View>

          <View style={styles.funnelCard}>
            <Text style={styles.sectionTitle}>Funnel Conversion</Text>
            <View style={styles.funnelRow}>
              <Text style={styles.funnelLabel}>Calc success rate</Text>
              <Text style={styles.funnelValue}>{funnel?.calcSuccessRate || 0}%</Text>
            </View>
            <View style={styles.funnelRow}>
              <Text style={styles.funnelLabel}>Planner open rate</Text>
              <Text style={styles.funnelValue}>{funnel?.plannerOpenRate || 0}%</Text>
            </View>
            <View style={styles.funnelRow}>
              <Text style={styles.funnelLabel}>Save rate</Text>
              <Text style={styles.funnelValue}>{funnel?.saveRate || 0}%</Text>
            </View>
          </View>

          <View style={styles.eventsCard}>
            <Text style={styles.sectionTitle}>Top Events</Text>
            {eventRows.length === 0 ? (
              <Text style={styles.emptyText}>No planner events recorded yet on this device.</Text>
            ) : (
              eventRows.map(([name, count]) => (
                <View key={name} style={styles.eventRow}>
                  <Text style={styles.eventName}>{name}</Text>
                  <Text style={styles.eventCount}>{count}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131313',
    borderWidth: 1,
    borderColor: '#252525',
  },
  headerTextWrap: { flex: 1, marginHorizontal: 12 },
  headerTitle: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  headerSub: { color: '#8A8A8A', fontSize: 11, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: '#888', fontSize: 13, marginTop: 10, fontWeight: '600' },
  scrollContent: { padding: 16, paddingBottom: 30 },
  metaText: { color: '#666', fontSize: 11, marginBottom: 12 },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rangeChip: {
    borderWidth: 1,
    borderColor: '#2B2B2B',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#131313',
  },
  rangeChipActive: { borderColor: '#5F9EA0', backgroundColor: 'rgba(95, 158, 160, 0.28)' },
  rangeChipText: { color: '#A8A8A8', fontSize: 11, fontWeight: '800' },
  rangeChipTextActive: { color: '#5F9EA0' },
  resetBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.6)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  resetBtnText: { color: '#FF8A84', fontSize: 11, fontWeight: '800' },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 10 },
  metricCard: {
    width: '48.5%',
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 12,
    gap: 6,
  },
  metricLabel: { color: '#9A9A9A', fontSize: 12, fontWeight: '700' },
  metricValue: { color: statColor, fontSize: 22, fontWeight: '900' },
  funnelCard: {
    marginTop: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
  },
  sectionTitle: { color: '#FFF', fontSize: 14, fontWeight: '800', marginBottom: 10 },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  funnelLabel: { color: '#B0B0B0', fontSize: 12, fontWeight: '600' },
  funnelValue: { color: statColor, fontSize: 13, fontWeight: '800' },
  eventsCard: {
    marginTop: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 14,
    padding: 14,
  },
  emptyText: { color: '#7D7D7D', fontSize: 12, lineHeight: 18 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  eventName: { color: '#C9C9C9', fontSize: 11, fontWeight: '700', flex: 1, marginRight: 10 },
  eventCount: { color: '#FFF', fontSize: 12, fontWeight: '800' },
});
