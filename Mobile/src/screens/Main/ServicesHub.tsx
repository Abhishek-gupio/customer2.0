import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';

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
  | 'CarSpa'
  | 'TripExpense';

type ServiceItem = { id: ServiceId; name: string; icon: string; iconSet: 'fa' | 'mc' };

const SERVICE_ITEMS: ServiceItem[] = [
  { id: 'PartsWarranty', name: 'Vehicle Health', icon: 'shield-alt', iconSet: 'fa' },
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
  { id: 'TripExpense', name: 'Trip Cost', icon: 'map-signs', iconSet: 'fa' },
];

const CATEGORIES: { title: string; itemIds: ServiceId[]; color: string }[] = [
  { title: 'Vehicle Health & Care', itemIds: ['PartsWarranty', 'ServiceHistory', 'Mechanics', 'CarWash'], color: '#ef4444' }, // Red
  { title: 'Information & RTO', itemIds: ['CheckChallan', 'RTO', 'Insurance', 'Towing'], color: '#FFBF00' }, // Yellow
  { title: 'Nearby & Utilities', itemIds: ['NearbyPlaces', 'FuelStations', 'ChargingStation', 'Parking'], color: '#22c55e' }, // Green
  { title: 'Travel & Planning', itemIds: ['TripExpense'], color: '#6366f1' }, // Indigo
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
    title: 'Vehicle Health',
    subtitle: 'Smart Tracking',
    desc: 'Monitor your vehicle health score and parts lifecycle easily.',
    theme: '#4ade80',
    icon: 'heartbeat',
    target: 'WarrantyStatus',
  },
];

const getItemById = (id: ServiceId) => SERVICE_ITEMS.find((i) => i.id === id)!;

const NEARBY_PLACE_SERVICE_IDS: ServiceId[] = [
  'FuelStations',
  'Hospital',
  'PoliceStation',
  'Hotel',
  'ChargingStation',
  'Mechanics',
  'RTO',
  'Towing',
  'CarWash',
  'Insurance',
  'Parking',
  'TyreShop',
  'DocumentServices',
  'CarSpa',
];

export default function ServicesHub() {
  const navigation = useNavigation<any>();
  const [adIndex, setAdIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
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
    if (NEARBY_PLACE_SERVICE_IDS.includes(id as ServiceId)) {
      navigation.navigate('NearbyPlaces', { placeType: id });
      return;
    }

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
      case 'TripExpense':
        navigation.navigate('TripExpense');
        break;
      default:
        break;
    }
  };

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCategories = CATEGORIES.map((cat) => {
    const filteredIds = cat.itemIds.filter((id) => {
      const item = getItemById(id);
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        cat.title.toLowerCase().includes(normalizedSearch)
      );
    });
    return { ...cat, itemIds: filteredIds };
  }).filter((cat) => cat.itemIds.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Services Hub</Text>
          <Text style={styles.headerSubtitle}>Explore automotive care & utilities</Text>
        </View>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            if (isSearchVisible && searchQuery.trim().length > 0) {
              setSearchQuery('');
              return;
            }
            setIsSearchVisible((prev) => !prev);
          }}
        >
          <IconMC
            name={isSearchVisible && searchQuery.trim().length > 0 ? 'close' : 'magnify'}
            size={wp(5.5)}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {isSearchVisible ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchInputWrap}>
            <IconMC name="magnify" size={wp(4.5)} color="rgba(255,255,255,0.45)" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search services..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.searchInput}
              autoFocus
            />
          </View>
        </View>
      ) : null}

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
          {filteredCategories.map((cat) => (
            <View key={cat.title} style={styles.categoryWrap}>
              <Text style={[styles.categoryTitle, { borderLeftColor: cat.color }]}>{cat.title}</Text>
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
                      <Text style={styles.label} numberOfLines={2}>{item.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
          {normalizedSearch && filteredCategories.length === 0 ? (
            <View style={styles.emptySearchState}>
              <IconMC name="magnify-close" size={wp(8)} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptySearchTitle}>No services found</Text>
              <Text style={styles.emptySearchText}>Try a different keyword like warranty, fuel, parking, or challan.</Text>
            </View>
          ) : null}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingTop: hp(4),
    paddingBottom: hp(2),
  },
  headerTitle: {
    fontSize: wp(6.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  headerIcon: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    paddingBottom: hp(4),
  },
  searchWrap: {
    paddingHorizontal: wp(6),
    paddingBottom: hp(1.5),
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    padding: 0,
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
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
  },
  categoryWrap: {
    marginBottom: hp(3),
  },
  categoryTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    color: '#fff',
    marginBottom: hp(2),
    paddingLeft: wp(3),
    borderLeftWidth: 3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: wp(2.5),
  },
  button: {
    width: wp(20),
    alignItems: 'center',
    marginBottom: hp(2),
  },
  iconBox: {
    width: wp(14.5),
    height: wp(14.5),
    borderRadius: wp(4.5),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
  emptySearchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(5),
    paddingHorizontal: wp(8),
  },
  emptySearchTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    marginTop: hp(1.2),
  },
  emptySearchText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    marginTop: hp(0.8),
    lineHeight: 18,
  },
});
