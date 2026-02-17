import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const VehicleList = ({ navigation }: any) => {
  const vehicles = [
    {
      id: '1',
      plate: 'DL 01 AB 1234',
      model: 'Maruti Suzuki Swift',
      year: '2022',
      health: '85%',
      img: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
    },
    {
      id: '2',
      plate: 'DL 02 XY 5678',
      model: 'Hyundai Creta',
      year: '2023',
      health: '92%',
      img: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400',
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
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
        {/* Stats Section */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>2</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#4ade80' }]}>89%</Text>
            <Text style={styles.statLabel}>Avg Health</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNum, { color: '#f87171' }]}>0</Text>
            <Text style={styles.statLabel}>Issues</Text>
          </View>
        </View>

        {/* List of Vehicles */}
        <View style={styles.listContainer}>
          {vehicles.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              activeOpacity={0.7}
              onPress={() =>
                navigation.navigate('VehicleDetails', { vehicleId: item.id })
              }
            >
              <Image source={{ uri: item.img }} style={styles.carImg} />
              <View style={styles.cardContent}>
                <Text style={styles.plateText}>{item.plate}</Text>
                <Text style={styles.modelText}>
                  {item.model} • {item.year}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.health} Health</Text>
                </View>
              </View>
              <FontAwesome5
                name="chevron-right"
                size={wp(3.5)}
                color="#444"
                style={styles.chevron}
              />
            </TouchableOpacity>
          ))}

          {/* Add Vehicle Button */}
          <TouchableOpacity
            style={styles.addBtn}
            activeOpacity={0.6}
            onPress={() => navigation.navigate('AddVehicle')}
          >
            <View style={styles.circleIcon}>
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
    paddingHorizontal: wp(6),
    marginTop: hp(2),
    marginBottom: hp(3),
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    marginLeft: wp(-2),
  },
  headerCenter: {
    flex: 1,
    marginLeft: wp(2),
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(6),
    fontWeight: 'bold',
  },
  headerSub: { color: '#888', fontSize: wp(3.2), marginTop: 2 },
  searchBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  subtitle: { color: '#888', fontSize: wp(3.8), marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(6),
    marginBottom: hp(4),
  },
  statBox: {
    backgroundColor: '#1a1a1a',
    width: wp(27),
    paddingVertical: hp(2),
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statNum: { color: '#fff', fontSize: wp(5.5), fontWeight: 'bold' },
  statLabel: {
    color: '#666',
    fontSize: wp(2.8),
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContainer: { paddingHorizontal: wp(6) },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
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
    borderRadius: 15,
    backgroundColor: '#333',
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
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  badgeText: { color: '#4ade80', fontSize: wp(2.8), fontWeight: 'bold' },
  chevron: { marginLeft: wp(2) },
  addBtn: {
    marginTop: hp(1),
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 22,
    padding: wp(6),
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleIcon: {
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
