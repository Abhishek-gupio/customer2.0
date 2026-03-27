import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image, FlatList } from 'react-native';
import { Bike, Car, Train, Info, AlertTriangle, Star } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { placesService, NearbyPlace } from '../../../services/placesService';
import { decodePolyline } from '../../../utils/polyline';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'bikes', label: 'Bike Rental' },
  { id: 'cars', label: 'Car Rental' },
  { id: 'cabs', label: 'Cabs' },
  { id: 'personal', label: 'Personal' },
];

const TransportOptions = ({ planning, onChange, tripResult }: Props) => {
  const [rentals, setRentals] = useState<NearbyPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchRentals();
  }, [tripResult]);

  const fetchRentals = async () => {
    const route = tripResult?.routes?.[0];
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

  const defaultOptions = [
    { id: 'personal', name: 'Personal Vehicle', type: 'Self Drive', category: 'personal', price: 'Free', priceVal: 0, icon: Car },
    { id: 'cab_1', name: 'Uber/Ola Estimate', type: 'Local Cab', category: 'cabs', price: '₹200 - ₹500', priceVal: 200, icon: Car },
    { id: 'public_1', name: 'Metro / Bus Pass', type: 'Public Transport', category: 'cabs', price: '₹50/day', priceVal: 50, icon: Train },
  ];

  const rentalOptions = rentals.map(r => {
    const nameStr = r.name.toLowerCase();
    const isBike = nameStr.includes('bike') || nameStr.includes('cycle') || nameStr.includes('scooter');
    return {
      id: r.placeId,
      name: r.name,
      type: r.address || 'Local Rental',
      category: isBike ? 'bikes' : 'cars',
      price: 'Rental Shop',
      priceVal: 1000,
      icon: isBike ? Bike : Car,
      image: r.imageUrl,
      rating: r.rating
    };
  });

  const allItems = [...defaultOptions, ...rentalOptions];

  const getCategoryCount = (id: string) => {
    if (id === 'all') return allItems.length;
    return allItems.filter(item => item.category === id).length;
  };

  const filteredOptions = allItems.filter(opt => {
    const matchesCategory = selectedCategory === 'all' || opt.category === selectedCategory;
    const matchesBudget = planning.budget === 0 || opt.priceVal <= planning.budget;
    return matchesCategory && matchesBudget;
  });

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
          filteredOptions.map((item: any) => {
            const IconComp = item.icon;
            const isSelected = planning.selectedBikeId === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[styles.optionCard, isSelected && styles.selectedCard]}
                onPress={() => onChange({ selectedBikeId: item.id })}
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
                  {item.rating && (
                    <View style={styles.ratingRow}>
                      <Star size={10} color="#FFD700" fill="#FFD700" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.priceBox}>
                  <Text style={styles.price}>{item.price}</Text>
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyContainer}>
            <Bike size={40} color="#FFD700" />
            <Text style={styles.emptyText}>No transport options found. Try adjusting your budget.</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.infoBox}>
        <Info size={16} color="#888" />
        <Text style={styles.infoText}>Rental availability depends on location providers.</Text>
      </View>
    </View>
  );
  };

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
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
  catHeader: { marginBottom: 20 },
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
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  ratingText: { color: '#FFD700', fontSize: 10, fontWeight: 'bold' },
  priceBox: { alignItems: 'flex-end', marginLeft: 10 },
  price: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  infoBox: { flexDirection: 'row', gap: 10, marginTop: 20, alignItems: 'center' },
  infoText: { color: '#888', fontSize: 12 },
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
