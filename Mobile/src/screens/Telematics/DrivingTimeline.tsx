import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { format } from 'date-fns';
import { telematicsApi } from '../../api/telematics';
import { vehicleService, type Vehicle } from '../../services/vehicleService';
import BackButton from '../../components/BackButton';

type DrivingTrip = {
  id: string;
  startTime: string;
  endTime: string;
  distanceKm: number;
  durationMin: number;
  safetyScore?: number | null;
  maxSpeed?: number | null;
  avgSpeed?: number | null;
  damoovStatistics?: any;
  damoovScores?: any;
  startLocation?: any;
  endLocation?: any;
};

type Props = {
  navigation: any;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function DrivingTimeline({ navigation }: Props) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [allTrips, setAllTrips] = useState<DrivingTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(
    async (opts?: { refreshing?: boolean }) => {
      try {
        if (opts?.refreshing) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);

        const vehicles = await vehicleService.getVehicles();
        const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
        if (!primary) {
          setPrimaryVehicle(null);
          setAllTrips([]);
          return;
        }
        setPrimaryVehicle(primary);

        const tripsRes = await telematicsApi.getTrips(primary.id);
        const tripsArray = Array.isArray(tripsRes?.data?.data)
          ? tripsRes.data.data
          : Array.isArray(tripsRes?.data)
            ? tripsRes.data
            : [];

        const mapped: DrivingTrip[] = tripsArray.map((t: any) => ({
          id: t.id ?? t.tripId ?? String(t.TripID ?? t.Id ?? Math.random()),
          startTime: t.startTime ?? t.startTimeUtc ?? t.StartDate ?? t.start_time,
          endTime: t.endTime ?? t.endTimeUtc ?? t.EndDate ?? t.end_time,
          distanceKm: t.distanceKm ?? t.Distance ?? 0,
          durationMin: t.durationMin ?? (t.Duration ? t.Duration / 60 : 0),
          safetyScore: t.safetyScore ?? t.Score_Overall ?? t.score ?? null,
          maxSpeed: t.maxSpeed ?? t.MaxSpeed ?? null,
          avgSpeed: t.avgSpeed ?? t.AverageSpeed ?? null,
          damoovStatistics: t.damoovStatistics ?? t.Statistics ?? null,
          damoovScores: t.damoovScores ?? t.Scores ?? null,
          startLocation: t.startLocation ?? t.StartLocation ?? null,
          endLocation: t.endLocation ?? t.EndLocation ?? null,
        }))
          // Filter out malformed rows without timestamps
          .filter(trip => !!trip.startTime && !!trip.endTime);

        setAllTrips(mapped);
      } catch (e: any) {
        console.error('DrivingTimeline loadTrips error', e);
        setError(e?.message || 'Failed to load trips');
        setAllTrips([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  const tripsForDay = useMemo(() => {
    if (!allTrips.length) return [];
    return allTrips.filter(trip => {
      const d = new Date(trip.startTime);
      return sameDay(d, selectedDate);
    });
  }, [allTrips, selectedDate]);

  const daySummary = useMemo(() => {
    if (!tripsForDay.length) {
      return { totalDistance: 0, totalMinutes: 0, tripCount: 0, avgScore: null as number | null };
    }
    const totalDistance = tripsForDay.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const totalMinutes = tripsForDay.reduce((sum, t) => sum + (t.durationMin || 0), 0);
    const scored = tripsForDay.filter(t => t.safetyScore != null);
    const avgScore =
      scored.length > 0
        ? scored.reduce((sum, t) => sum + (t.safetyScore || 0), 0) / scored.length
        : null;
    return { totalDistance, totalMinutes, tripCount: tripsForDay.length, avgScore };
  }, [tripsForDay]);

  const dayTitle = format(selectedDate, 'EEEE, dd MMM yyyy');

  const shiftDay = (delta: number) => {
    setSelectedDate(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      return next;
    });
  };

  const renderTrip = ({ item }: { item: DrivingTrip }) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    const timeRange = `${format(start, 'HH:mm')} → ${format(end, 'HH:mm')}`;

    const hours = Math.floor(item.durationMin / 60);
    const minutes = Math.floor(item.durationMin % 60);
    const durationLabel = `${hours}h ${minutes}m`;

    const startParts = item.startLocation?.Parts || {};
    const endParts = item.endLocation?.Parts || {};
    const cityStart = startParts?.City || null;
    const cityFinish = endParts?.City || null;
    const addressStart = item.startLocation?.Full || null;
    const addressEnd = item.endLocation?.Full || null;

    const startLabel = (cityStart || addressStart) ?? '—';
    const endLabel = (cityFinish || addressEnd) ?? '—';

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
      >
        <View style={styles.tripCard}>
          <View style={styles.tripHeaderRow}>
            <Text style={styles.tripTime}>{timeRange}</Text>
          </View>
          <View style={styles.tripMetaRow}>
            <View style={styles.tripMetaItem}>
              <Icon name="clock" size={wp(3.5)} color="#aaa" />
              <Text style={styles.tripMetaText}>{durationLabel}</Text>
            </View>
          </View>

          {/* Start/End only */}
          <View style={{ marginTop: hp(0.6) }}>
            <Text style={styles.tripMetaText}>Start: {startLabel}</Text>
            <Text style={styles.tripMetaText}>End: {endLabel}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined} />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Driving Timeline</Text>
      </View>

      <View style={styles.dateBar}>
        <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDay(-1)}>
          <Ionicons name="chevron-back" size={18} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.dateLabel}>{dayTitle}</Text>
        <TouchableOpacity style={styles.dateArrow} onPress={() => shiftDay(1)}>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.loadingText}>Loading trips…</Text>
          </View>
        ) : (
          <>
            {error && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {!error && tripsForDay.length > 0 && (
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Day summary</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Trips</Text>
                    <Text style={styles.summaryValue}>{daySummary.tripCount}</Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Distance</Text>
                    <Text style={styles.summaryValue}>
                      {daySummary.totalDistance < 1
                        ? `${Math.round(daySummary.totalDistance * 1000)} m`
                        : `${daySummary.totalDistance.toFixed(1)} km`}
                    </Text>
                  </View>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>
                      {`${Math.floor(daySummary.totalMinutes / 60)}h ${Math.floor(
                        daySummary.totalMinutes % 60,
                      )}m`}
                    </Text>
                  </View>
                  {daySummary.avgScore != null && (
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryLabel}>Avg score</Text>
                      <Text style={styles.summaryValue}>{Math.round(daySummary.avgScore)}</Text>
                    </View>
                  )}
                </View>
              </View>
            )}

            {!primaryVehicle && !loading && !error && (
              <View style={styles.center}>
                <Text style={styles.emptyText}>Add a vehicle to view driving timeline.</Text>
              </View>
            )}

            {primaryVehicle && tripsForDay.length === 0 && !loading && !error && (
              <View style={styles.center}>
                <Text style={styles.emptyText}>No trips recorded for this day.</Text>
                <Text style={styles.subtleText}>
                  Make sure this phone is linked for telematics in Driving Behavior.
                </Text>
              </View>
            )}

            <FlatList
              data={tripsForDay}
              keyExtractor={item => item.id}
              renderItem={renderTrip}
              contentContainerStyle={styles.listContent}
              refreshing={refreshing}
              onRefresh={() => loadTrips({ refreshing: true })}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  headerBack: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: wp(5.5),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp(3),
  },
  dateBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#1a1a1a',
    gap: 12,
  },
  dateArrow: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  dateLabel: {
    color: '#f5f5f5',
    fontSize: wp(4),
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
  },
  listContent: {
    paddingBottom: hp(4),
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(5),
  },
  loadingText: {
    marginTop: 8,
    color: '#ccc',
  },
  emptyText: {
    color: '#aaa',
    fontSize: wp(3.6),
    textAlign: 'center',
  },
  subtleText: {
    marginTop: hp(0.8),
    color: '#666',
    fontSize: wp(3.2),
    textAlign: 'center',
    paddingHorizontal: wp(5),
  },
  errorBox: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#3b0b0b',
    marginBottom: 8,
  },
  errorText: {
    color: '#ffb3b3',
  },
  summaryCard: {
    backgroundColor: '#111318',
    borderRadius: wp(4),
    paddingVertical: hp(1.4),
    paddingHorizontal: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  summaryTitle: {
    color: '#e5e5e5',
    fontSize: wp(3.6),
    fontWeight: '600',
    marginBottom: hp(0.6),
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    minWidth: '23%',
    marginTop: hp(0.4),
  },
  summaryLabel: {
    color: '#888',
    fontSize: wp(2.9),
  },
  summaryValue: {
    color: '#fff',
    fontSize: wp(3.6),
    fontWeight: '600',
    marginTop: 2,
  },
  tripCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tripTime: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
  },
  tripDistance: {
    color: '#ffbf00',
    fontSize: wp(3.4),
    fontWeight: '600',
  },
  tripMetaRow: {
    marginTop: hp(0.8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: wp(4),
  },
  tripMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  tripMetaText: {
    color: '#aaa',
    fontSize: wp(3.2),
  },
});

