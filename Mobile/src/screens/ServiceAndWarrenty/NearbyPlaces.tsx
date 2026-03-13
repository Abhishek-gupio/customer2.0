import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';

type PlaceType =
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

const PLACE_LABELS: Record<string, string> = {
  FuelStations: 'Fuel Stations',
  Hospital: 'Hospital',
  PoliceStation: 'Police Station',
  Hotel: 'Hotel',
  ChargingStation: 'Charging Station',
  Mechanics: 'Mechanics',
  RTO: 'RTO',
  Towing: 'Towing',
  CarWash: 'Car Wash',
  Insurance: 'Insurance',
  Parking: 'Parking',
  TyreShop: 'Tyre Shop',
  DocumentServices: 'Document Services',
  CarSpa: 'Car Spa',
};

type PlaceItem = { id: PlaceType; name: string; icon: string; iconSet: 'fa' | 'mc' };

const PLACE_ITEMS: PlaceItem[] = [
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

const getPlaceById = (id: PlaceType) => PLACE_ITEMS.find((i) => i.id === id)!;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const NEARBY_CATEGORIES: { title: string; itemIds: PlaceType[] }[] = [
  { title: 'Fuel & charging', itemIds: ['FuelStations', 'ChargingStation'] },
  { title: 'Repair & service', itemIds: ['Mechanics', 'TyreShop', 'CarWash', 'CarSpa', 'Towing'] },
  { title: 'Emergency & safety', itemIds: ['Hospital', 'PoliceStation'] },
  { title: 'Stay & parking', itemIds: ['Hotel', 'Parking'] },
  { title: 'RTO & documents', itemIds: ['RTO', 'DocumentServices', 'Insurance'] },
];

export default function NearbyPlaces() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const placeType = route.params?.placeType as PlaceType | undefined;
  const title = placeType ? PLACE_LABELS[placeType] || 'Nearby' : 'Nearby Places';
  const isBrowse = !placeType;

  const onPlacePress = (id: PlaceType) => {
    navigation.push('NearbyPlaces', { placeType: id });
  };

  if (!isBrowse) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={wp(5)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <View style={styles.placeholder}>
          <Icon name="map-marker-alt" size={wp(20)} color="#333" />
          <Text style={styles.placeholderTitle}>Coming soon</Text>
          <Text style={styles.placeholderText}>
            Nearby {title.toLowerCase()} will show here. We're working on it.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {NEARBY_CATEGORIES.map((cat) => {
            const items = cat.itemIds.map((id) => getPlaceById(id));
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
                          onPress={() => onPlacePress(item.id)}
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
                      {row.length < 4 &&
                        Array.from({ length: 4 - row.length }).map((_, i) => (
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
  },
  headerTitle: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
  },
  scrollContent: {
    paddingTop: hp(2),
    paddingBottom: hp(4),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
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
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(8),
  },
  placeholderTitle: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginTop: hp(2),
  },
  placeholderText: {
    fontSize: wp(4),
    color: '#888',
    textAlign: 'center',
    marginTop: hp(1),
  },
});
