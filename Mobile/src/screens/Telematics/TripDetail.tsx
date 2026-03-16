import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { format } from 'date-fns';
import { telematicsApi } from '../../api/telematics';
import BackButton from '../../components/BackButton';

type Props = {
  navigation: any;
  route: { params: { tripId: string } };
};

type PathPoint = { lat: number; lon: number; timestamp?: string };

type TripSummary = {
  trip: { id: string; startTime: string; endTime: string; distanceKm: number; durationMin: number; safetyScore: number };
  moneyTip: string;
  safetyTip: string;
};

export default function TripDetail({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [path, setPath] = useState<PathPoint[]>([]);
  const [summary, setSummary] = useState<TripSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [pathData, summaryData] = await Promise.all([
          telematicsApi.getTripPath(tripId),
          telematicsApi.getTripSummary(tripId).catch(() => null),
        ]);
        setPath(Array.isArray(pathData) ? pathData : []);
        setSummary(summaryData);
      } catch (e) {
        console.error('TripDetail load error', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tripId]);

  const hasPath = path.length > 0;
  const initialRegion = hasPath
    ? {
        latitude: path[0].lat,
        longitude: path[0].lon,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }
    : {
        latitude: 20.5937,
        longitude: 78.9629,
        latitudeDelta: 30,
        longitudeDelta: 30,
      };

  const t = summary?.trip;
  const startStr = t?.startTime ? format(new Date(t.startTime), 'HH:mm') : '—';
  const endStr = t?.endTime ? format(new Date(t.endTime), 'HH:mm') : '—';
  const distStr = t?.distanceKm != null
    ? (t.distanceKm < 1 ? `${Math.round(t.distanceKm * 1000)} m` : `${t.distanceKm.toFixed(1)} km`)
    : '—';
  const durMin = t?.durationMin ?? 0;
  const durStr = `${Math.floor(durMin / 60)}h ${Math.floor(durMin % 60)}m`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined} />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Trip details</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* End-trip summary: score + money/safety tips (A5) */}
        {summary && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>End-trip summary</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCircle}>
                <Text style={styles.scoreValue}>{t?.safetyScore ?? '—'}</Text>
                <Text style={styles.scoreUnit}>/ 100</Text>
              </View>
              <View style={styles.metaCol}>
                <Text style={styles.metaLine}>{startStr} → {endStr}</Text>
                <Text style={styles.metaLine}>{distStr} · {durStr}</Text>
              </View>
            </View>
            <View style={styles.tipBox}>
              <Icon name="rupee-sign" size={wp(3.5)} color="#FFBF00" style={styles.tipIcon} />
              <Text style={styles.tipText}>{summary.moneyTip}</Text>
            </View>
            <View style={styles.tipBox}>
              <Icon name="shield-alt" size={wp(3.5)} color="#4ade80" style={styles.tipIcon} />
              <Text style={styles.tipText}>{summary.safetyTip}</Text>
            </View>
          </View>
        )}

        <View style={styles.mapContainer}>
          {loading && !hasPath ? (
            <View style={styles.center}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : (
            <MapView style={styles.map} initialRegion={initialRegion}>
              {hasPath && (
                <Polyline
                  coordinates={path.map(p => ({
                    latitude: p.lat,
                    longitude: p.lon,
                  }))}
                  strokeWidth={4}
                  strokeColor="#ffbf00"
                />
              )}
            </MapView>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {hasPath ? 'Path from telematics trip data' : 'No GPS points recorded for this trip.'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  backButton: { width: wp(10), height: wp(10), justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: wp(5.5), fontWeight: '700', color: '#fff', marginLeft: wp(3) },
  scrollContent: { paddingBottom: hp(4) },
  summaryCard: {
    marginHorizontal: wp(4),
    marginBottom: hp(2),
    padding: wp(4),
    backgroundColor: '#141414',
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  summaryTitle: { fontSize: wp(3.8), fontWeight: '700', color: '#FFBF00', marginBottom: hp(2), textTransform: 'uppercase', letterSpacing: 0.5 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(2) },
  scoreCircle: {
    width: wp(18),
    height: wp(18),
    borderRadius: wp(9),
    backgroundColor: 'rgba(74,222,128,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(4),
  },
  scoreValue: { fontSize: wp(8), fontWeight: '800', color: '#4ade80' },
  scoreUnit: { fontSize: wp(3), color: '#888' },
  metaCol: { flex: 1 },
  metaLine: { fontSize: wp(4), color: '#ccc', marginTop: 2 },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: hp(1.5),
    paddingTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  tipIcon: { marginRight: wp(2.5), marginTop: 2 },
  tipText: { flex: 1, fontSize: wp(3.6), color: '#bbb', lineHeight: 20 },
  mapContainer: {
    height: hp(28),
    marginHorizontal: wp(4),
    marginBottom: hp(2),
    borderRadius: wp(4),
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  map: { flex: 1, width: '100%', height: '100%' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: hp(20) },
  footer: { paddingHorizontal: wp(5), paddingVertical: hp(1.5) },
  footerText: { color: '#aaa', fontSize: wp(3.4) },
});

