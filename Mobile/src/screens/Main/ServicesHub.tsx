import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import ServiceAdBanner from '../../components/ServiceAdBanner';

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
  { id: 'PartsWarranty', name: 'Parts & Warranty', icon: 'shield-alt', iconSet: 'fa' },
  { id: 'ServiceHistory', name: 'Service History', icon: 'history', iconSet: 'fa' },
  { id: 'NearbyPlaces', name: 'Nearby Places', icon: 'map-marker-alt', iconSet: 'fa' },
  { id: 'CheckChallan', name: 'Check Challan', icon: 'gavel', iconSet: 'fa' },
  { id: 'FuelStations', name: 'Fuel Stations', icon: 'gas-station', iconSet: 'mc' },
  { id: 'Hospital', name: 'Hospital', icon: 'hospital', iconSet: 'fa' },
  { id: 'PoliceStation', name: 'Police Station', icon: 'building', iconSet: 'fa' },
  { id: 'Hotel', name: 'Hotel', icon: 'hotel', iconSet: 'fa' },
  { id: 'ChargingStation', name: 'Charging Station', icon: 'ev-station', iconSet: 'mc' },
  { id: 'Mechanics', name: 'Mechanics', icon: 'wrench', iconSet: 'fa' },
  { id: 'RTO', name: 'RTO', icon: 'landmark', iconSet: 'fa' },
  { id: 'Towing', name: 'Towing', icon: 'truck-pickup', iconSet: 'fa' },
  { id: 'CarWash', name: 'Car Wash', icon: 'car-wash', iconSet: 'mc' },
  { id: 'Insurance', name: 'Insurance', icon: 'shield-check', iconSet: 'mc' },
  { id: 'Parking', name: 'Parking', icon: 'parking', iconSet: 'fa' },
  { id: 'TyreShop', name: 'Tyre Shop', icon: 'car-tire-alert', iconSet: 'mc' },
  { id: 'DocumentServices', name: 'Document Services', icon: 'file-document', iconSet: 'mc' },
  { id: 'CarSpa', name: 'Car Spa', icon: 'spa', iconSet: 'mc' },
];

const getItemById = (id: ServiceId) => SERVICE_ITEMS.find((i) => i.id === id)!;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Services hub: vehicle & warranty, RTO & compliance, Nearby */
const CATEGORIES: { title: string; itemIds: ServiceId[] }[] = [
  { title: 'Vehicle & warranty', itemIds: ['PartsWarranty', 'ServiceHistory'] },
  { title: 'RTO & compliance', itemIds: ['CheckChallan'] },
  { title: 'Nearby', itemIds: ['NearbyPlaces'] },
];

export default function ServicesHub() {
  const navigation = useNavigation<any>();

  const onServicePress = (id: ServiceId) => {
    switch (id) {
      case 'PartsWarranty':
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
      default:
        break;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Our Services</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Video / animated ad banner (service-related). Set videoSource={null} for static only. */}
        <View style={styles.adsBanner}>
          <ServiceAdBanner />
        </View>

        <View style={styles.section}>
          {/* <Text style={styles.sectionTitle}>Our Services</Text> */}
          {CATEGORIES.map((cat) => {
            const items = cat.itemIds.map((id) => getItemById(id));
            const rows = chunk(items, 4);
            return (
              <View key={cat.title} style={styles.categoryBlock}>
                <Text style={styles.categoryTitle}>{cat.title}</Text>
                <View style={styles.grid}>
                  {rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.row}>
                      {row.map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.card}
                          onPress={() => onServicePress(item.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.iconContainer}>
                            {item.iconSet === 'mc' ? (
                              <IconMC name={item.icon as any} size={wp(5.5)} color="#fff" />
                            ) : (
                              <Icon name={item.icon as any} size={wp(5.5)} color="#fff" />
                            )}
                          </View>
                          <Text style={styles.cardText} numberOfLines={1}>
                            {item.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                      {row.length < 4 && Array.from({ length: 4 - row.length }).map((_, i) => (
                        <View key={`pad-${i}`} style={[styles.card, styles.cardPad]} />
                      ))}
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
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
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
  },
  scrollContent: {
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  adsBanner: {
    marginBottom: hp(2.5),
    marginHorizontal: wp(5),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
    marginBottom: hp(2),
  },
  categoryBlock: {
    marginBottom: hp(2.5),
  },
  categoryTitle: {
    color: '#e0e0e0',
    fontSize: wp(4.2),
    fontWeight: '600',
    marginBottom: hp(1.2),
    textTransform: 'capitalize',
  },
  grid: {
    paddingVertical: hp(1.5),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  card: {
    alignItems: 'center',
    flex: 1,
  },
  cardPad: {
    opacity: 0,
  },
  iconContainer: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  cardText: {
    fontSize: wp(2.8),
    fontWeight: '500',
    color: '#ccc',
    textAlign: 'center',
    marginTop: hp(0.4),
  },
});
