import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import { vehicleService, Vehicle as BVehicle } from '../../services/vehicleService';

interface Vehicle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: string;
  health: string;
  img: string;
  type?: string;
  fuel?: string;
  isPrimary?: boolean;
}

const VehicleList = ({ navigation, route }: any) => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const unmapHealth = (score: any) => {
    if (score === null || score === undefined) return '100%';
    return `${score}%`;
  };

  const fetchVehicles = async () => {
    try {
      const data = await vehicleService.getVehicles();
      const mapped = data.map((v: BVehicle) => ({
        id: v.id,
        plate: v.registrationNumber,
        brand: v.make || 'Unknown',
        model: v.model || 'Unknown',
        year: v.year?.toString() || '----',
        health: unmapHealth(v.healthScore?.overallScore),
        img: v.photo || 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
        type: v.vehicleType || 'Car',
        fuel: v.fuelType || 'Petrol',
        isPrimary: v.isPrimary,
      }));
      setVehicles(mapped);
    } catch (err) {
      // Error is handled silently to avoid cluttering console
    }
  };

  useEffect(() => {
    fetchVehicles();
  }, [route?.params?.newVehicle]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchVehicles();
    setRefreshing(false);
  };

  const getHealthColor = (health: string) => {
    const value = parseInt(health);
    if (value >= 80) return '#22c55e';
    if (value >= 60) return '#f59e0b';
    return '#ef4444';
  };

  const getHealthBg = (health: string) => {
    const value = parseInt(health);
    if (value >= 80) return 'rgba(34,197,94,0.15)';
    if (value >= 60) return 'rgba(245,158,11,0.15)';
    return 'rgba(239,68,68,0.15)';
  };

  const handleDeleteVehicle = (id: string, plate: string) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to remove ${plate} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Add optimistic deletion here so the UI feels immediate
              setVehicles(prev => prev.filter(v => v.id !== id));
              await vehicleService.deleteVehicle(id);
            } catch (err: any) {
              setRefreshing(true);
              await fetchVehicles(); // Re-fetch on error to revert state
              setRefreshing(false);
              Alert.alert('Error', err?.message || 'Failed to delete vehicle');
            }
          },
        },
      ],
    );
  };

  // ParseInt will extract numbers from string values reliably "85%" -> 85
  const validVehicles = vehicles.filter(v => !isNaN(parseInt(v.health, 10)));
  const totalHealth =
    validVehicles.length > 0
      ? Math.round(
        validVehicles.reduce((sum, v) => sum + parseInt(v.health, 10), 0) /
        validVehicles.length,
      )
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Vehicles</Text>
          <Text style={styles.headerSubtitle}>
            {vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'}{' '}
            registered
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addHeaderBtn}
          onPress={() => navigation.navigate('AddVehicle')}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="plus" size={wp(4)} color="#FFBF00" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFBF00"
            colors={['#FFBF00']}
          />
        }
      >
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{vehicles.length}</Text>
              <Text style={styles.statLabel}>Total Vehicles</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#22c55e' }]}>
                {totalHealth}%
              </Text>
              <Text style={styles.statLabel}>Avg Health</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Vehicles</Text>

        <View style={styles.listContainer}>
          {vehicles.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={styles.vehicleCard}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('VehicleDetails', { vehicle: item })
              }
              onLongPress={() => handleDeleteVehicle(item.id, item.plate)}
            >
              <View style={styles.cardLeft}>
                <Image source={{ uri: item.img }} style={styles.carImg} />
                <View
                  style={[
                    styles.healthBadge,
                    { backgroundColor: getHealthBg(item.health) },
                  ]}
                >
                  <FontAwesome5
                    name="heartbeat"
                    size={wp(2.5)}
                    color={getHealthColor(item.health)}
                  />
                  <Text
                    style={[
                      styles.healthText,
                      { color: getHealthColor(item.health) },
                    ]}
                  >
                    {item.health}
                  </Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                <View style={styles.plateRow}>
                  <Text style={styles.plateText}>{item.plate}</Text>
                  {item.isPrimary && (
                    <View style={styles.primaryBadge}>
                      <Text style={styles.primaryText}>Primary</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.modelText}>
                  {item.brand} {item.model}
                </Text>
                <Text style={styles.yearText}>{item.year}</Text>
              </View>

              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleDeleteVehicle(item.id, item.plate);
                  }}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <FontAwesome5 name="trash-alt" size={wp(4)} color="#ef4444" />
                </TouchableOpacity>
                <FontAwesome5 name="chevron-right" size={wp(4)} color="#333" />
              </View>
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={styles.addCard}
            onPress={() => navigation.navigate('AddVehicle')}
            activeOpacity={0.7}
          >
            <View style={styles.addIconContainer}>
              <FontAwesome5 name="plus" size={wp(6)} color="#FFBF00" />
            </View>
            <View style={styles.addTextContainer}>
              <Text style={styles.addTitle}>Add New Vehicle</Text>
              <Text style={styles.addSubtitle}>
                Register another vehicle to track
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.footerInfo}>
          <FontAwesome5 name="info-circle" size={14} color="#555" />
          <Text style={styles.footerText}>
            Tap on any vehicle to view its details or manage records
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: { flex: 1, marginLeft: wp(2) },
  headerTitle: { fontSize: wp(6), fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: wp(3.5), color: '#888', marginTop: hp(0.2) },
  addHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },

  scrollContent: { paddingBottom: hp(5) },
  statsCard: {
    backgroundColor: '#121212',
    marginHorizontal: wp(4),
    marginTop: hp(2),
    borderRadius: wp(4),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  statValue: { color: '#fff', fontSize: wp(7), fontWeight: 'bold' },
  statLabel: { color: '#666', fontSize: wp(3), marginTop: 4 },

  sectionTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.8),
    marginTop: hp(2),
    marginHorizontal: wp(4),
  },

  listContainer: { paddingHorizontal: wp(4), gap: hp(1.5) },
  vehicleCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardLeft: { position: 'relative' },
  carImg: {
    width: wp(20),
    height: wp(14),
    borderRadius: 14,
    backgroundColor: '#121212',
  },
  healthBadge: {
    position: 'absolute',
    bottom: -8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: 'center',
  },
  healthText: { fontSize: wp(2.5), fontWeight: 'bold' },
  cardContent: { flex: 1, marginLeft: wp(3) },
  plateRow: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  plateText: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  primaryBadge: {
    backgroundColor: 'rgba(255,191,0,0.15)',
    paddingHorizontal: wp(2),
    paddingVertical: 2,
    borderRadius: 6,
  },
  primaryText: { color: '#FFBF00', fontSize: wp(2.2), fontWeight: 'bold' },
  modelText: { color: '#777', fontSize: wp(3.2), marginTop: 4 },
  yearText: { color: '#444', fontSize: wp(2.8), marginTop: 2 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  deleteBtn: {
    padding: wp(1.5),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
  },

  addCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
    borderStyle: 'dashed',
  },
  addIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTextContainer: { flex: 1, marginLeft: wp(3) },
  addTitle: { color: '#FFBF00', fontSize: wp(4), fontWeight: 'bold' },
  addSubtitle: { color: '#555', fontSize: wp(3), marginTop: 2 },

  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginTop: hp(3),
    marginHorizontal: wp(4),
    padding: wp(3),
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
  },
  footerText: { color: '#444', fontSize: wp(2.8), flex: 1 },
});

export default VehicleList;
