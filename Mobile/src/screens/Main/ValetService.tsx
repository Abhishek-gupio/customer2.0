import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation } from '../../lib/react-navigation-native';
import {
  cancelDropRequest,
  getValetLocation,
  getVehicleRequestData,
  requestDrop,
  type VehicleRequestData,
} from '../../services/valetCustomerService';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import BackButton from '../../components/BackButton';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { Linking } from 'react-native';

export default function ValetService() {
  const navigation = useNavigation<any>();
  const [vehicleNumber, setVehicleNumber] = React.useState('');
  const [data, setData] = React.useState<VehicleRequestData | null>(null);
  const [location, setLocation] = React.useState<{ latitude?: number; longitude?: number } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentVehicleNumber = (vehicleNumber || data?.vehicleNumber || '').toUpperCase().trim();

  const handleCallValet = () => {
    if (data?.pickupInfo?.valetPhone) {
      Linking.openURL(`tel:${data.pickupInfo.valetPhone}`);
    }
  };

  const refresh = React.useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      setError(null);
      const reqData = await getVehicleRequestData(currentVehicleNumber || undefined);
      setData(reqData);

      const targetVehicle = reqData.vehicleNumber || currentVehicleNumber;
      if (targetVehicle) {
        const loc = await getValetLocation(targetVehicle);
        setLocation({ latitude: loc.latitude, longitude: loc.longitude });
      } else {
        setLocation(null);
      }
    } catch (e: any) {
      setError(e?.message || 'No active valet record found for this vehicle.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentVehicleNumber]);

  const onRefresh = () => {
    setRefreshing(true);
    refresh(true);
  };

  const onRequestVehicle = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await requestDrop(currentVehicleNumber || undefined);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to request vehicle');
      setLoading(false);
    }
  }, [currentVehicleNumber, refresh]);

  const onCancelRequest = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await cancelDropRequest(currentVehicleNumber || undefined);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel request');
      setLoading(false);
    }
  }, [currentVehicleNumber, refresh]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'REQUESTED': return '#FFBF00';
      case 'PICKED_UP': return '#10B981';
      case 'DROPPED_OFF': return '#3B82F6';
      default: return '#64748B';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Valet Services</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
      >
        {/* HERO BANNER */}
        <View style={styles.heroSection}>
          <FastImage
            source={{ uri: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=1200' }}
            style={styles.heroImage}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.9)']}
            style={styles.heroOverlay}
          >
            <Text style={styles.heroTitle}>Premium Valet</Text>
            <Text style={styles.heroSub}>Track your luxury vehicle in real-time</Text>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          {/* SEARCH CARD */}
          <View style={styles.glassCard}>
            <Text style={styles.cardHeading}>Vehicle Verification</Text>
            <View style={styles.searchBar}>
              <Icon name="car" size={wp(4)} color="#FFBF00" style={styles.searchIcon} />
              <TextInput
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
                placeholder="Enter Registration Number"
                autoCapitalize="characters"
                placeholderTextColor="#666"
                style={styles.searchInput}
              />
              <TouchableOpacity onPress={() => refresh()} style={styles.checkBtn}>
                <Text style={styles.checkBtnText}>VERIFY</Text>
              </TouchableOpacity>
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {/* STATUS DISPLAY */}
          <View style={[styles.statusCard, { borderColor: getStatusColor(data?.requestStatus) + '40' }]}>
            <View style={styles.statusHeader}>
              <View>
                <Text style={styles.statusLabel}>CURRENT STATUS</Text>
                <Text style={[styles.statusValue, { color: getStatusColor(data?.requestStatus) }]}>
                  {data?.requestStatus?.replace('_', ' ') || 'NO ACTIVE REQUEST'}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(data?.requestStatus) }]} />
            </View>

            <View style={styles.divider} />

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Vehicle</Text>
                <Text style={styles.infoText}>{data?.vehicleNumber || currentVehicleNumber || '—'}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Assigned Valet</Text>
                <Text style={styles.infoText}>{data?.pickupInfo?.pickedBy || 'Allocating...'}</Text>
              </View>
            </View>

            {location && (
              <View style={styles.locationBadge}>
                <MaterialIcon name="map-marker-radius" size={wp(4)} color="#FFBF00" />
                <Text style={styles.locationText}>
                  LIVE: {location.latitude?.toFixed(5)}, {location.longitude?.toFixed(5)}
                </Text>
              </View>
            )}
          </View>

          {/* ACTION BUTTONS */}
          <View style={styles.actions}>
            {data?.pickupInfo?.valetPhone ? (
               <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#10B981' }]}
                onPress={handleCallValet}
                activeOpacity={0.8}
              >
                <Icon name="phone-alt" size={wp(4)} color="#fff" style={{ marginRight: wp(2) }} />
                <Text style={[styles.primaryButtonText, { color: '#fff' }]}>Call Valet Driver</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && { opacity: 0.7 }]}
              onPress={onRequestVehicle}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Icon name="concierge-bell" size={wp(4)} color="#111" style={{ marginRight: wp(2) }} />
                  <Text style={styles.primaryButtonText}>Request My Vehicle</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={onCancelRequest}
                disabled={loading}
              >
                <Icon name="times" size={wp(3.5)} color="#F87171" style={{ marginRight: wp(2) }} />
                <Text style={[styles.secondaryButtonText, { color: '#F87171' }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => navigation.navigate('VehicleList')}
              >
                <Icon name="car" size={wp(3.5)} color="#fff" style={{ marginRight: wp(2) }} />
                <Text style={styles.secondaryButtonText}>Garage</Text>
              </TouchableOpacity>
            </View>
          </View>

        </View>
        
        <View style={{ height: hp(5) }} />
      </ScrollView>
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
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  heroSection: {
    height: hp(24),
    marginHorizontal: wp(5),
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: hp(3),
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: wp(6),
    justifyContent: 'flex-end',
  },
  heroTitle: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(6),
    color: '#fff',
  },
  heroSub: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.5),
    color: 'rgba(255,255,255,0.7)',
  },
  content: {
    paddingHorizontal: wp(5),
  },
  glassCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: hp(2.5),
  },
  cardHeading: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    color: '#aaa',
    marginBottom: hp(1.5),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000',
    borderRadius: 12,
    paddingHorizontal: wp(3),
    height: 54,
    borderWidth: 1,
    borderColor: '#222',
  },
  searchIcon: {
    marginRight: wp(2),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(4),
  },
  checkBtn: {
    backgroundColor: 'rgba(255,191,0,0.1)',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: 8,
  },
  checkBtnText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
    color: '#FFBF00',
  },
  statusCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: wp(6),
    borderWidth: 1.5,
    marginBottom: hp(3),
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp(2),
  },
  statusLabel: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
    color: '#666',
    letterSpacing: 0.5,
  },
  statusValue: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(5.5),
    marginTop: hp(0.5),
  },
  statusDot: {
    width: wp(3),
    height: wp(3),
    borderRadius: wp(1.5),
    marginTop: hp(1),
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: hp(2),
  },
  infoGrid: {
    flexDirection: 'row',
    marginBottom: hp(2),
  },
  infoItem: {
    flex: 1,
  },
  infoLabel: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
    color: '#555',
    marginBottom: 4,
  },
  infoText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    color: '#eee',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,191,0,0.05)',
    padding: wp(3),
    borderRadius: 12,
    gap: wp(2),
  },
  locationText: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
    color: '#FFBF00',
  },
  actions: {
    gap: hp(1.5),
  },
  primaryButton: {
    backgroundColor: '#FFBF00',
    borderRadius: 16,
    height: hp(7),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(4.2),
    color: '#111',
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: wp(4),
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: '#161616',
    borderRadius: 16,
    height: hp(6.5),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  secondaryButtonText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    color: '#fff',
  },
  errorText: {
    color: '#F87171',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    marginTop: hp(1),
    textAlign: 'center',
  },
});
