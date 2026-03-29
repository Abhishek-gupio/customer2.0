import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, FlatList, Linking } from 'react-native';
import { Bike, Car, Train, Info, Star, ArrowUpDown, MapPin, Navigation } from 'lucide-react-native';
import { PlanningState, SelectedTransportDetails } from '../tripPlannerTypes';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { placesService, NearbyPlace } from '../../../services/placesService';
import { decodePolyline } from '../../../utils/polyline';
import { tripPlannerAnalytics } from '../../../services/analytics';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
  selectedRouteIndex?: number;
}

type TransportCategory = 'all' | 'bikes' | 'cars' | 'cabs' | 'personal';

const CATEGORIES: { id: TransportCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bikes', label: 'Bike Rental' },
  { id: 'cars', label: 'Car Rental' },
  { id: 'cabs', label: 'Cabs' },
  { id: 'personal', label: 'Personal' },
] ;

type SortMode = 'price_low' | 'distance' | 'rating';

type TransportOption = {
  id: string;
  name: string;
  type: string;
  category: Exclude<TransportCategory, 'all'>;
  priceLabel: string;
  priceVal: number;
  icon: any;
  image?: string;
  rating?: number;
  ratingCount?: number;
  distanceKm?: number;
  distanceText?: string;
  latitude?: number;
  longitude?: number;
  openNow?: boolean;
  source: 'default' | 'nearby';
};

const CAR_RENTAL_RANGE_BY_PRICE_LEVEL: Record<number, { min: number; max: number }> = {
  1: { min: 1800, max: 2800 },
  2: { min: 2600, max: 4200 },
  3: { min: 4200, max: 6200 },
  4: { min: 6200, max: 9000 },
};

const BIKE_RENTAL_RANGE_BY_PRICE_LEVEL: Record<number, { min: number; max: number }> = {
  1: { min: 350, max: 700 },
  2: { min: 700, max: 1300 },
  3: { min: 1300, max: 1900 },
  4: { min: 1900, max: 2700 },
};

const getRentalEstimate = (isBike: boolean, priceLevel?: number) => {
  const map = isBike ? BIKE_RENTAL_RANGE_BY_PRICE_LEVEL : CAR_RENTAL_RANGE_BY_PRICE_LEVEL;
  const fallback = isBike ? { min: 700, max: 1400 } : { min: 2600, max: 4600 };
  return (priceLevel && map[priceLevel]) || fallback;
};

const buildTransportDirectionsUrl = (item: TransportOption, city: string) => {
  const query = item.source === 'nearby'
    ? [item.name, city].filter(Boolean).join(' ').trim()
    : city;
  const destination = item.latitude != null && item.longitude != null
    ? `${item.latitude},${item.longitude}`
    : query;
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    destination,
  });
  if (item.source === 'nearby' && item.id) params.set('destination_place_id', item.id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildTransportSearchUrl = (item: TransportOption, city: string) => {
  const query = item.source === 'nearby'
    ? [item.name, city].filter(Boolean).join(' ').trim()
    : city;
  if (item.source === 'nearby' && item.id) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(item.id)}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
};

const TransportOptions = ({ planning, onChange, tripResult, selectedRouteIndex }: Props) => {
  const [rentals, setRentals] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TransportCategory>('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortMode>('price_low');
  const stayDays = Math.max(planning.stayDays || 1, 1);
  const totalBudget = planning.budget || 0;
  const hasCategoryBudget = (planning.transportBudget || 0) > 0;
  const transportBudget = hasCategoryBudget ? (planning.transportBudget || 0) : totalBudget;
  const dailyTransportBudget = transportBudget > 0 ? Math.round(transportBudget / stayDays) : 0;

  useEffect(() => {
    fetchRentals();
  }, [tripResult]);

  const fetchRentals = async () => {
    const route =
      tripResult?.routes?.[selectedRouteIndex ?? planning.selectedRouteIndex ?? 0] ||
      tripResult?.cheapestRoute ||
      tripResult?.routes?.[0];
    if (!route?.polyline) return;

    setLoading(true);
    try {
      const coords = decodePolyline(route.polyline);
      const dest = coords[coords.length - 1];
      
      const [cars, bikes] = await Promise.all([
        placesService.getNearby(dest.latitude, dest.longitude, 'car_rental'),
        placesService.getNearby(dest.latitude, dest.longitude, 'bicycle_store')
      ]);
      
      setRentals([...cars, ...bikes]);
    } catch (e) {
      console.warn('Failed to fetch transport options', e);
    } finally {
      setLoading(false);
    }
  };

  const defaultOptions: TransportOption[] = [
    {
      id: 'personal',
      name: 'Personal Vehicle',
      type: 'Self drive',
      category: 'personal',
      priceLabel: 'Free',
      priceVal: 0,
      icon: Car,
      openNow: true,
      source: 'default',
    },
    {
      id: 'cab_1',
      name: 'App Cab Estimate',
      type: 'Local cab (base + dynamic pricing)',
      category: 'cabs',
      priceLabel: '₹250 - ₹900 / ride',
      priceVal: 250,
      icon: Car,
      openNow: true,
      source: 'default',
    },
    {
      id: 'public_1',
      name: 'Metro / Bus Pass',
      type: 'City public transport',
      category: 'cabs',
      priceLabel: '₹80 - ₹200 / day',
      priceVal: 80,
      icon: Train,
      openNow: true,
      source: 'default',
    },
  ];

  const rentalOptions: TransportOption[] = useMemo(() => {
    return rentals.map((r) => {
      const nameStr = r.name.toLowerCase();
      const isBike = nameStr.includes('bike') || nameStr.includes('cycle') || nameStr.includes('scooter');
      const estimate = getRentalEstimate(isBike, r.priceLevel);

      return {
        id: r.placeId,
        name: r.name,
        type: r.address || 'Local rental shop',
        category: isBike ? 'bikes' : 'cars',
        priceLabel: `₹${estimate.min.toLocaleString('en-IN')} - ₹${estimate.max.toLocaleString('en-IN')} / day`,
        priceVal: estimate.min,
        icon: isBike ? Bike : Car,
        image: r.imageUrl,
        rating: r.rating,
        ratingCount: r.ratingCount,
        distanceKm: r.distanceKm,
        distanceText: r.distanceText,
        latitude: r.latitude,
        longitude: r.longitude,
        openNow: r.openNow,
        source: 'nearby',
      };
    });
  }, [rentals]);

  const allItems = useMemo(() => [...defaultOptions, ...rentalOptions], [rentalOptions]);

  const baseFiltered = useMemo(() => {
    return allItems.filter((opt) => {
      const matchesBudget = transportBudget === 0 || opt.priceVal === 0 || opt.priceVal <= dailyTransportBudget;
      const matchesOpenNow = !openNowOnly || opt.openNow === true;
      return matchesBudget && matchesOpenNow;
    });
  }, [allItems, transportBudget, dailyTransportBudget, openNowOnly]);

  const getCategoryCount = (id: TransportCategory) => {
    if (id === 'all') return baseFiltered.length;
    return baseFiltered.filter((item) => item.category === id).length;
  };

  const filteredOptions = useMemo(() => {
    const scoped = baseFiltered.filter((opt) => selectedCategory === 'all' || opt.category === selectedCategory);
    return scoped.sort((a, b) => {
      if (sortBy === 'distance') {
        if (a.distanceKm == null && b.distanceKm == null) return a.priceVal - b.priceVal;
        if (a.distanceKm == null) return 1;
        if (b.distanceKm == null) return -1;
        if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
        return a.priceVal - b.priceVal;
      }
      if (sortBy === 'rating') {
        if ((a.rating || 0) !== (b.rating || 0)) return (b.rating || 0) - (a.rating || 0);
        return (b.ratingCount || 0) - (a.ratingCount || 0);
      }
      if (a.priceVal !== b.priceVal) return a.priceVal - b.priceVal;
      if (a.distanceKm == null && b.distanceKm == null) return 0;
      if (a.distanceKm == null) return 1;
      if (b.distanceKm == null) return -1;
      return a.distanceKm - b.distanceKm;
    });
  }, [baseFiltered, selectedCategory, sortBy]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Finding rental providers near your destination...</Text>
        </View>
      ) : null}
      <View style={styles.catHeader}>
        <Text style={styles.label}>Explore Categories</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {transportBudget > 0
              ? `Daily ${hasCategoryBudget ? 'transport' : 'budget'} cap: ₹${dailyTransportBudget.toLocaleString('en-IN')}`
              : 'No budget filter'}
          </Text>
          <TouchableOpacity
            style={[styles.filterChip, openNowOnly && styles.filterChipActive]}
            onPress={() => setOpenNowOnly((prev) => !prev)}
          >
            <Text style={[styles.filterChipText, openNowOnly && styles.filterChipTextActive]}>Open Now</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sortRow}>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'price_low' && styles.sortChipActive]}
            onPress={() => setSortBy('price_low')}
          >
            <ArrowUpDown size={11} color={sortBy === 'price_low' ? '#000' : '#888'} />
            <Text style={[styles.sortChipText, sortBy === 'price_low' && styles.sortChipTextActive]}>Lowest Price</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'distance' && styles.sortChipActive]}
            onPress={() => setSortBy('distance')}
          >
            <MapPin size={11} color={sortBy === 'distance' ? '#000' : '#888'} />
            <Text style={[styles.sortChipText, sortBy === 'distance' && styles.sortChipTextActive]}>Nearest</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortChip, sortBy === 'rating' && styles.sortChipActive]}
            onPress={() => setSortBy('rating')}
          >
            <Star size={11} color={sortBy === 'rating' ? '#000' : '#888'} fill={sortBy === 'rating' ? '#000' : 'transparent'} />
            <Text style={[styles.sortChipText, sortBy === 'rating' && styles.sortChipTextActive]}>Top Rated</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={CATEGORIES}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.catList}
          renderItem={({ item }: { item: typeof CATEGORIES[0] }) => (
            <TouchableOpacity 
              style={[styles.catChip, selectedCategory === item.id && styles.activeChip]}
              onPress={() => setSelectedCategory(item.id)}
            >
              <Text style={[styles.catLabel, selectedCategory === item.id && styles.activeCatLabel]}>
                {item.label} ({getCategoryCount(item.id)})
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((item: TransportOption) => {
            const IconComp = item.icon;
            const isSelected = planning.selectedBikeId === item.id;
            const destinationCity = (tripResult?.to || '').split(',')[0]?.trim() || '';
            const canNavigate = (item.source === 'nearby' && item.latitude != null && item.longitude != null) || !!destinationCity;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, isSelected && styles.selectedCard]}
                onPress={() => {
                  const selectedTransportDetails: SelectedTransportDetails = {
                    id: item.id,
                    name: item.name,
                    category: item.category,
                    type: item.type,
                    source: item.source,
                    image: item.image,
                    priceLabel: item.priceLabel,
                    priceVal: item.priceVal,
                    distanceText: item.distanceText,
                    rating: item.rating,
                    openNow: item.openNow,
                    latitude: item.latitude,
                    longitude: item.longitude,
                  };
                  onChange({
                    selectedBikeId: item.id,
                    selectedTransportDetails,
                  });
                  tripPlannerAnalytics.transportSelected({
                    option_id: item.id,
                    category: item.category,
                    price: item.priceVal,
                    source: item.source,
                  });
                }}
              >
                {item.image ? (
                   <Image source={{ uri: item.image }} style={styles.rentalImage} />
                ) : (
                  <View style={styles.iconBox}>
                    <IconComp size={24} color="#FFD700" />
                  </View>
                )}
                
                <View style={styles.details}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.type} numberOfLines={1}>{item.type}</Text>
                  {item.distanceText ? (
                    <Text style={styles.distanceText}>Distance: {item.distanceText}</Text>
                  ) : null}
                  {item.openNow !== undefined ? (
                    <Text style={[styles.openStatus, item.openNow === false && styles.closedStatus]}>
                      {item.openNow ? 'Open now' : 'Closed now'}
                    </Text>
                  ) : null}
                  {item.rating && (
                    <View style={styles.ratingRow}>
                      <Star size={10} color="#FFD700" fill="#FFD700" />
                      <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                      {item.ratingCount ? <Text style={styles.ratingCountText}>({item.ratingCount})</Text> : null}
                    </View>
                  )}
                  {canNavigate ? (
                    <View style={styles.navigationRow}>
                      <TouchableOpacity
                        style={styles.navigateBtn}
                        onPress={(event) => {
                          event.stopPropagation();
                          const openMaps = async () => {
                            const dirUrl = buildTransportDirectionsUrl(item, destinationCity);
                            const fallbackUrl = buildTransportSearchUrl(item, destinationCity);
                            try {
                              await Linking.openURL(dirUrl);
                            } catch (e) {
                              console.warn('Failed to open transport directions URL, trying fallback', e);
                              try {
                                await Linking.openURL(fallbackUrl);
                              } catch (fallbackErr) {
                                console.error('Failed to open transport fallback map URL', fallbackErr);
                              }
                            }
                          };
                          openMaps();
                        }}
                      >
                        <Navigation size={11} color="#000" />
                        <Text style={styles.navigateBtnText}>Navigate</Text>
                      </TouchableOpacity>
                      <Text style={styles.navigateMetaText}>Current location auto-used</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.price}>{item.priceLabel}</Text>
                  {item.source === 'nearby' ? <Text style={styles.priceSub}>Estimated</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Bike size={40} color="#FFD700" />
            <Text style={styles.emptyText}>
              No transport options found with current filters. Try turning off "Open Now" or increasing budget.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.infoBox}>
        <Info size={16} color="#888" />
        <Text style={styles.infoText}>
          Prices are estimated ranges and may vary by vendor, season, and time of booking.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, paddingTop: 2 },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  catHeader: { marginBottom: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  metaText: { color: '#666', fontSize: 11, fontWeight: '600' },
  filterChip: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#151515',
  },
  filterChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  filterChipText: { color: '#bbb', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#000' },
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortChipActive: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  sortChipText: { color: '#888', fontSize: 11, fontWeight: '700' },
  sortChipTextActive: { color: '#000' },
  catList: { paddingRight: 20 },
  catChip: {
    backgroundColor: '#111',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#222',
  },
  activeChip: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  catLabel: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  activeCatLabel: { color: '#000' },
  label: { color: '#888', fontSize: 11, fontWeight: 'bold', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 15,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#222',
  },
  selectedCard: { borderColor: '#FFD700', borderWidth: 1.5 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentalImage: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#222',
  },
  details: { flex: 1, marginLeft: 16 },
  name: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  type: { color: '#888', fontSize: 12, marginTop: 2 },
  distanceText: { color: '#777', fontSize: 11, marginTop: 3 },
  openStatus: { color: '#32D74B', fontSize: 11, fontWeight: '700', marginTop: 3 },
  closedStatus: { color: '#FF9F0A' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  ratingCountText: { color: '#666', fontSize: 10 },
  navigationRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  navigateBtnText: { color: '#000', fontSize: 10, fontWeight: '800' },
  navigateMetaText: { color: '#666', fontSize: 9, flex: 1, textAlign: 'right' },
  priceBox: { alignItems: 'flex-end', marginLeft: 10 },
  price: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textAlign: 'right' },
  priceSub: { color: '#666', fontSize: 10, marginTop: 3 },
  infoBox: { flexDirection: 'row', gap: 10, marginTop: 20, alignItems: 'center' },
  infoText: { color: '#888', fontSize: 12, flex: 1 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    lineHeight: 20,
  },
});

export default TransportOptions;
