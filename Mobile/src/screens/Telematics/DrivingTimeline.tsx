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
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { telematicsApi } from '../../api/telematics';
import { vehicleService, type Vehicle } from '../../services/vehicleService';
import BackButton from '../../components/BackButton';
import LinearGradient from 'react-native-linear-gradient';

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

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function DrivingTimeline({ navigation }: { navigation: any }) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [allTrips, setAllTrips] = useState<DrivingTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrips = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
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

        const mapped: DrivingTrip[] = tripsArray.map((t: any): DrivingTrip => ({
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
        })).filter((trip: DrivingTrip) => !!trip.startTime && !!trip.endTime);

        setAllTrips(mapped);
      } catch (e: any) {
        setError(e?.message || 'Failed to load trips');
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

  const onRefresh = () => {
    setRefreshing(true);
    loadTrips(true);
  };

  const tripsForDay = useMemo(() => {
    if (!allTrips.length) return [];
    return allTrips.filter(trip => {
      const d = new Date(trip.startTime);
      return sameDay(d, selectedDate);
    }).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [allTrips, selectedDate]);

  const daySummary = useMemo(() => {
    const totalDistance = tripsForDay.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
    const totalMinutes = tripsForDay.reduce((sum, t) => sum + (t.durationMin || 0), 0);
    const scored = tripsForDay.filter(t => t.safetyScore != null);
    const avgScore = scored.length > 0 ? scored.reduce((sum, t) => sum + (t.safetyScore || 0), 0) / scored.length : null;
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

  const renderTrip = ({ item, index }: { item: DrivingTrip; index: number }) => {
    const start = new Date(item.startTime);
    const end = new Date(item.endTime);
    const timeRange = `${format(start, 'HH:mm')} - ${format(end, 'HH:mm')}`;
    const durationLabel = `${Math.floor(item.durationMin / 60)}h ${Math.floor(item.durationMin % 60)}m`;

    const startLabel = item.startLocation?.Full || item.startLocation?.Parts?.City || 'Unknown Start';
    const endLabel = item.endLocation?.Full || item.endLocation?.Parts?.City || 'Unknown End';

    return (
      <TouchableOpacity
        style={styles.tripCard}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('TripDetail', { tripId: item.id })}
      >
        <View style={styles.timelineSide}>
           <View style={styles.timelineDot} />
           {index < tripsForDay.length - 1 && <View style={styles.timelineLine} />}
        </View>

        <View style={styles.tripContent}>
          <View style={styles.tripHeader}>
            <Text style={styles.tripTimeText}>{timeRange}</Text>
            {item.safetyScore != null && (
               <View style={[styles.miniScore, { backgroundColor: item.safetyScore >= 80 ? 'rgba(16,185,129,0.1)' : 'rgba(255,191,0,0.1)' }]}>
                  <Text style={[styles.miniScoreText, { color: item.safetyScore >= 80 ? '#10B981' : '#FFBF00' }]}>{Math.round(item.safetyScore)}</Text>
               </View>
            )}
          </View>

          <View style={styles.locRow}>
             <Icon name="play-circle" size={wp(3)} color="#10B981" />
             <Text style={styles.locText} numberOfLines={1}>{startLabel}</Text>
          </View>
          <View style={[styles.locRow, { marginTop: hp(0.5) }]}>
             <Icon name="stop-circle" size={wp(3)} color="#EF4444" />
             <Text style={styles.locText} numberOfLines={1}>{endLabel}</Text>
          </View>

          <View style={styles.tripFooter}>
            <View style={styles.featItem}>
               <Icon name="route" size={wp(3)} color="#666" />
               <Text style={styles.featText}>{item.distanceKm.toFixed(1)} km</Text>
            </View>
            <View style={styles.featItem}>
               <Icon name="clock" size={wp(3)} color="#666" />
               <Text style={styles.featText}>{durationLabel}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Trips Log</Text>
        <TouchableOpacity style={styles.syncBtn} onPress={() => loadTrips(true)}>
           <Icon name="sync-alt" size={wp(4)} color="#fff" />
        </TouchableOpacity>
      </View>

      <LinearGradient colors={['#111', '#0a0a0a']} style={styles.dateSelector}>
        <TouchableOpacity onPress={() => shiftDay(-1)} style={styles.arrowBox}>
          <Ionicons name="chevron-back" size={wp(5)} color="#FFBF00" />
        </TouchableOpacity>
        <View style={styles.dateInfo}>
           <Text style={styles.dateText}>{dayTitle}</Text>
        </View>
        <TouchableOpacity onPress={() => shiftDay(1)} style={styles.arrowBox}>
          <Ionicons name="chevron-forward" size={wp(5)} color="#FFBF00" />
        </TouchableOpacity>
      </LinearGradient>

      {loading && !refreshing ? (
        <View style={styles.centerWrap}>
          <ActivityIndicator color="#FFBF00" size="large" />
          <Text style={styles.loadLabel}>Organizing your drives...</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FlatList
            data={tripsForDay}
            keyExtractor={item => item.id}
            renderItem={renderTrip}
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
            ListHeaderComponent={
              tripsForDay.length > 0 ? (
                <View style={styles.dayStatsCard}>
                   <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                         <Text style={styles.statVal}>{daySummary.tripCount}</Text>
                         <Text style={styles.statLab}>TRIPS</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                         <Text style={styles.statVal}>{daySummary.totalDistance.toFixed(1)}</Text>
                         <Text style={styles.statLab}>KM</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                         <Text style={styles.statVal}>{Math.round(daySummary.avgScore || 0)}</Text>
                         <Text style={styles.statLab}>SCORE</Text>
                      </View>
                   </View>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                 <Icon name="road" size={wp(15)} color="#1a1a1a" />
                 <Text style={styles.emptyTitle}>No drives found</Text>
                 <Text style={styles.emptySub}>No trips were recorded on this date.</Text>
                 <TouchableOpacity style={styles.retryBtn} onPress={() => loadTrips(true)}>
                    <Text style={styles.retryText}>REFRESH NOW</Text>
                 </TouchableOpacity>
              </View>
            }
          />
        </View>
      )}
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
  headerTitle: {
    flex: 1,
    fontFamily: 'Outfit-Bold',
    fontSize: wp(5.5),
    color: '#fff',
    marginLeft: wp(3),
  },
  syncBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  arrowBox: {
    width: wp(10),
    height: wp(10),
    borderRadius: 12,
    backgroundColor: 'rgba(255,191,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateInfo: {
    flex: 1,
    alignItems: 'center',
  },
  dateText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4),
    color: '#fff',
  },
  listContainer: {
    padding: wp(5),
    paddingBottom: hp(10),
  },
  dayStatsCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: wp(6),
    marginBottom: hp(3),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statVal: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(6),
    color: '#fff',
  },
  statLab: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
    color: '#FFBF00',
    marginTop: 2,
    letterSpacing: 1,
  },
  statDivider: {
    width: 1,
    height: hp(4),
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tripCard: {
    flexDirection: 'row',
    marginBottom: hp(2.5),
  },
  timelineSide: {
    width: wp(8),
    alignItems: 'center',
  },
  timelineDot: {
    width: wp(2.5),
    height: wp(2.5),
    borderRadius: wp(1.25),
    backgroundColor: '#FFBF00',
    marginTop: hp(0.8),
    zIndex: 2,
  },
  timelineLine: {
    position: 'absolute',
    top: hp(2),
    bottom: -hp(2.5),
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tripContent: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: 20,
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.2),
  },
  tripTimeText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    color: '#fff',
  },
  miniScore: {
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.4),
    borderRadius: 8,
  },
  miniScoreText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(3),
  },
  locRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  locText: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
    color: '#888',
    flex: 1,
  },
  tripFooter: {
    flexDirection: 'row',
    marginTop: hp(1.5),
    paddingTop: hp(1.2),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
    gap: wp(5),
  },
  featItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
  },
  featText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
    color: '#666',
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: hp(10),
  },
  loadLabel: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.8),
    color: '#666',
    marginTop: hp(2),
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: hp(10),
  },
  emptyTitle: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(5.5),
    color: '#fff',
    marginTop: hp(2),
  },
  emptySub: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.8),
    color: '#555',
    marginTop: hp(0.5),
  },
  retryBtn: {
    marginTop: hp(4),
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(8),
    backgroundColor: '#111',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  retryText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(3.5),
    color: '#FFBF00',
    letterSpacing: 1,
  },
});
