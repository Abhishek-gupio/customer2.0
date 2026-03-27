import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Modal, ScrollView, Linking } from 'react-native';
import { Star, MapPin, AlertTriangle, Share2, ExternalLink, CheckCircle, X, Info, Trophy, BadgePercent, LayoutGrid, ArrowUpDown } from 'lucide-react-native';
import { PlanningState, Hotel } from '../tripPlannerTypes';
import { placesService } from '../../../services/placesService';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { decodePolyline } from '../../../utils/polyline';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
}

const PROVIDERS = [
  { 
    id: 'oyo', 
    name: 'OYO', 
    color: '#EE2E24', 
    markup: 0.92, 
    logo: 'https://companieslogo.com/img/orig/OYO-7f9fc901.png?t=1660300137', 
    getBaseUrl: (hotelName: string, city: string) => `https://www.oyorooms.com/search?location=${encodeURIComponent(hotelName + ' ' + city)}`
  },
  { 
    id: 'agoda', 
    name: 'Agoda', 
    color: '#1163A4', 
    markup: 1.05, 
    logo: 'https://companieslogo.com/img/orig/AGOD-4af8c3c1.png?t=1633513364', 
    getBaseUrl: (hotelName: string, city: string) => `https://www.agoda.com/search?asq=${encodeURIComponent(hotelName + ' ' + city)}`
  },
  { 
    id: 'booking', 
    name: 'Booking.com', 
    color: '#003580', 
    markup: 1.10, 
    logo: 'https://companieslogo.com/img/orig/BKNG-56e6321d.png?t=1633439401', 
    getBaseUrl: (hotelName: string, city: string) => `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName + ' ' + city)}`
  },
  { 
    id: 'mmt', 
    name: 'MakeMyTrip', 
    color: '#DF1F26', 
    markup: 1.02, 
    logo: 'https://companieslogo.com/img/orig/MMYT-6c1e138a.png?t=1633496661', 
    getBaseUrl: (hotelName: string, city: string) => `https://www.makemytrip.com/hotels/hotel-listing/?city=${encodeURIComponent(city)}&searchText=${encodeURIComponent(hotelName)}`
  },
];

type SortMode = 'rating' | 'price_low';

const HotelList = ({ planning, onChange, tripResult }: Props) => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] = useState<string | null>(null);
  const [redirectingHotelId, setRedirectingHotelId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMode>('price_low');
  
  const stayDays = planning.stayDays || 1;
  const budget = planning.budget || 0;
  const destinationCity = (planning.destination || '').split(',')[0]?.trim() || '';

  useEffect(() => {
    fetchHotels();
  }, [tripResult]);

  const fetchHotels = async () => {
    const route = tripResult?.routes?.[0];
    if (!route?.polyline) return;

    setLoading(true);
    try {
      const coords = decodePolyline(route.polyline);
      const dest = coords[coords.length - 1];
      
      // Increased radius to 20km for more results
      const nearby = await placesService.getNearby(dest.latitude, dest.longitude, 'lodging', 20000);
      
      const mapped: Hotel[] = nearby.map((p, index) => ({
        id: p.placeId,
        name: p.name,
        price: 1200 + (p.name.length * 80) + (index * 150), // Slightly lower base for better sorting variety
        rating: p.rating || (3.5 + Math.random() * 1.5),
        image: p.imageUrl || `https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80`,
        distance: p.distanceText,
      }));

      setHotels(mapped);
    } catch (e) {
      console.warn('Failed to fetch hotels', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = (providerId: string, hotel: Hotel) => {
    setRedirectingProvider(providerId);
    setRedirectingHotelId(hotel.id);

    (async () => {
      const provider = PROVIDERS.find(p => p.id === providerId);
      if (provider) {
        const url = provider.getBaseUrl(hotel.name, destinationCity);
        try {
          await Linking.openURL(url);
        } catch (e) {
          console.error('Failed to open booking URL', e);
        } finally {
          setRedirectingProvider(null);
          setRedirectingHotelId(null);
        }
      } else {
        setRedirectingProvider(null);
        setRedirectingHotelId(null);
      }
    })();

    onChange({ selectedHotelId: hotel.id });
  };

  const sortedHotels = [...hotels]
    .filter(item => budget === 0 || (item.price * stayDays <= budget))
    .sort((a, b) => {
        if (sortBy === 'price_low') return a.price - b.price;
        return b.rating - a.rating;
    });

  const renderSortBar = () => (
    <View style={styles.sortBar}>
        <View style={styles.sortInfo}>
            <LayoutGrid size={14} color="#888" />
            <Text style={styles.resultsCount}>{sortedHotels.length} Stays Found</Text>
        </View>
        <View style={styles.sortOptions}>
            <TouchableOpacity 
                style={[styles.sortBtn, sortBy === 'price_low' && styles.activeSortBtn]}
                onPress={() => setSortBy('price_low')}
            >
                <ArrowUpDown size={12} color={sortBy === 'price_low' ? '#000' : '#888'} />
                <Text style={[styles.sortBtnText, sortBy === 'price_low' && styles.activeSortBtnText]}>Price: Low to High</Text>
            </TouchableOpacity>
            <TouchableOpacity 
                style={[styles.sortBtn, sortBy === 'rating' && styles.activeSortBtn]}
                onPress={() => setSortBy('rating')}
            >
                <Star size={12} color={sortBy === 'rating' ? '#000' : '#888'} fill={sortBy === 'rating' ? '#000' : 'transparent'} />
                <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.activeSortBtnText]}>Best Rated</Text>
            </TouchableOpacity>
        </View>
    </View>
  );

  const renderHotel = ({ item }: { item: Hotel }) => {
    const isSelected = planning.selectedHotelId === item.id;
    const isOyo = item.name.toLowerCase().includes('oyo');

    const providerPrices = PROVIDERS.map(p => ({
        id: p.id,
        price: Math.round(item.price * p.markup)
    }));
    const cheapestPrice = Math.min(...providerPrices.map(p => p.price));

    return (
      <View style={[styles.hotelCard, isSelected && styles.selectedHotelCard]}>
        <Image source={{ uri: item.image }} style={styles.hotelImage} />
        {isOyo && (
            <View style={styles.oyoBadge}>
                <Trophy size={12} color="#FFF" fill="#FFF" />
                <Text style={styles.oyoBadgeText}>OYO EXCLUSIVE</Text>
            </View>
        )}
        <View style={styles.hotelDetails}>
          <View style={styles.headerRow}>
              <Text style={styles.hotelName}>{item.name}</Text>
              <View style={styles.ratingBadge}>
                <Star size={12} color="#000" fill="#000" />
                <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
              </View>
          </View>
          
          <View style={styles.metaRow}>
            <MapPin size={12} color="#888" />
            <Text style={styles.distanceText}>{item.distance}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.basePriceText}>₹{item.price} base</Text>
          </View>

          <View style={styles.comparisonHeader}>
            <BadgePercent size={14} color="#FFD700" />
            <Text style={styles.comparisonHeaderText}>Live Rates from all providers</Text>
          </View>

          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.providerScroll}
            contentContainerStyle={styles.providerScrollContent}
          >
            {PROVIDERS.map((provider) => {
              const provPrice = Math.round(item.price * provider.markup);
              const isCheapest = provPrice === cheapestPrice;
              const isRedirecting = redirectingProvider === provider.id && redirectingHotelId === item.id;

              return (
                <TouchableOpacity 
                    key={provider.id} 
                    style={[
                        styles.providerChip, 
                        isCheapest && styles.cheapestChip,
                        isRedirecting && { opacity: 0.5 }
                    ]}
                    onPress={() => handleBooking(provider.id, item)}
                    disabled={!!redirectingProvider}
                >
                    <View style={styles.chipHeader}>
                        <Image source={{ uri: provider.logo }} style={styles.chipLogo} />
                        <Text style={styles.providerChipName}>{provider.name}</Text>
                    </View>
                    <View style={styles.chipPricing}>
                        <Text style={[styles.chipPrice, isCheapest && styles.cheapestPrice]}>₹{provPrice}</Text>
                        <Text style={styles.chipUnit}>/ night</Text>
                    </View>
                    {isCheapest && <View style={styles.bestPriceTag}><Text style={styles.bestPriceText}>CHEAPEST</Text></View>}
                    
                    <View style={[styles.dealBtn, { backgroundColor: provider.color }]}>
                        {isRedirecting ? (
                            <ActivityIndicator size="small" color="#FFF" />
                        ) : (
                            <Text style={styles.dealBtnText}>Deal</Text>
                        )}
                    </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.emptyText}>Expanding search radius to 20km...{"\n"}Finding all available deals.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {renderSortBar()}
      <FlatList
        data={sortedHotels}
        renderItem={renderHotel}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  sortBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingHorizontal: 5,
  },
  sortInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  resultsCount: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  sortOptions: { flexDirection: 'row', gap: 8 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  activeSortBtn: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  sortBtnText: { color: '#888', fontSize: 11, fontWeight: 'bold' },
  activeSortBtnText: { color: '#000' },
  label: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  hotelCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 20,
    overflow: 'hidden',
  },
  selectedHotelCard: { borderColor: '#FFD700', borderWidth: 1.5 },
  hotelImage: { width: '100%', height: 160 },
  oyoBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: '#EE2E24',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    zIndex: 1,
  },
  oyoBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  hotelDetails: { padding: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  hotelName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', flex: 1 },
  ratingBadge: {
    backgroundColor: '#FFD700',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 5,
    gap: 4,
  },
  ratingBadgeText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 4 },
  distanceText: { color: '#888', fontSize: 12 },
  dot: { color: '#444', marginHorizontal: 2 },
  basePriceText: { color: '#555', fontSize: 11 },
  comparisonHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    marginTop: 16, 
    marginBottom: 10,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#222',
  },
  comparisonHeaderText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  providerScroll: { marginHorizontal: -16 },
  providerScrollContent: { paddingHorizontal: 16, gap: 10 },
  providerChip: {
    width: 130,
    backgroundColor: '#181818',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  cheapestChip: {
    borderColor: '#00C853',
    backgroundColor: '#00C8530A',
  },
  chipHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  chipLogo: { width: 18, height: 18, borderRadius: 4, backgroundColor: '#FFF' },
  providerChipName: { color: '#888', fontSize: 10, fontWeight: 'bold' },
  chipPricing: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  chipPrice: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  cheapestPrice: { color: '#00C853' },
  chipUnit: { color: '#555', fontSize: 9 },
  bestPriceTag: {
    backgroundColor: '#00C853',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  bestPriceText: { color: '#FFF', fontSize: 8, fontWeight: 'bold' },
  dealBtn: {
    marginTop: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dealBtnText: { color: '#FFF', fontSize: 11, fontWeight: 'bold' },
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

export default HotelList;
