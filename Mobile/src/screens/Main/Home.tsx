import React, { useState } from 'react';
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
import ServiceOptionsOverlay from '../ServiceAndWarrenty/OptionModal';

export default function Home() {
<<<<<<< HEAD
  const navigation =useNavigation<NativeStackNavigationProp<RootStackParamList>>();
=======
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
>>>>>>> 1ef372507707254381e521169982f91bb18e1870

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

  const navigateToRootScreen = (screenName: keyof RootStackParamList, params?: any) => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
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
<<<<<<< HEAD

  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  // const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
=======
>>>>>>> 1ef372507707254381e521169982f91bb18e1870
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
<<<<<<< HEAD
            }
            else if(label=='Expenses'){
              navigateToRootScreen('Expenses');
              navigation.navigate('DocumentList');
=======
>>>>>>> 1ef372507707254381e521169982f91bb18e1870
            } else if (label === 'Expenses') {
              navigateToRootScreen('Expenses');
            } else if (label === 'Service') {
<<<<<<< HEAD
              setServiceModalVisible(true); 
=======
              setServiceModalVisible(true);
>>>>>>> 1ef372507707254381e521169982f91bb18e1870
            }
          }}
        />

        {/* MY VEHICLES SECTION - MERGED DESIGN */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Vehicles</Text>
            <TouchableOpacity
              onPress={() => navigateToRootScreen('VehicleList')}
            >
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>

          {/* Main Vehicle Preview Card - High Fidelity Design */}
          <TouchableOpacity
            style={styles.vehicleCard}
            activeOpacity={0.9}
            onPress={() =>
              navigateToRootScreen('VehicleDetails', { vehicleId: '1' })
            }
          >
            <View style={styles.row}>
              <View style={styles.carImgPlaceholder}>
                <Icon name="car" size={wp(8)} color="#333" />
              </View>
              <View style={styles.carInfo}>
                <Text style={styles.carPlate}>DL 01 AB 1234</Text>
                <Text style={styles.carModel}>Maruti Suzuki Swift</Text>
              </View>
              <View style={styles.healthBadge}>
                <Text style={styles.healthText}>85% Health</Text>
              </View>
            </View>
          </TouchableOpacity>
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
        <ServiceOptionsOverlay
          visible={serviceModalVisible}
          onClose={() => setServiceModalVisible(false)}
          onSelect={(screen) => {
            setServiceModalVisible(false);
            navigation.navigate(screen);
          }}
        />
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
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
  },
  sectionTitleCentered: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.5),
    textAlign: 'center',
  },
  seeAllText: {
    color: '#3b82f6',
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 22,
    padding: wp(4.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carImgPlaceholder: {
    width: wp(16),
    height: wp(12),
    backgroundColor: '#222',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  carInfo: {
    marginLeft: wp(4),
    flex: 1,
  },
  carPlate: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: 'bold',
  },
  carModel: {
    color: '#777',
    fontSize: wp(3),
    marginTop: 2,
  },
  healthBadge: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  healthText: {
    color: '#4ade80',
    fontSize: wp(2.8),
    fontWeight: 'bold',
  },
  alertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(2.5),
    padding: wp(4),
    marginBottom: hp(1),
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
    marginBottom: hp(1),
  },
  expenseTotal: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#FFBF00',
  },
  expenseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  expenseIcon: {
    marginRight: wp(3),
  },
  expenseLabel: {
    fontSize: wp(4),
    color: '#fff',
  },
  placeholderText: {
    fontSize: wp(3.8),
    color: '#888',
    textAlign: 'center',
    paddingVertical: hp(2),
  },
});
