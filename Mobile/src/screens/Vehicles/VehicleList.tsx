import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const VehicleList = ({ navigation, route }: any) => {
  // 1. Maintain local state for the vehicle list
  const [vehicles, setVehicles] = useState([
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

  // 2. Listen for data passed back from AddVehicle screen via route params
  useEffect(() => {
    if (route.params?.newVehicle) {
      const newItem = {
        ...route.params.newVehicle,
        id: Math.random().toString(), // Generate temporary unique ID
        health: '100%', // Default health for new vehicles
        img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?q=80&w=400',
      };

      // Add new vehicle to the top of the list
      setVehicles(prev => [newItem, ...prev]);

      // 3. Clear the params after reading so it doesn't re-add on re-renders
      navigation.setParams({ newVehicle: undefined });
    }
  }, [route.params?.newVehicle, navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>My Vehicles</Text>
          <Text style={styles.headerSub}>Manage all your vehicles</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: hp(5) }}
      >
        {/* Stats Row - Dynamically calculated from state */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{vehicles.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#4ade80' }]}>89%</Text>
            <Text style={styles.statLabel}>Avg Health</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#3b82f6' }]}>0</Text>
            <Text style={styles.statLabel}>Issues</Text>
          </View>
        </View>

        {/* Dynamic List Rendering */}
        <View style={styles.listContainer}>
          {vehicles.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.8}
              // Updated: Passing the entire vehicle object as 'vehicle'
              onPress={() =>
                navigation.navigate('VehicleDetails', { vehicle: item })
              }
            >
              <Image source={{ uri: item.img }} style={styles.carImg} />
              <View style={styles.cardContent}>
                <Text style={styles.plateText}>{item.plate}</Text>
                <Text style={styles.modelText}>
                  {item.brand} {item.model} • {item.year}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.health} Health</Text>
                </View>
              </View>
              <FontAwesome5 name="chevron-right" size={wp(3.5)} color="#333" />
            </TouchableOpacity>
          ))}

          {/* Add New Button - Navigates to AddVehicle */}
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('AddVehicle')}
          >
            <View style={styles.plusCircle}>
              <FontAwesome5 name="plus" size={wp(4)} color="#fff" />
            </View>
            <View>
              <Text style={styles.addTitle}>Add New Vehicle</Text>
              <Text style={styles.addSubtitle}>Register another vehicle</Text>
            </View>
          </TouchableOpacity>
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
    paddingVertical: hp(1.5),
    marginBottom: hp(3),
  },
  backBtn: { padding: wp(2) },
  headerCenter: { flex: 1, marginLeft: wp(2) },
  headerTitle: { color: '#fff', fontSize: wp(6), fontWeight: '700' },
  headerSub: { color: '#888', fontSize: wp(3.5), marginTop: hp(0.2) },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(6),
    marginBottom: hp(4),
  },
  statBox: {
    backgroundColor: '#161616',
    width: wp(27),
    paddingVertical: hp(2.5),
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statNum: { color: '#fff', fontSize: wp(5.5), fontWeight: 'bold' },
  statLabel: {
    color: '#555',
    fontSize: wp(2.8),
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: { paddingHorizontal: wp(6) },
  card: {
    backgroundColor: '#161616',
    borderRadius: 24,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  carImg: {
    width: wp(22),
    height: wp(16),
    borderRadius: 16,
    backgroundColor: '#222',
  },
  cardContent: { flex: 1, marginLeft: wp(4) },
  plateText: {
    color: '#fff',
    fontSize: wp(4.2),
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modelText: { color: '#777', fontSize: wp(3.2), marginTop: 4 },
  badge: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#4ade80', fontSize: wp(2.8), fontWeight: 'bold' },
  addBtn: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#222',
    borderRadius: 24,
    padding: wp(5.5),
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(1),
  },
  plusCircle: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addTitle: { color: '#fff', fontSize: wp(4), fontWeight: 'bold' },
  addSubtitle: { color: '#555', fontSize: wp(3.2), marginTop: 2 },
});

export default VehicleList;
