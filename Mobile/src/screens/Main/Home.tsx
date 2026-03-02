import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import HomeVideo from '../../components/HomeVideo';
import QuickServicesGrid from '../../components/QuickServicesGrid';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import Vehicle3D from '../../components/Vehicle3D';
import { useState } from 'react';

export default function Home() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleProfilePress = () => {
    // Access the root navigator using getParent()
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('MyProfile');
    } else {
      navigation.navigate('MyProfile');
    }
  };

  const handleHelpPress = () => {
    // Access the root navigator using getParent()
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('HelpSupport');
    } else {
      navigation.navigate('HelpSupport');
    }
  };

  const [vehicles, setVehicles] = useState([
    {
      id: '1',
      plate: 'DL 01 AB 1234',
      model: 'Swift',
      brand: 'Maruti Suzuki',
      color: 'Yellow',
      health: '85%',
    },
  ]);

  const addVehicle = () => {
    const newId = (vehicles.length + 1).toString();
    setVehicles([
      ...vehicles,
      {
        id: newId,
        plate: `DL 0${newId} XY ${Math.floor(Math.random() * 9000) + 1000}`,
        model: 'i20',
        brand: 'Hyundai',
        color: 'Blue',
        health: '90%',
      },
    ]);
  };

  const navigateToRootScreen = (
    screenName: keyof RootStackParamList,
    params?: any,
  ) => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      if (params) {
        rootNav.navigate(screenName as any, params);
      } else {
        rootNav.navigate(screenName as any);
      }
    } else {
      if (params) {
        navigation.navigate(screenName as any, params);
      } else {
        navigation.navigate(screenName as any);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <HomeVideo
          onProfilePress={handleProfilePress}
          onHelpPress={handleHelpPress}
        />

        <QuickServicesGrid
          onServicePress={label => {
            if (label === 'Documents') {
              navigateToRootScreen('DocumentList');
            } else if (label === 'Vehicles') {
              navigateToRootScreen('VehicleList');
            }
            else if (label == 'Expenses') {
              navigateToRootScreen('Expenses');
            }
          }}
        />

        {/* MY VEHICLES SECTION - 3D DESIGN */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Vehicles</Text>
            <TouchableOpacity onPress={addVehicle} style={styles.addButton}>
              <Icon name="plus" size={wp(3.5)} color="#000" />
              <Text style={styles.addButtonText}>Add One</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.vehicleScroll}
          >
            {vehicles.map(vehicle => (
              <TouchableOpacity
                key={vehicle.id}
                style={styles.vehicle3DCard}
                activeOpacity={0.9}
                onPress={() =>
                  navigateToRootScreen('VehicleDetails', {
                    vehicleId: vehicle.id,
                  })
                }
              >
                <Vehicle3D style={styles.v3d} />
                <View style={styles.v3dInfo}>
                  <Text style={styles.v3dPlate}>{vehicle.plate}</Text>
                  <Text style={styles.v3dDetail}>
                    {vehicle.brand} {vehicle.model}
                  </Text>
                  <View style={styles.v3dRow}>
                    <Text style={styles.v3dSubDetail}>Color: {vehicle.color}</Text>
                    <View style={styles.v3dHealthBadge}>
                      <Text style={styles.v3dHealthText}>
                        {vehicle.health} Health
                      </Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Expiring Soon Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>Expiring Soon</Text>
          <View style={styles.alertCard}>
            <Icon
              name="exclamation-triangle"
              size={wp(5)}
              color="#FFBF00"
              style={styles.alertIcon}
            />
            <Text style={styles.alertText}>PUC expires in 15 days (Swift)</Text>
          </View>
          <View style={styles.alertCard}>
            <Icon
              name="exclamation-triangle"
              size={wp(5)}
              color="#FFBF00"
              style={styles.alertIcon}
            />
            <Text style={styles.alertText}>Insurance exp in 30 days (i20)</Text>
          </View>
        </View>

        {/* This Month Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>This Month</Text>
          <View style={styles.expenseRow}>
            <Text style={styles.expenseTotal}>Total: ₹12,450</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="gas-pump"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Fuel ₹6,200</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="parking"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Parking ₹1,800</Text>
          </View>
          <View style={styles.expenseItem}>
            <Icon
              name="wrench"
              size={wp(4)}
              color="#888"
              style={styles.expenseIcon}
            />
            <Text style={styles.expenseLabel}>Service ₹4,450</Text>
          </View>
        </View>

        {/* Pending Challans Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleCentered}>Pending Challans</Text>
          <Text style={styles.placeholderText}>No pending challans</Text>
        </View>

        <View style={{ height: hp(4) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    color: '#FFBF00',
    fontSize: wp(5.5),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitleCentered: {
    fontSize: wp(5.5),
    fontWeight: '800',
    color: '#FFBF00',
    marginBottom: hp(2),
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: wp(4.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  addButton: {
    backgroundColor: '#FFBF00',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 20,
  },
  addButtonText: {
    color: '#000',
    fontSize: wp(3.5),
    fontWeight: '700',
    marginLeft: wp(1.5),
  },
  vehicleScroll: {
    paddingRight: wp(5),
  },
  vehicle3DCard: {
    width: wp(80),
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    marginRight: wp(5),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.1)',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  v3d: {
    height: hp(25),
    width: '100%',
  },
  v3dInfo: {
    padding: wp(4),
    backgroundColor: '#1a1a1a',
  },
  v3dPlate: {
    color: '#FFBF00',
    fontSize: wp(4.5),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  v3dDetail: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
    marginTop: 2,
  },
  v3dRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp(1),
  },
  v3dSubDetail: {
    color: '#777',
    fontSize: wp(3.5),
  },
  v3dHealthBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  v3dHealthText: {
    color: '#4ade80',
    fontSize: wp(3),
    fontWeight: 'bold',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  alertIcon: {
    marginRight: wp(3),
  },
  alertText: {
    flex: 1,
    fontSize: wp(3.8),
    color: '#fff',
    fontWeight: '500',
  },
  expenseRow: {
    marginBottom: hp(1.5),
    alignItems: 'center',
  },
  expenseTotal: {
    fontSize: wp(6),
    fontWeight: '800',
    color: '#FFBF00',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  expenseIcon: {
    marginRight: wp(4),
  },
  expenseLabel: {
    fontSize: wp(4),
    color: '#fff',
    fontWeight: '500',
  },
  placeholderText: {
    fontSize: wp(3.8),
    color: '#888',
    textAlign: 'center',
    paddingVertical: hp(2),
  },
});
