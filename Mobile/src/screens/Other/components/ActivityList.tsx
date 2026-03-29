import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { Compass, Clock, MapPin, Navigation } from 'lucide-react-native';
import { PlanningState, Activity, Preference, SelectedActivityDetails } from '../tripPlannerTypes';
import { placesService } from '../../../services/placesService';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { decodePolyline } from '../../../utils/polyline';
import { tripPlannerAnalytics } from '../../../services/analytics';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
  selectedRouteIndex?: number;
}

const CATEGORIES: { id: string; label: string; types: string[]; pref: Preference }[] = [
  { id: 'all', label: 'All', types: ['tourist_attraction', 'park', 'museum'], pref: 'culture' },
  { id: 'sights', label: 'Sights', types: ['tourist_attraction', 'museum'], pref: 'sights' },
  { id: 'nature', label: 'Nature', types: ['park'], pref: 'nature' },
  { id: 'food', label: 'Dining', types: ['restaurant'], pref: 'food' },
];

const ENTRY_PRICE_BY_LEVEL: Record<number, number> = {
  1: 150,
  2: 300,
  3: 700,
  4: 1400,
};

const getEstimatedEntryFee = (priceLevel?: number, placeType?: string) => {
  if (placeType === 'park') return 0;
  if (!priceLevel) return 0;
  return ENTRY_PRICE_BY_LEVEL[priceLevel] || 0;
};

const buildActivityDirectionsUrl = (activity: Activity, city: string) => {
  const query = [activity.name, city].filter(Boolean).join(' ').trim();
  const destination = activity.latitude != null && activity.longitude != null
    ? `${activity.latitude},${activity.longitude}`
    : query;
  const params = new URLSearchParams({
    api: '1',
    travelmode: 'driving',
    destination,
  });
  if (activity.id) params.set('destination_place_id', activity.id);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
};

const buildActivitySearchUrl = (activity: Activity, city: string) => {
  const query = [activity.name, city].filter(Boolean).join(' ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}&query_place_id=${encodeURIComponent(activity.id)}`;
};

const ActivityList = ({ planning, onChange, tripResult, selectedRouteIndex }: Props) => {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [openNowOnly, setOpenNowOnly] = useState(false);
  const stayDays = Math.max(planning.stayDays || 1, 1);
  const totalBudget = planning.budget || 0;
  const hasCategoryBudget = (planning.activityBudget || 0) > 0;
  const activityBudget = hasCategoryBudget ? (planning.activityBudget || 0) : totalBudget;
  const dailyActivityBudget = activityBudget > 0 ? Math.round(activityBudget / stayDays) : 0;

  useEffect(() => {
    fetchAllActivities();
  }, [tripResult]);

  useEffect(() => {
    if (selectedCategory !== 'all') return;
    const prefs = planning.preferences || [];
    if (prefs.includes('food')) {
      setSelectedCategory('food');
      return;
    }
    if (prefs.includes('nature')) {
      setSelectedCategory('nature');
      return;
    }
    if (prefs.includes('sights') || prefs.includes('culture') || prefs.includes('adventure')) {
      setSelectedCategory('sights');
    }
  }, [planning.preferences, selectedCategory]);

  const fetchAllActivities = async () => {
    const route =
      tripResult?.routes?.[selectedRouteIndex ?? planning.selectedRouteIndex ?? 0] ||
      tripResult?.cheapestRoute ||
      tripResult?.routes?.[0];
    if (!route?.polyline) return;

    setLoading(true);
    try {
      const coords = decodePolyline(route.polyline);
      const dest = coords[coords.length - 1];
      
      const types = ['tourist_attraction', 'park', 'museum', 'restaurant'];
      const resultsByType = await Promise.all(
        types.map(async (type) => {
          const places = await placesService.getNearby(dest.latitude, dest.longitude, type as any);
          return places.map(p => ({ ...p, type }));
        })
      );
      
      const flatResults = resultsByType.flat();
      
      const mapped: Activity[] = flatResults.map((p) => {
        let pref: Preference = 'culture';
        if (p.type === 'park') pref = 'nature';
        if (p.type === 'restaurant') pref = 'food';
        if (p.type === 'museum' || p.type === 'tourist_attraction') pref = 'sights';
        const estimatedEntry = getEstimatedEntryFee(p.priceLevel, p.type);
        
        return {
          id: p.placeId,
          name: p.name,
          address: p.address,
          latitude: p.latitude,
          longitude: p.longitude,
          category: pref,
          originalType: p.type,
          openTime: p.openNow === true ? 'Open now' : p.openNow === false ? 'Closed now' : 'Timing varies',
          closeTime: 'Check venue',
          price: estimatedEntry,
          priceLevel: p.priceLevel,
          openNow: p.openNow,
          isPriceEstimated: estimatedEntry > 0,
          image: p.imageUrl || `https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=400&q=80`,
          location: p.distanceText,
        };
      });

      const unique = Array.from(new Map(mapped.map(item => [item.id, item])).values());
      setAllActivities(unique);
    } catch (e) {
      console.warn('Failed to fetch activities', e);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryCount = (catId: string) => {
    if (catId === 'all') return allActivities.length;
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return 0;
    return allActivities.filter(a => cat.types.includes(a.originalType)).length;
  };

  const toggleActivity = (activityId: string) => {
    const current = planning.selectedActivities || [];
    const currentDetails = planning.selectedActivityDetails || [];
    const selected = current.includes(activityId);
    const selectedItem = allActivities.find((activity) => activity.id === activityId);
    if (current.includes(activityId)) {
      onChange({
        selectedActivities: current.filter((id) => id !== activityId),
        selectedActivityDetails: currentDetails.filter((item) => item.id !== activityId),
      });
    } else {
      const nextDetails: SelectedActivityDetails[] = selectedItem
        ? [
            ...currentDetails.filter((item) => item.id !== activityId),
            {
              id: selectedItem.id,
              name: selectedItem.name,
              category: selectedItem.category,
              location: selectedItem.location,
              address: selectedItem.address,
              image: selectedItem.image,
              price: selectedItem.price,
              openTime: selectedItem.openTime,
              openNow: selectedItem.openNow,
              latitude: selectedItem.latitude,
              longitude: selectedItem.longitude,
            },
          ]
        : currentDetails;
      onChange({
        selectedActivities: [...current, activityId],
        selectedActivityDetails: nextDetails,
      });
    }
    tripPlannerAnalytics.activityToggled({
      activity_id: activityId,
      selected: !selected,
      category: selectedItem?.category || 'unknown',
      total_selected: selected ? Math.max(current.length - 1, 0) : current.length + 1,
    });
  };

  const filteredActivities = allActivities.filter((a) => {
    const cat = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
    const matchesCategory = selectedCategory === 'all' || cat.types.includes(a.originalType);
    const matchesOpenNow = !openNowOnly || a.openNow === true;
    const matchesBudget = activityBudget === 0 || a.price === 0 || a.price <= dailyActivityBudget;
    return matchesCategory && matchesOpenNow && matchesBudget;
  });

  const renderActivity = ({ item }: { item: Activity }) => {
    const isSelected = planning.selectedActivities?.includes(item.id);
    const priceText = item.price > 0
      ? `Est. ₹${item.price.toLocaleString('en-IN')} per person`
      : item.originalType === 'restaurant'
        ? 'Menu pricing varies'
        : 'Free / entry fee unavailable';
    const destinationCity = (tripResult?.to || '').split(',')[0]?.trim() || '';
    return (
      <TouchableOpacity
        style={[styles.activityCard, isSelected && styles.selectedActivityCard]}
        onPress={() => toggleActivity(item.id)}
      >
        <Image source={{ uri: item.image }} style={styles.activityImage} />
        <View style={styles.overlay}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category.toUpperCase()}</Text>
          </View>
        </View>
        <View style={styles.activityDetails}>
          <Text style={styles.activityName}>{item.name}</Text>
          <View style={styles.infoRow}>
            <Clock size={12} color="#888" />
            <Text style={[styles.infoText, item.openNow === false && { color: '#FF9F0A' }]}>{item.openTime}</Text>
            <Text style={styles.dot}>•</Text>
            <MapPin size={12} color="#888" />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>
          <Text style={[styles.priceText, item.price === 0 && styles.priceTextMuted]}>{priceText}</Text>
          <View style={styles.navigationRow}>
            <TouchableOpacity
              style={styles.navigateBtn}
              onPress={(event) => {
                event.stopPropagation();
                const openMaps = async () => {
                  const dirUrl = buildActivityDirectionsUrl(item, destinationCity);
                  const fallbackUrl = buildActivitySearchUrl(item, destinationCity);
                  try {
                    await Linking.openURL(dirUrl);
                  } catch (e) {
                    console.warn('Failed to open activity directions URL, trying fallback', e);
                    try {
                      await Linking.openURL(fallbackUrl);
                    } catch (fallbackErr) {
                      console.error('Failed to open activity fallback map URL', fallbackErr);
                    }
                  }
                };
                openMaps();
              }}
            >
              <Navigation size={12} color="#000" />
              <Text style={styles.navigateBtnText}>Navigate</Text>
            </TouchableOpacity>
            <Text style={styles.navigateMetaText}>Current location auto-used</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Finding activities near your destination...</Text>
        </View>
      ) : null}
      <View style={styles.catHeader}>
        <View style={styles.compactHeaderRow}>
          <View style={styles.headerInfo}>
            <Text style={styles.labelCompact}>Explore Categories</Text>
            <Text style={styles.dot}>•</Text>
            <Text style={styles.metaText} numberOfLines={1}>
            {activityBudget > 0
              ? `Daily ${hasCategoryBudget ? 'activity' : 'budget'} cap: ₹${dailyActivityBudget.toLocaleString('en-IN')}`
              : 'No budget filter'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.filterChip, openNowOnly && styles.filterChipActive]}
            onPress={() => setOpenNowOnly((prev) => !prev)}
          >
            <Text style={[styles.filterChipText, openNowOnly && styles.filterChipTextActive]}>Open Now</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          horizontal
          data={CATEGORIES}
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.catList}
          renderItem={({ item }) => (
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

      {filteredActivities.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Compass size={40} color="#FFD700" />
          <Text style={styles.emptyText}>
            No activities match this category/filter. Try another category, higher budget, or disable "Open Now".
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredActivities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}
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
  catHeader: { marginBottom: 12 },
  compactHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8, gap: 4 },
  metaText: { color: '#666', fontSize: 10, fontWeight: '600', flexShrink: 1 },
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
  labelCompact: { color: '#888', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  activityCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 15,
    overflow: 'hidden',
  },
  selectedActivityCard: { borderColor: '#FFD700', borderWidth: 2 },
  activityImage: { width: '100%', height: 160 },
  overlay: { position: 'absolute', top: 12, left: 12 },
  categoryBadge: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  categoryText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  activityDetails: { padding: 16 },
  activityName: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 6 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 4 },
  infoText: { color: '#888', fontSize: 12 },
  dot: { color: '#444', marginHorizontal: 2 },
  priceText: { color: '#FFD700', fontSize: 14, fontWeight: 'bold' },
  priceTextMuted: { color: '#888' },
  navigationRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  navigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  navigateBtnText: { color: '#000', fontSize: 11, fontWeight: '800' },
  navigateMetaText: { color: '#666', fontSize: 10, flex: 1, textAlign: 'right' },
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

export default ActivityList;
