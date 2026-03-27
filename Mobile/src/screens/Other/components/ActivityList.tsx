import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Compass, Clock, MapPin, AlertTriangle } from 'lucide-react-native';
import { PlanningState, Activity, Preference } from '../tripPlannerTypes';
import { placesService } from '../../../services/placesService';
import { TripExpenseResult } from '../../../services/tripExpenseService';
import { decodePolyline } from '../../../utils/polyline';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  tripResult?: TripExpenseResult | null;
}

const CATEGORIES: { id: string; label: string; types: string[]; pref: Preference }[] = [
  { id: 'all', label: 'All', types: ['tourist_attraction', 'park', 'museum'], pref: 'culture' },
  { id: 'sights', label: 'Sights', types: ['tourist_attraction', 'museum'], pref: 'sights' },
  { id: 'nature', label: 'Nature', types: ['park'], pref: 'nature' },
  { id: 'food', label: 'Dining', types: ['restaurant'], pref: 'food' },
];

const ActivityList = ({ planning, onChange, tripResult }: Props) => {
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchAllActivities();
  }, [tripResult]);

  const fetchAllActivities = async () => {
    const route = tripResult?.routes?.[0];
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
        
        return {
          id: p.placeId,
          name: p.name,
          category: pref,
          originalType: p.type,
          openTime: '09:00 AM',
          closeTime: '06:00 PM',
          price: (Math.random() > 0.7) ? 500 : 0,
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
    if (current.includes(activityId)) {
      onChange({ selectedActivities: current.filter((id) => id !== activityId) });
    } else {
      onChange({ selectedActivities: [...current, activityId] });
    }
  };

  const filteredActivities = allActivities.filter((a) => {
    const cat = CATEGORIES.find(c => c.id === selectedCategory) || CATEGORIES[0];
    const matchesCategory = selectedCategory === 'all' || cat.types.includes(a.originalType);
    const matchesBudget = planning.budget === 0 || a.price <= planning.budget;
    return matchesCategory && matchesBudget;
  });

  const renderActivity = ({ item }: { item: Activity }) => {
    const isSelected = planning.selectedActivities?.includes(item.id);
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
            <Text style={styles.infoText}>{item.openTime} - {item.closeTime}</Text>
            <Text style={styles.dot}>•</Text>
            <MapPin size={12} color="#888" />
            <Text style={styles.infoText}>{item.location}</Text>
          </View>
          <Text style={styles.priceText}>{item.price > 0 ? `₹${item.price} Entry` : 'Free Entry'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color="#FFD700" />
          <Text style={styles.loadingText}>Exploring local area...</Text>
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
          <Text style={styles.emptyText}>No activities found in this category. Try exploring others!</Text>
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
  container: { flex: 1, padding: 10 },
  loadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  loadingText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
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
