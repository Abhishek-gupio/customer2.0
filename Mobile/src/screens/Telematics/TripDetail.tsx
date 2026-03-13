import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { telematicsApi } from '../../api/telematics';

type Props = {
  navigation: any;
  route: { params: { tripId: string } };
};

type PathPoint = { lat: number; lon: number; timestamp?: string };

export default function TripDetail({ navigation, route }: Props) {
  const { tripId } = route.params;
  const [path, setPath] = useState<PathPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const p = await telematicsApi.getTripPath(tripId);
        setPath(p);
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Trip details</Text>
        <View style={{ width: wp(10) }} />
      </View>

      <View style={styles.mapContainer}>
        {loading && !hasPath ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : (
          <MapView style={StyleSheet.absoluteFillObject} initialRegion={initialRegion}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  backButton: { width: wp(10), height: wp(10), justifyContent: 'center' },
  headerTitle: { fontSize: wp(5), fontWeight: '700', color: '#fff' },
  mapContainer: {
    flex: 1,
    marginHorizontal: wp(4),
    marginBottom: hp(2),
    borderRadius: wp(4),
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { paddingHorizontal: wp(5), paddingVertical: hp(1.5) },
  footerText: { color: '#aaa', fontSize: wp(3.4) },
});

