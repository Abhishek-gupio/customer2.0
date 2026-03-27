import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, SafeAreaView } from 'react-native';
import { X, History, MapPin, Fuel, Receipt, Calendar, ChevronRight, Trash2, Hotel, Compass, Bike, Wallet } from 'lucide-react-native';
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
            history.map((item) => (
              <View key={item.id} style={styles.historyCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.routeBox}>
                    <MapPin size={14} color="#FFD700" />
                    <Text style={styles.routeText} numberOfLines={1}>{item.from} → {item.to}</Text>
                  </View>
                  <Text style={styles.dateText}>{new Date(item.timestamp).toLocaleDateString()}</Text>
                </View>

                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Fuel size={14} color="#888" />
                    <Text style={styles.statValue}>₹{(item.tripResult.routes?.[0]?.costs?.fuel || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Receipt size={14} color="#888" />
                    <Text style={styles.statValue}>₹{(item.tripResult.routes?.[0]?.costs?.tollFastag || 0).toLocaleString()}</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Wallet size={14} color="#888" />
                    <Text style={styles.statValue}>₹{item.planning.budget || 0}</Text>
                  </View>
                </View>

                <View style={styles.detailsRow}>
                  <View style={styles.detailBadge}>
                     <Hotel size={12} color="#FFD700" />
                     <Text style={styles.detailText}>{item.planning.selectedHotelId ? 'Hotel Added' : 'No Hotel'}</Text>
                  </View>
                  <View style={styles.detailBadge}>
                     <Compass size={12} color="#FFD700" />
                     <Text style={styles.detailText}>{item.planning.selectedActivities?.length || 0} Activities</Text>
                  </View>
                  <View style={styles.detailBadge}>
                     <Bike size={12} color="#FFD700" />
                     <Text style={styles.detailText}>{item.planning.selectedBikeId ? 'Transport Added' : 'No Transport'}</Text>
                  </View>
                </View>

                <View style={styles.cardFooter}>
                  <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => handleDelete(item.id)}
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
            ))
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
  historyCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  routeBox: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, marginRight: 10 },
  routeText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  dateText: { color: '#666', fontSize: 12 },
  statsRow: { flexDirection: 'row', gap: 20, marginBottom: 15 },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statValue: { color: '#BBB', fontSize: 13 },
  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  detailBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 215, 0, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  detailText: { color: '#FFD700', fontSize: 11, fontWeight: 'bold' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: { padding: 8, backgroundColor: 'rgba(255, 69, 58, 0.1)', borderRadius: 10 },
  viewBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6, 
    backgroundColor: '#FFD700', 
    paddingHorizontal: 16, 
    paddingVertical: 8, 
    borderRadius: 12 
  },
  viewBtnText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
});

export default TripHistoryModal;
