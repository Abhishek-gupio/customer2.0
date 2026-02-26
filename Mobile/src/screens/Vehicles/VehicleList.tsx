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
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: '1',
      plate: 'DL 01 AB 1234',
      brand: 'Maruti Suzuki',
      model: 'Swift',
      year: '2022',
      health: '85%',
      img: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?q=80&w=400',
    },
    {
      id: '2',
      plate: 'DL 02 XY 5678',
      brand: 'Hyundai',
      model: 'Creta',
      year: '2023',
      health: '92%',
      img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=400',
    },
  ]);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (route.params?.newVehicle) {
      const newItem: Vehicle = {
        ...route.params.newVehicle,
        id: Date.now().toString(),
        health: '100%',
        img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=400',
      };
      setVehicles(prev => [newItem, ...prev]);
      navigation.setParams({ newVehicle: undefined });
    }
  }, [route.params?.newVehicle, navigation]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
    } finally {
      setRefreshing(false);
    }
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
          onPress: () => {
            setVehicles(prev => prev.filter(v => v.id !== id));
          },
        },
      ],
    );
  };

  const totalHealth =
    vehicles.length > 0
      ? Math.round(
          vehicles.reduce((sum, v) => sum + parseInt(v.health), 0) /
            vehicles.length,
        )
      : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
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

        <View style={styles.sectionHeader}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>Your Vehicles</Text>
          <View style={styles.sectionLine} />
        </View>

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
                  {index === 0 && (
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

              <FontAwesome5 name="chevron-right" size={wp(4)} color="#333" />
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
            Long press on any vehicle to remove it from your list
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
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
  headerCenter: { flex: 1, marginLeft: wp(3) },
  headerTitle: { color: '#fff', fontSize: wp(5.5), fontWeight: 'bold' },
  headerSubtitle: { color: '#666', fontSize: wp(3.2), marginTop: 2 },
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
    borderRadius: 24,
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(3),
    marginBottom: hp(2),
    marginHorizontal: wp(4),
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: wp(3),
  },

  listContainer: { paddingHorizontal: wp(4), gap: hp(2) },
  vehicleCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardLeft: { position: 'relative' },
  carImg: {
    width: wp(20),
    height: wp(14),
    borderRadius: 14,
    backgroundColor: '#1a1a1a',
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

  addCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
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
