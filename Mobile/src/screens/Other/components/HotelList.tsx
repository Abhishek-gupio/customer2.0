import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, ScrollView, Linking, Pressable } from 'react-native';
import { Star, MapPin, Trophy, BadgePercent, LayoutGrid, ArrowUpDown, Navigation } from 'lucide-react-native';
import { PlanningState, Hotel } from '../tripPlannerTypes';
import { placesService } from '../../../services/placesService';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { decodePolyline } from '../../../utils/polyline';
import { tripPlannerAnalytics } from '../../../services/analytics';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
}

type ProviderId = 'oyo' | 'agoda' | 'booking' | 'mmt';

type ProviderUrlContext = {
  hotelName: string;
  city: string;
  placeId: string;
  address?: string;
  arrivalDate?: string | null;
  departureDate?: string | null;
  adults: number;
};

type ProviderConfig = {
  id: ProviderId;
  name: string;
  color: string;
  markup: number;
  logos: string[];
  getBookingUrls: (ctx: ProviderUrlContext) => string[];
};

const DATE_INPUT_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const parseDateParts = (value?: string | null) => {
  if (!value || !DATE_INPUT_REGEX.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
};

const slugifyCity = (city: string) =>
  city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const buildStrictLuckyProviderUrl = (
  domain: string,
  hotelName: string,
  city: string,
  address?: string
) => {
  const addressSeed = (address || '').split(',')[0]?.trim();
  const strictQuery = [
    `site:${domain}`,
    hotelName ? `"${hotelName}"` : '',
    city ? `"${city}"` : '',
    addressSeed ? `"${addressSeed}"` : '',
  ].filter(Boolean).join(' ');
  return `https://www.google.com/search?btnI=I&q=${encodeURIComponent(strictQuery)}`;
};

const buildMapsPlaceUrl = (hotelName: string, city: string, placeId: string) => {
  const query = [hotelName, city].filter(Boolean).join(' ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(placeId)}`;
};

const buildMapsDirectionsUrl = (hotel: Hotel, city: string) => {
  const query = [hotel.name, city].filter(Boolean).join(' ').trim();
  const destination = hotel.latitude != null && hotel.longitude != null
    ? `${hotel.latitude},${hotel.longitude}`
    : query;

  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    destination,
  });
  if (hotel.id) params.set('destination_place_id', hotel.id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildHotelQuery = (hotelName: string, city: string) =>
  [hotelName, city].filter(Boolean).join(' ').trim();

const getProviderInitials = (name: string) => {
  const cleaned = name.replace(/[^a-zA-Z]/g, '');
  const initial = cleaned.slice(0, 2).toUpperCase();
  return initial || 'PR';
};

const PROVIDERS = [
  {
    id: 'oyo',
    name: 'OYO',
    color: '#EE2E24',
    markup: 0.92,
    logos: [
      'https://companieslogo.com/img/orig/OYO-7f9fc901.png?t=1660300137',
      'https://logo.clearbit.com/oyorooms.com?size=96',
      'https://www.google.com/s2/favicons?domain=oyorooms.com&sz=128',
    ],
    getBookingUrls: ({ hotelName, city }) => {
      const query = buildHotelQuery(hotelName, city);
      const citySlug = slugifyCity(city);
      const cityListingUrl = citySlug ? `https://www.oyorooms.com/hotels-in-${citySlug}/` : '';
      const legacySearchUrl = `https://www.oyorooms.com/search?location=${encodeURIComponent(query)}`;
      return [
        buildStrictLuckyProviderUrl('oyorooms.com', hotelName, city),
        cityListingUrl,
        legacySearchUrl,
      ].filter((url): url is string => !!url);
    },
  },
  {
    id: 'agoda',
    name: 'Agoda',
    color: '#1163A4',
    markup: 1.05,
    logos: [
      'https://companieslogo.com/img/orig/AGOD-4af8c3c1.png?t=1633513364',
      'https://logo.clearbit.com/agoda.com?size=96',
      'https://www.google.com/s2/favicons?domain=agoda.com&sz=128',
    ],
    getBookingUrls: ({ hotelName, city, adults, address }) => {
      const query = buildHotelQuery(hotelName, city);
      return [
        buildStrictLuckyProviderUrl('agoda.com', hotelName, city, address),
        `https://www.agoda.com/search?asq=${encodeURIComponent(query)}&adults=${Math.max(1, adults)}&rooms=1`,
      ];
    },
  },
  {
    id: 'booking',
    name: 'Booking.com',
    color: '#003580',
    markup: 1.10,
    logos: [
      'https://companieslogo.com/img/orig/BKNG-56e6321d.png?t=1633439401',
      'https://logo.clearbit.com/booking.com?size=96',
      'https://www.google.com/s2/favicons?domain=booking.com&sz=128',
    ],
    getBookingUrls: ({ hotelName, city, arrivalDate, departureDate, adults, address }) => {
      const query = buildHotelQuery(hotelName, city);
      const arrival = parseDateParts(arrivalDate);
      const departure = parseDateParts(departureDate);
      const travelerParams = `group_adults=${Math.max(1, adults)}&no_rooms=1&group_children=0`;
      const stayParams = arrival && departure
        ? `&checkin_year=${arrival.year}&checkin_month=${arrival.month}&checkin_monthday=${arrival.day}&checkout_year=${departure.year}&checkout_month=${departure.month}&checkout_monthday=${departure.day}`
        : '';
      return [
        buildStrictLuckyProviderUrl('booking.com', hotelName, city, address),
        `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}&${travelerParams}${stayParams}`,
      ];
    },
  },
  {
    id: 'mmt',
    name: 'MakeMyTrip',
    color: '#DF1F26',
    markup: 1.02,
    logos: [
      'https://companieslogo.com/img/orig/MMYT-6c1e138a.png?t=1633496661',
      'https://logo.clearbit.com/makemytrip.com?size=96',
      'https://www.google.com/s2/favicons?domain=makemytrip.com&sz=128',
    ],
    getBookingUrls: ({ hotelName, city, address }) => {
      const query = buildHotelQuery(hotelName, city);
      return [
        buildStrictLuckyProviderUrl('makemytrip.com', hotelName, city, address),
        `https://www.makemytrip.com/hotels/hotel-listing/?searchText=${encodeURIComponent(query)}`,
      ];
    },
  },
] as const satisfies ReadonlyArray<ProviderConfig>;

type SortMode = 'rating' | 'price_low';

const PRICE_LEVEL_TO_RANGE: Record<number, { min: number; max: number }> = {
  1: { min: 1200, max: 2500 },
  2: { min: 2500, max: 5000 },
  3: { min: 5000, max: 9000 },
  4: { min: 9000, max: 18000 },
};

const getPriceEstimate = (priceLevel?: number) => {
  if (!priceLevel) return null;
  return PRICE_LEVEL_TO_RANGE[priceLevel] || null;
};

const getPriceTierLabel = (priceLevel?: number) => {
  if (!priceLevel || priceLevel <= 0) return 'Price unavailable';
  return `Price tier: ${'₹'.repeat(Math.min(priceLevel, 4))}`;
};

const HotelList = ({ planning, onChange, tripResult }: Props) => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(false);
  const [redirectingProvider, setRedirectingProvider] = useState<string | null>(null);
  const [redirectingHotelId, setRedirectingHotelId] = useState<string | null>(null);
  const [providerLogoIndex, setProviderLogoIndex] = useState<Record<ProviderId, number>>({
    oyo: 0,
    agoda: 0,
    booking: 0,
    mmt: 0,
  });
  const [sortBy, setSortBy] = useState<SortMode>('price_low');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  
  const stayDays = planning.stayDays || 1;
  const totalBudget = planning.budget || 0;
  const hasCategoryBudget = (planning.hotelBudget || 0) > 0;
  const budget = hasCategoryBudget ? (planning.hotelBudget || 0) : totalBudget;
  const destinationCity = (tripResult?.to || '').split(',')[0]?.trim() || '';
  const nightlyBudget = budget > 0 ? Math.round(budget / stayDays) : 0;

  useEffect(() => {
    fetchHotels();
  }, [tripResult]);

  const toSelectedHotelDetails = (hotel: Hotel) => ({
    id: hotel.id,
    name: hotel.name,
    address: hotel.address,
    image: hotel.image,
    distance: hotel.distance,
    price: hotel.price,
    priceMax: hotel.priceMax,
    rating: hotel.rating,
    openNow: hotel.openNow,
    latitude: hotel.latitude,
    longitude: hotel.longitude,
  });

  const fetchHotels = async () => {
    const route = tripResult?.routes?.[0];
    if (!route?.polyline) return;

    setLoading(true);
    try {
      const coords = decodePolyline(route.polyline);
      const dest = coords[coords.length - 1];
      
      // Increased radius to 20km for more results
      const nearby = await placesService.getNearby(dest.latitude, dest.longitude, 'lodging', 20000);
      
      const mapped: Hotel[] = nearby.map((p) => {
        const estimate = getPriceEstimate(p.priceLevel);
        return {
        id: p.placeId,
        name: p.name,
        address: p.address,
        latitude: p.latitude,
        longitude: p.longitude,
        price: estimate?.min || 0,
        priceMax: estimate?.max,
        priceLevel: p.priceLevel,
        rating: p.rating || 0,
        ratingCount: p.ratingCount,
        image: p.imageUrl || `https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=400&q=80`,
        distance: p.distanceText,
        distanceKm: p.distanceKm,
        openNow: p.openNow,
      };
      });

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
        const city = destinationCity || tripResult?.to || '';
        const adults = Math.max(1, planning.numberOfPeople || 1);
        const providerUrls = provider.getBookingUrls({
          hotelName: hotel.name,
          city,
          placeId: hotel.id,
          address: hotel.address,
          arrivalDate: planning.arrivalDate,
          departureDate: planning.departureDate,
          adults,
        });
        const urlsToTry = Array.from(new Set([
          ...providerUrls,
          buildMapsPlaceUrl(hotel.name, city, hotel.id),
        ]));

        try {
          let opened = false;
          for (const url of urlsToTry) {
            try {
              await Linking.openURL(url);
              opened = true;
              break;
            } catch (openErr) {
              console.warn('Booking URL open failed, trying fallback', openErr);
            }
          }
          if (!opened) {
            throw new Error('No booking links could be opened');
          }
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

    onChange({
      selectedHotelId: hotel.id,
      selectedHotelDetails: toSelectedHotelDetails(hotel),
    });
    tripPlannerAnalytics.hotelSelected({
      provider_id: providerId,
      hotel_id: hotel.id,
      price: hotel.price || 0,
      has_budget: budget > 0,
      nightly_budget: nightlyBudget || 0,
    });
  };

  const handleNavigate = async (hotel: Hotel) => {
    const city = destinationCity || tripResult?.to || '';
    const directionsUrl = buildMapsDirectionsUrl(hotel, city);
    const fallbackUrl = buildMapsPlaceUrl(hotel.name, city, hotel.id);
    try {
      await Linking.openURL(directionsUrl);
    } catch (e) {
      console.warn('Failed to open directions URL, trying fallback', e);
      try {
        await Linking.openURL(fallbackUrl);
      } catch (fallbackErr) {
        console.error('Failed to open fallback maps URL', fallbackErr);
      }
    }
  };

  const handleProviderLogoError = (providerId: ProviderId) => {
    setProviderLogoIndex((prev) => {
      const provider = PROVIDERS.find((p) => p.id === providerId);
      if (!provider) return prev;
      const currentIndex = prev[providerId] ?? 0;
      if (currentIndex >= provider.logos.length) return prev;
      return { ...prev, [providerId]: currentIndex + 1 };
    });
  };

  const handleSelectHotel = (hotel: Hotel) => {
    onChange({
      selectedHotelId: hotel.id,
      selectedHotelDetails: toSelectedHotelDetails(hotel),
    });
  };

  const sortedHotels = [...hotels]
    .filter(item => {
      const matchesOpenNow = !openNowOnly || item.openNow === true;
      if (!matchesOpenNow) return false;
      if (budget === 0) return true;
      if (item.price === 0) return true; // keep unknown-pricing properties visible
      return item.price <= nightlyBudget;
    })
    .sort((a, b) => {
        if (sortBy === 'price_low') {
          if (a.price === 0 && b.price === 0) return (a.distanceKm || 0) - (b.distanceKm || 0);
          if (a.price === 0) return 1;
          if (b.price === 0) return -1;
          if (a.price !== b.price) return a.price - b.price;
          return (a.distanceKm || 0) - (b.distanceKm || 0);
        }
        if (a.rating !== b.rating) return b.rating - a.rating;
        return (b.ratingCount || 0) - (a.ratingCount || 0);
    });

  const renderSortBar = () => (
    <View style={styles.controlsCard}>
      <View style={styles.compactHeaderRow}>
        <View style={styles.sortInfo}>
          <LayoutGrid size={13} color="#888" />
          <Text style={styles.resultsCount}>{sortedHotels.length} stays found</Text>
          <Text style={styles.dot}>•</Text>
          <Text style={styles.metaFilterText} numberOfLines={1}>
            {budget > 0
              ? `Cap ₹${nightlyBudget.toLocaleString('en-IN')}/night`
              : 'No budget filter'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.filterChip, openNowOnly && styles.filterChipActive]}
          onPress={() => setOpenNowOnly((prev) => !prev)}
        >
          <Text style={[styles.filterChipText, openNowOnly && styles.filterChipTextActive]}>
            Open Now
          </Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.sortOptions}
      >
        <TouchableOpacity 
          style={[styles.sortBtn, sortBy === 'price_low' && styles.activeSortBtn]}
          onPress={() => setSortBy('price_low')}
        >
          <ArrowUpDown size={13} color={sortBy === 'price_low' ? '#000' : '#888'} />
          <Text style={[styles.sortBtnText, sortBy === 'price_low' && styles.activeSortBtnText]}>Price: Low to High</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.sortBtn, sortBy === 'rating' && styles.activeSortBtn]}
          onPress={() => setSortBy('rating')}
        >
          <Star size={13} color={sortBy === 'rating' ? '#000' : '#888'} fill={sortBy === 'rating' ? '#000' : 'transparent'} />
          <Text style={[styles.sortBtnText, sortBy === 'rating' && styles.activeSortBtnText]}>Best Rated</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderHotel = ({ item }: { item: Hotel }) => {
    const isSelected = planning.selectedHotelId === item.id;
    const isOyo = item.name.toLowerCase().includes('oyo');

    const providerPrices = PROVIDERS.map(p => ({
        id: p.id,
        price: item.price > 0 ? Math.round(item.price * p.markup) : null,
    }));
    const availablePrices = providerPrices.map(p => p.price).filter((price): price is number => price !== null);
    const cheapestPrice = availablePrices.length > 0 ? Math.min(...availablePrices) : null;
    const hasRange = item.price > 0 && !!item.priceMax;
    const priceCaption = hasRange
      ? `Est. ₹${item.price.toLocaleString('en-IN')} - ₹${(item.priceMax || item.price).toLocaleString('en-IN')} / night`
      : item.price > 0
        ? `Est. from ₹${item.price.toLocaleString('en-IN')} / night`
        : getPriceTierLabel(item.priceLevel);

    return (
      <Pressable
        onPress={() => handleSelectHotel(item)}
        style={({ pressed }) => [
          styles.hotelCard,
          isSelected && styles.selectedHotelCard,
          pressed && styles.hotelCardPressed,
        ]}
      >
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
                <Text style={styles.ratingBadgeText}>{item.rating > 0 ? item.rating.toFixed(1) : 'N/A'}</Text>
              </View>
          </View>
          
          <View style={styles.metaRow}>
            <MapPin size={12} color="#888" />
            <Text style={styles.distanceText}>{item.distance}</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={[styles.openStatusText, item.openNow === false && { color: '#FF9F0A' }]}>
              {item.openNow === true ? 'Open now' : item.openNow === false ? 'Closed now' : 'Timing unknown'}
            </Text>
          </View>
          <Text style={styles.basePriceText}>{priceCaption}</Text>
          {item.ratingCount ? (
            <Text style={styles.ratingMetaText}>{item.ratingCount.toLocaleString('en-IN')} ratings</Text>
          ) : null}
          <View style={styles.selectionRow}>
            <TouchableOpacity
              style={[styles.selectStayBtn, isSelected && styles.selectStayBtnActive]}
              onPress={(event) => {
                event.stopPropagation();
                handleSelectHotel(item);
              }}
              accessibilityRole="button"
              accessibilityLabel={isSelected ? 'Hotel selected' : 'Select this hotel'}
              accessibilityHint="Adds this stay to your itinerary"
            >
              <Text style={[styles.selectStayBtnText, isSelected && styles.selectStayBtnTextActive]}>
                {isSelected ? 'Selected' : 'Select Stay'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.selectHintText}>
              {isSelected ? 'Added to your plan' : 'Tap to add this hotel'}
            </Text>
          </View>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={(event) => {
                event.stopPropagation();
                handleNavigate(item);
              }}
              accessibilityRole="button"
              accessibilityLabel="Navigate to hotel"
              accessibilityHint="Opens Google Maps directions from your current location"
            >
              <Navigation size={13} color="#000" />
              <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>
            <Text style={styles.navigateMetaText}>Uses current location automatically</Text>
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
              const provPrice = item.price > 0 ? Math.round(item.price * provider.markup) : null;
              const isCheapest = cheapestPrice !== null && provPrice === cheapestPrice;
              const isRedirecting = redirectingProvider === provider.id && redirectingHotelId === item.id;

              return (
                <TouchableOpacity 
                    key={provider.id} 
                    style={[
                        styles.providerChip, 
                        isCheapest && styles.cheapestChip,
                        isRedirecting && { opacity: 0.5 }
                    ]}
                    onPress={(event) => {
                      event.stopPropagation();
                      handleBooking(provider.id, item);
                    }}
                    disabled={!!redirectingProvider}
                >
                    <View style={styles.chipHeader}>
                        {(() => {
                          const logoIdx = providerLogoIndex[provider.id] ?? 0;
                          const logoUri = logoIdx < provider.logos.length ? provider.logos[logoIdx] : null;
                          if (logoUri) {
                            return (
                              <View style={styles.chipLogoBox}>
                                <Image
                                  key={`${provider.id}-${logoIdx}`}
                                  source={{ uri: logoUri }}
                                  style={styles.chipLogo}
                                  resizeMode="contain"
                                  onError={() => handleProviderLogoError(provider.id)}
                                />
                              </View>
                            );
                          }
                          return (
                            <View style={[styles.chipLogoFallback, { backgroundColor: provider.color, borderColor: provider.color }]}>
                              <Text style={styles.chipLogoFallbackText}>{getProviderInitials(provider.name)}</Text>
                            </View>
                          );
                        })()}
                        <Text style={styles.providerChipName}>{provider.name}</Text>
                    </View>
                    <View style={styles.chipPricing}>
                        <Text style={[styles.chipPrice, isCheapest && styles.cheapestPrice]}>
                          {provPrice !== null ? `₹${provPrice.toLocaleString('en-IN')}` : 'Check rates'}
                        </Text>
                        {provPrice !== null ? <Text style={styles.chipUnit}>/ night</Text> : null}
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
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Scanning stays within 20km of your destination...</Text>
        </View>
      ) : null}
      {renderSortBar()}
      <FlatList
        data={sortedHotels}
        renderItem={renderHotel}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No stays match current filters. Try disabling "Open Now" or increasing budget.
              </Text>
            </View>
          )
        }
      />
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
  controlsCard: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#1f1f1f',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  compactHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sortInfo: { flexDirection: 'row', alignItems: 'center', gap: 5, flex: 1, marginRight: 8 },
  resultsCount: { color: '#9a9a9a', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  sortOptions: { flexDirection: 'row', gap: 8, paddingRight: 4 },
  metaFilterText: { color: '#6f6f6f', fontSize: 10, fontWeight: '600', flexShrink: 1 },
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
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#222',
  },
  activeSortBtn: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  sortBtnText: { color: '#888', fontSize: 12, fontWeight: '700' },
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
  hotelCardPressed: {
    transform: [{ scale: 0.995 }],
    opacity: 0.96,
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
  openStatusText: { color: '#32D74B', fontSize: 11, fontWeight: '700' },
  basePriceText: { color: '#777', fontSize: 11, marginTop: 4 },
  ratingMetaText: { color: '#666', fontSize: 10, marginTop: 2 },
  selectionRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectStayBtn: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#343434',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  selectStayBtnActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  selectStayBtnText: { color: '#DDD', fontSize: 11, fontWeight: '800' },
  selectStayBtnTextActive: { color: '#000' },
  selectHintText: { color: '#666', fontSize: 10, flex: 1 },
  navigationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  navigateBtnText: { color: '#000', fontSize: 12, fontWeight: '800' },
  navigateMetaText: { color: '#6A6A6A', fontSize: 10, flex: 1, textAlign: 'right' },
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
  chipLogoBox: {
    width: 30,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#EAEAEA',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: 2,
    paddingVertical: 1,
  },
  chipLogo: { width: '100%', height: '100%' },
  chipLogoFallback: {
    width: 30,
    height: 20,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLogoFallbackText: { color: '#FFF', fontSize: 9, fontWeight: '800' },
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
