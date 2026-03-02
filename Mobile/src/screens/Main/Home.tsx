import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Image,
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
import { getProfile } from '../../services/profileService';

export default function Home() {
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [userName, setUserName] = useState('');
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showGreeting, setShowGreeting] = useState(true);

  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  useEffect(() => {
    loadUserContext();

    // Auto-hide greeting after 7 seconds
    const timer = setTimeout(() => {
      setShowGreeting(false);
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  const loadUserContext = async () => {
    try {
      const data = await getProfile();
      if (data.fullName) {
        setUserName(data.fullName.split(' ')[0]); // Use first name
        setProfilePic(data.profilePic || null);
      }
    } catch (err) {
      console.log('Error loading user context on home:', err);
    }
  };

  const handleProfilePress = () => {
    navigation.navigate('MyProfile');
  };

  const handleHelpPress = () => {
    navigation.navigate('HelpSupport');
  };

  const navigateToRootScreen = (screenName: keyof RootStackParamList, params?: any) => {
    navigation.navigate(screenName as any, params);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Premium Header Overlaid on Video */}
      <View style={styles.headerContainer}>
        <HomeVideo
          onProfilePress={handleProfilePress}
          onHelpPress={handleHelpPress}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quickGridContainer}>
          <QuickServicesGrid
            onServicePress={label => {
              if (label === 'Documents') navigateToRootScreen('DocumentList');
              else if (label === 'Vehicles') navigateToRootScreen('VehicleList');
              else if (label === 'Expenses') navigateToRootScreen('Expenses');
              else if (label === 'Service') setServiceModalVisible(true);
            }}
          />
        </View>

        {/* MY VEHICLES SECTION - PREMIUM GLASS CARD */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Garage</Text>
            <TouchableOpacity onPress={() => navigateToRootScreen('VehicleList')}>
              <Text style={styles.seeAllText}>Manage All</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.premiumVehicleCard}
            activeOpacity={0.9}
            onPress={() => navigateToRootScreen('VehicleDetails', { vehicleId: '1' })}
          >
            <View style={styles.cardGlass} />
            <View style={styles.row}>
              <View style={styles.carImgWrap}>
                <Icon name="car-side" size={wp(7)} color="#FFBF00" />
              </View>
              <View style={styles.carInfo}>
                <Text style={styles.carPlate}>DL 01 AB 1234</Text>
                <Text style={styles.carModel}>Maruti Suzuki Swift • VXI</Text>
              </View>
              <View style={styles.healthContainer}>
                <Text style={styles.healthValue}>85%</Text>
                <Text style={styles.healthLabel}>Health</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ALERTS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleAlt}>Attention Required</Text>
          <View style={styles.premiumAlertCard}>
            <View style={[styles.alertIndicator, { backgroundColor: '#FFBF00' }]} />
            <Icon name="history" size={wp(4)} color="#FFBF00" style={styles.alertIcon} />
            <Text style={styles.alertText}>PUC expires in 15 days (Swift)</Text>
          </View>
          <View style={styles.premiumAlertCard}>
            <View style={[styles.alertIndicator, { backgroundColor: '#F44336' }]} />
            <Icon name="shield-alt" size={wp(4)} color="#F44336" style={styles.alertIcon} />
            <Text style={styles.alertText}>Insurance exp in 30 days (i20)</Text>
          </View>
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
    paddingBottom: hp(4),
  },
  headerContainer: {
    width: '100%',
    position: 'relative',
    height: hp(28),
  },
  greetingOverlay: {
    position: 'absolute',
    bottom: hp(2),
    left: wp(5),
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: 10,
    borderRadius: 12,
  },
  welcomeLabel: {
    color: '#aaa',
    fontSize: 14,
    fontWeight: '500',
  },
  userNameText: {
    color: '#fff',
    fontSize: wp(6),
    fontWeight: '800',
    marginTop: 2,
  },
  quickGridContainer: {
    marginTop: -hp(3), // Pull grid up onto the video slightly
    paddingHorizontal: wp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginTop: hp(4),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitleAlt: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(1.5),
    marginLeft: wp(1),
  },
  seeAllText: {
    color: '#FFBF00',
    fontSize: 14,
    fontWeight: '700',
  },
  premiumVehicleCard: {
    backgroundColor: '#161616',
    borderRadius: 20,
    padding: wp(5),
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGlass: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  carImgWrap: {
    width: wp(14),
    height: wp(14),
    backgroundColor: '#000',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  carInfo: {
    marginLeft: wp(4),
    flex: 1,
  },
  carPlate: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  carModel: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  healthContainer: {
    alignItems: 'flex-end',
  },
  healthValue: {
    color: '#4ade80',
    fontSize: 22,
    fontWeight: '900',
  },
  healthLabel: {
    color: '#4ade80',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  premiumAlertCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#222',
  },
  alertIndicator: {
    position: 'absolute',
    left: 0,
    top: 15,
    bottom: 15,
    width: 4,
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  alertIcon: {
    marginRight: wp(3),
    marginLeft: wp(1),
  },
  alertText: {
    flex: 1,
    fontSize: 15,
    color: '#eee',
    fontWeight: '500',
  },
});
