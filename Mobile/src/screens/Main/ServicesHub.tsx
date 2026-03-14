import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';

type ServiceId =
  | 'PartsWarranty'
  | 'ServiceHistory'
  | 'NearbyPlaces'
  | 'CheckChallan'
  | 'FuelStations'
  | 'Hospital'
  | 'PoliceStation'
  | 'Hotel'
  | 'ChargingStation'
  | 'Mechanics'
  | 'RTO'
  | 'Towing'
  | 'CarWash'
  | 'Insurance'
  | 'Parking'
  | 'TyreShop'
  | 'DocumentServices'
  | 'CarSpa';

type ServiceItem = { id: ServiceId; name: string; icon: string; iconSet: 'fa' | 'mc' };

const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'PartsWarranty', name: 'Warranty', icon: 'shield-alt', iconSet: 'fa' },
  { id: 'ServiceHistory', name: 'History', icon: 'history', iconSet: 'fa' },
  { id: 'NearbyPlaces', name: 'Nearby', icon: 'map-marker-alt', iconSet: 'fa' },
  { id: 'CheckChallan', name: 'Challan', icon: 'gavel', iconSet: 'fa' },
  { id: 'FuelStations', name: 'Fuel', icon: 'gas-station', iconSet: 'mc' },
  { id: 'ChargingStation', name: 'EV Charge', icon: 'ev-station', iconSet: 'mc' },
  { id: 'Mechanics', name: 'Mechanic', icon: 'wrench', iconSet: 'fa' },
  { id: 'CarWash', name: 'Car Wash', icon: 'car-wash', iconSet: 'mc' },
  { id: 'RTO', name: 'RTO', icon: 'landmark', iconSet: 'fa' },
  { id: 'Towing', name: 'Towing', icon: 'truck-pickup', iconSet: 'fa' },
  { id: 'Parking', name: 'Parking', icon: 'parking', iconSet: 'fa' },
  { id: 'Insurance', name: 'Insurance', icon: 'shield-check', iconSet: 'mc' },
];

const CATEGORIES: { title: string; itemIds: ServiceId[] }[] = [
  { title: 'Vehicle & Warranty', itemIds: ['PartsWarranty', 'ServiceHistory', 'Mechanics', 'CarWash'] },
  { title: 'Information & RTO', itemIds: ['CheckChallan', 'RTO', 'Insurance', 'Towing'] },
  { title: 'Nearby & Utilities', itemIds: ['NearbyPlaces', 'FuelStations', 'ChargingStation', 'Parking'] },
];

const ADS_DATA = [
  {
    id: '1',
    title: 'Traffic Challans',
    subtitle: 'Check & Settle Fines',
    desc: 'Avoid late fees and court visits. Check your vehicle status now.',
    theme: '#fbbf24',
    icon: 'gavel',
    target: 'CheckChallan',
  },
  {
    id: '2',
    title: 'Smart Parking',
    subtitle: 'Find Spots Nearby',
    desc: 'Tired of searching? Locate premium parking spots in seconds.',
    theme: '#60a5fa',
    icon: 'parking',
    target: 'Parking',
  },
  {
    id: '3',
    title: 'Expert Mechanics',
    subtitle: 'Book a Service',
    desc: 'Trusted repairs and transparent pricing for your vehicle care.',
    theme: '#94a3b8',
    icon: 'wrench',
    target: 'Mechanics', 
  },
  {
    id: '4',
    title: 'Warranty Guard',
    subtitle: 'Protection Plan',
    desc: 'Keep track of your parts and warranty status with smart alerts.',
    theme: '#4ade80',
    icon: 'shield-alt',
    target: 'WarrantyStatus',
  },
];

const getItemById = (id: ServiceId) => SERVICE_ITEMS.find((i) => i.id === id)!;

export default function ServicesHub() {
  const navigation = useNavigation<any>();
  const [adIndex, setAdIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = (adIndex + 1) % ADS_DATA.length;
      setAdIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [adIndex]);

  const onServicePress = (id: string) => {
    switch (id) {
      case 'PartsWarranty':
      case 'WarrantyStatus':
        navigation.navigate('WarrantyStatus');
        break;
      case 'ServiceHistory':
        navigation.navigate('ServiceHistory');
        break;
      case 'NearbyPlaces':
        navigation.navigate('NearbyPlaces');
        break;
      case 'CheckChallan':
        navigation.navigate('CheckChallan');
        break;
      case 'Parking':
        navigation.navigate('NearbyPlaces', { placeType: 'Parking' });
        break;
      case 'Mechanics':
        navigation.navigate('NearbyPlaces', { placeType: 'Mechanics' });
        break;
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Our Services</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Ad Carousel */}
        <View style={styles.adsWrapper}>
          <FlatList
            ref={flatListRef}
            data={ADS_DATA}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / wp(90));
              setAdIndex(index);
            }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.adCard}
                activeOpacity={0.9}
                onPress={() => onServicePress(item.target)}
              >
                <View style={styles.adContent}>
                  <View style={styles.adLeft}>
                    <Text style={[styles.adSubtitle, { color: item.theme }]}>{item.subtitle}</Text>
                    <Text style={styles.adTitle}>{item.title}</Text>
                    <Text style={styles.adDesc} numberOfLines={2}>{item.desc}</Text>
                    <View style={styles.tryNowBtn}>
                      <Text style={[styles.tryNowText, { color: item.theme }]}>Try Now</Text>
                      <Icon name="chevron-right" size={10} color={item.theme} />
                    </View>
                  </View>
                  <View style={styles.adRight}>
                    <View style={[styles.adIconCircle, { backgroundColor: `${item.theme}20` }]}>
                       <Icon name={item.icon} size={wp(10)} color={item.theme} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            )}
          />
          {/* Indicators */}
          <View style={styles.indicators}>
            {ADS_DATA.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  adIndex === i ? { backgroundColor: '#fff', width: 14 } : { backgroundColor: '#444' }
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {CATEGORIES.map((cat) => (
            <View key={cat.title} style={styles.categoryWrap}>
              <Text style={styles.categoryTitle}>{cat.title}</Text>
              <View style={styles.row}>
                {cat.itemIds.map((id) => {
                  const item = getItemById(id);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.button}
                      onPress={() => onServicePress(item.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.iconBox}>
                        {item.iconSet === 'mc' ? (
                          <IconMC name={item.icon as any} size={wp(5.8)} color="#fff" />
                        ) : (
                          <Icon name={item.icon as any} size={wp(5.8)} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.label} numberOfLines={1}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.infoRow}>
          <Icon name="info-circle" size={wp(3)} color="#444" />
          <Text style={styles.infoText}>More services coming soon</Text>
        </View>
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
    flex: 1,
    fontSize: wp(5.5),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp(3),
  },
  scrollContent: {
    paddingBottom: hp(4),
  },
  adsWrapper: {
    marginBottom: hp(2),
    paddingHorizontal: wp(5),
  },
  adCard: {
    width: wp(90),
    height: hp(18),
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: wp(5),
    overflow: 'hidden',
  },
  adContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adLeft: {
    flex: 1.5,
  },
  adSubtitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  adTitle: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(5),
    color: '#fff',
    marginBottom: 4,
  },
  adDesc: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.8),
    color: '#888',
    lineHeight: 16,
    marginBottom: 10,
  },
  tryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tryNowText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  adRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  adIconCircle: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 4,
    width: 6,
    borderRadius: 2,
  },
  content: {
    paddingHorizontal: wp(6),
    paddingTop: hp(2),
  },
  categoryWrap: {
    marginBottom: hp(3),
  },
  categoryTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    color: '#aaa',
    marginBottom: hp(2),
    paddingLeft: 2,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(4.5),
  },
  button: {
    width: (wp(100) - wp(12) - wp(13.5)) / 4,
    alignItems: 'center',
    marginBottom: hp(1),
  },
  iconBox: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(4),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  label: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#fff',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: hp(2),
    opacity: 0.5,
  },
  infoText: {
    color: '#444',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
  },
});
