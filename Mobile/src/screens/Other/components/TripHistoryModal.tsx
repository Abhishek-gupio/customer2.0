import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, History, MapPin, Fuel, Receipt, Calendar, ChevronRight, Trash2, Hotel, Compass, Bike, Wallet, Navigation } from 'lucide-react-native';
import LinearGradient from 'react-native-linear-gradient';
import { getHistory, deleteHistoryItem } from '../../../services/tripHistoryPersistence';
import { HistoryEntry } from '../../../services/tripHistoryTypes';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  onSelectTrip: (entry: HistoryEntry) => void;
}

const TripHistoryModal = ({ isVisible, onClose, onSelectTrip }: Props) => {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    if (isVisible) {
      loadHistory();
    }
  }, [isVisible]);

  const loadHistory = async () => {
    const data = await getHistory();
    setHistory(data);
  };

  const handleDelete = async (id: string) => {
    await deleteHistoryItem(id);
    loadHistory();
  };

  const handleDeletePress = (id: string) => {
    Alert.alert(
      'Delete saved trip?',
      'This saved plan will be removed from your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void handleDelete(id);
          },
        },
      ],
    );
  };

  const buildDirectionsUrl = (params: {
    name?: string;
    city?: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const query = [params.name, params.city].filter(Boolean).join(' ').trim();
    const destination = params.latitude != null && params.longitude != null
      ? `${params.latitude},${params.longitude}`
      : query;
    const searchParams = new URLSearchParams({
      api: '1',
      travelmode: 'driving',
      destination,
    });
    if (params.placeId) searchParams.set('destination_place_id', params.placeId);
    return `https://www.google.com/maps/dir/?${searchParams.toString()}`;
  };

  const buildMapsSearchUrl = (params: {
    name?: string;
    city?: string;
    placeId?: string;
  }) => {
    const query = [params.name, params.city].filter(Boolean).join(' ').trim();
    const searchParams = new URLSearchParams({
      api: '1',
      query,
    });
    if (params.placeId) searchParams.set('query_place_id', params.placeId);
    return `https://www.google.com/maps/search/?${searchParams.toString()}`;
  };

  const handleNavigate = async (params: {
    name?: string;
    city?: string;
    placeId?: string;
    latitude?: number;
    longitude?: number;
  }) => {
    const directionsUrl = buildDirectionsUrl(params);
    const fallbackUrl = buildMapsSearchUrl(params);
    try {
      await Linking.openURL(directionsUrl);
    } catch (e) {
      console.warn('Failed to open saved item directions URL, trying fallback', e);
      try {
        await Linking.openURL(fallbackUrl);
      } catch (fallbackErr) {
        console.error('Failed to open saved item fallback map URL', fallbackErr);
      }
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <History size={24} color="#FFD700" />
            <Text style={styles.headerTitle}>Trip History</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#FFF" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.list}>
          {history.length === 0 ? (
            <View style={styles.emptyState}>
              <History size={64} color="#333" />
              <Text style={styles.emptyText}>No saved trips yet.</Text>
              <Text style={styles.emptySub}>Completing a plan will automatically save it here.</Text>
            </View>
          ) : (
            history.map((item) => {
              const destinationCity = (item.to || '').split(',')[0]?.trim() || '';
              const routeIndex = item.planning.selectedRouteIndex ?? 0;
              const activeRoute =
                item.tripResult.routes?.[routeIndex] ||
                item.tripResult.cheapestRoute ||
                item.tripResult.routes?.[0];
              const effectiveBudget = item.planning.budget > 0
                ? item.planning.budget
                : (item.planning.hotelBudget || 0) + (item.planning.activityBudget || 0) + (item.planning.transportBudget || 0);
              const selectedHotelName = item.planning.selectedHotelDetails?.name || (item.planning.selectedHotelId ? 'Hotel Added' : 'No Hotel');
              const selectedHotelMeta = item.planning.selectedHotelDetails
                ? [
                    item.planning.selectedHotelDetails.address,
                    item.planning.selectedHotelDetails.price && item.planning.selectedHotelDetails.price > 0
                      ? `₹${item.planning.selectedHotelDetails.price.toLocaleString('en-IN')}/night`
                      : undefined,
                  ].filter(Boolean).join(' • ')
                : '';
              const selectedActivities = item.planning.selectedActivityDetails || [];
              const selectedActivitiesCount = selectedActivities.length > 0
                ? selectedActivities.length
                : (item.planning.selectedActivities?.length || 0);
              const selectedTransportName = item.planning.selectedTransportDetails?.name || (item.planning.selectedBikeId ? 'Transport Added' : 'No Transport');
              const selectedTransportMeta = item.planning.selectedTransportDetails
                ? [
                    item.planning.selectedTransportDetails.type,
                    item.planning.selectedTransportDetails.priceLabel,
                  ].filter(Boolean).join(' • ')
                : '';

              return (
                <LinearGradient
                  key={item.id}
                  colors={['rgba(255, 215, 0, 0.22)', 'rgba(255, 215, 0, 0.05)', 'rgba(255, 255, 255, 0.03)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.historyCardGlow}
                >
                <View style={styles.historyCard}>
                  <View style={styles.cardHeader}>
                    <View style={styles.routeBox}>
                      <MapPin size={14} color="#FFD700" />
                      <Text style={styles.routeText} numberOfLines={1}>{item.from} → {item.to}</Text>
                    </View>
                    <View style={styles.datePill}>
                      <Calendar size={11} color="#FFD700" />
                      <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <View style={styles.statIconWrap}>
                        <Fuel size={13} color="#FFD700" />
                      </View>
                      <Text style={styles.statLabel}>Fuel</Text>
                      <Text style={styles.statValue}>₹{(activeRoute?.costs?.fuel || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <View style={styles.statIconWrap}>
                        <Receipt size={13} color="#FFD700" />
                      </View>
                      <Text style={styles.statLabel}>Toll</Text>
                      <Text style={styles.statValue}>₹{(activeRoute?.costs?.tollFastag || 0).toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={styles.statItem}>
                      <View style={styles.statIconWrap}>
                        <Wallet size={13} color="#FFD700" />
                      </View>
                      <Text style={styles.statLabel}>Budget</Text>
                      <Text style={styles.statValue}>₹{effectiveBudget.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsRow}>
                    <View style={styles.detailBadge}>
                      <Hotel size={12} color="#FFD700" />
                      <Text style={styles.detailText}>{selectedHotelName}</Text>
                    </View>
                    <View style={styles.detailBadge}>
                      <Compass size={12} color="#FFD700" />
                      <Text style={styles.detailText}>{selectedActivitiesCount} Activities</Text>
                    </View>
                    <View style={styles.detailBadge}>
                      <Bike size={12} color="#FFD700" />
                      <Text style={styles.detailText}>{selectedTransportName}</Text>
                    </View>
                  </View>

                  {selectedHotelMeta ? <Text style={styles.metaLineText}>Hotel: {selectedHotelMeta}</Text> : null}
                  {selectedTransportMeta ? <Text style={styles.metaLineText}>Transport: {selectedTransportMeta}</Text> : null}
                  {selectedActivities.length > 0 ? (
                    <Text style={styles.activityNamesText}>
                      {selectedActivities.map((activity) => activity.name).join(' • ')}
                    </Text>
                  ) : null}

                  {(item.planning.selectedHotelDetails || item.planning.selectedTransportDetails || selectedActivities.length > 0) ? (
                    <View style={styles.savedCardsSection}>
                      <Text style={styles.savedSectionTitle}>Saved Selections</Text>
                      {item.planning.selectedHotelDetails ? (
                        <View style={styles.savedItemCard}>
                          {item.planning.selectedHotelDetails.image ? (
                            <Image source={{ uri: item.planning.selectedHotelDetails.image }} style={styles.savedItemImage} />
                          ) : (
                            <View style={styles.savedItemFallbackIcon}>
                              <Hotel size={18} color="#FFD700" />
                            </View>
                          )}
                          <View style={styles.savedItemContent}>
                            <Text style={styles.savedItemType}>Hotel</Text>
                            <Text style={styles.savedItemTitle} numberOfLines={1}>{item.planning.selectedHotelDetails.name}</Text>
                            <Text style={styles.savedItemMeta} numberOfLines={2}>
                              {[
                                item.planning.selectedHotelDetails.address,
                                item.planning.selectedHotelDetails.price && item.planning.selectedHotelDetails.price > 0
                                  ? `₹${item.planning.selectedHotelDetails.price.toLocaleString('en-IN')}/night`
                                  : undefined,
                                item.planning.selectedHotelDetails.distance,
                              ].filter(Boolean).join(' • ')}
                            </Text>
                            <View style={styles.savedItemActions}>
                              <TouchableOpacity
                                style={styles.savedNavigateBtn}
                                onPress={() => handleNavigate({
                                  name: item.planning.selectedHotelDetails?.name,
                                  city: destinationCity,
                                  placeId: item.planning.selectedHotelDetails?.id,
                                  latitude: item.planning.selectedHotelDetails?.latitude,
                                  longitude: item.planning.selectedHotelDetails?.longitude,
                                })}
                              >
                                <Navigation size={11} color="#000" />
                                <Text style={styles.savedNavigateBtnText}>Navigate</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ) : null}

                      {item.planning.selectedTransportDetails ? (
                        <View style={styles.savedItemCard}>
                          {item.planning.selectedTransportDetails.image ? (
                            <Image source={{ uri: item.planning.selectedTransportDetails.image }} style={styles.savedItemImage} />
                          ) : (
                            <View style={styles.savedItemFallbackIcon}>
                              <Bike size={18} color="#FFD700" />
                            </View>
                          )}
                          <View style={styles.savedItemContent}>
                            <Text style={styles.savedItemType}>Transport</Text>
                            <Text style={styles.savedItemTitle} numberOfLines={1}>{item.planning.selectedTransportDetails.name}</Text>
                            <Text style={styles.savedItemMeta} numberOfLines={2}>
                              {[
                                item.planning.selectedTransportDetails.type,
                                item.planning.selectedTransportDetails.priceLabel,
                                item.planning.selectedTransportDetails.distanceText,
                              ].filter(Boolean).join(' • ')}
                            </Text>
                            <View style={styles.savedItemActions}>
                              <TouchableOpacity
                                style={styles.savedNavigateBtn}
                                onPress={() => handleNavigate({
                                  name: item.planning.selectedTransportDetails?.name,
                                  city: destinationCity,
                                  placeId: item.planning.selectedTransportDetails?.source === 'nearby'
                                    ? item.planning.selectedTransportDetails?.id
                                    : undefined,
                                  latitude: item.planning.selectedTransportDetails?.latitude,
                                  longitude: item.planning.selectedTransportDetails?.longitude,
                                })}
                              >
                                <Navigation size={11} color="#000" />
                                <Text style={styles.savedNavigateBtnText}>Navigate</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ) : null}

                      {selectedActivities.map((activity) => (
                        <View key={`${item.id}_${activity.id}`} style={styles.savedItemCard}>
                          {activity.image ? (
                            <Image source={{ uri: activity.image }} style={styles.savedItemImage} />
                          ) : (
                            <View style={styles.savedItemFallbackIcon}>
                              <Compass size={18} color="#FFD700" />
                            </View>
                          )}
                          <View style={styles.savedItemContent}>
                            <Text style={styles.savedItemType}>Activity</Text>
                            <Text style={styles.savedItemTitle} numberOfLines={1}>{activity.name}</Text>
                            <Text style={styles.savedItemMeta} numberOfLines={2}>
                              {[
                                activity.category?.toUpperCase(),
                                activity.location,
                                activity.price && activity.price > 0
                                  ? `₹${activity.price.toLocaleString('en-IN')}`
                                  : 'Free/NA',
                              ].filter(Boolean).join(' • ')}
                            </Text>
                            <View style={styles.savedItemActions}>
                              <TouchableOpacity
                                style={styles.savedNavigateBtn}
                                onPress={() => handleNavigate({
                                  name: activity.name,
                                  city: destinationCity,
                                  placeId: activity.id,
                                  latitude: activity.latitude,
                                  longitude: activity.longitude,
                                })}
                              >
                                <Navigation size={11} color="#000" />
                                <Text style={styles.savedNavigateBtnText}>Navigate</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}

                  <View style={styles.cardFooter}>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeletePress(item.id)}
                    >
                      <Trash2 size={16} color="#FF453A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.viewBtn}
                      onPress={() => onSelectTrip(item)}
                    >
                      <Text style={styles.viewBtnText}>View Plan</Text>
                      <ChevronRight size={16} color="#000" />
                    </TouchableOpacity>
                  </View>
                </View>
                </LinearGradient>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  list: { padding: 20 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
  emptyText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 20 },
  emptySub: { color: '#888', fontSize: 14, textAlign: 'center', marginTop: 10, paddingHorizontal: 40 },
  historyCardGlow: {
    borderRadius: 22,
    padding: 1,
    marginBottom: 16,
  },
  historyCard: {
    backgroundColor: '#101010',
    borderRadius: 21,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  routeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 10 },
  routeText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.35)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dateText: { color: '#D2D2D2', fontSize: 11, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  statItem: {
    flex: 1,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 3,
  },
  statIconWrap: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 215, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: { color: '#9A9A9A', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  statValue: { color: '#EDEDED', fontSize: 12, fontWeight: '800' },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  detailBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  metaLineText: { color: '#9A9A9A', fontSize: 11, lineHeight: 16, marginBottom: 6 },
  activityNamesText: { color: '#8B8B8B', fontSize: 11, lineHeight: 16, marginBottom: 12 },
  savedCardsSection: {
    backgroundColor: '#0F0F0F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#202020',
    padding: 10,
    gap: 8,
    marginBottom: 12,
  },
  savedSectionTitle: {
    color: '#D9D9D9',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  savedItemCard: {
    backgroundColor: '#151515',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#252525',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedItemImage: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
  },
  savedItemFallbackIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedItemContent: { flex: 1 },
  savedItemType: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  savedItemTitle: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  savedItemMeta: { color: '#8A8A8A', fontSize: 11, marginTop: 2, lineHeight: 15 },
  savedItemActions: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  savedNavigateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFD700',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  savedNavigateBtnText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
  },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: { padding: 9, backgroundColor: 'rgba(255, 69, 58, 0.12)', borderRadius: 11, borderWidth: 1, borderColor: 'rgba(255, 69, 58, 0.35)' },
  viewBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#FFD700', 
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E3B800',
  },
  viewBtnText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
});

export default TripHistoryModal;
