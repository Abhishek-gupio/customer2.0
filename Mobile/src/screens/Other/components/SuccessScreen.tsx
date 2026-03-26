import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { CheckCircle2, MapPin, Calendar, Fuel, Receipt, Hotel, Compass, Bike, Wallet, ChevronLeft } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';
import { TripExpenseResult } from '../../../services/tripExpenseService';

interface Props {
  planning: PlanningState;
  tripResult?: TripExpenseResult | null;
  from?: string;
  to?: string;
  onSave: () => void;
  onKeepExploring: () => void;
}

const SuccessScreen = ({ planning, tripResult, from, to, onSave, onKeepExploring }: Props) => {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const fuelCost = tripResult?.routes?.[0]?.costs?.fuel || 0;
  const tollCost = tripResult?.routes?.[0]?.costs?.tollFastag || 0;
  const totalCost = fuelCost + tollCost;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
        <View style={styles.iconContainer}>
          <CheckCircle2 size={60} color="#FFD700" />
        </View>

        <Text style={styles.title}>Trip Summary</Text>
        <Text style={styles.subtitle}>Review your planned journey before saving.</Text>

        <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          
          {/* Route Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={16} color="#FFD700" />
              <Text style={styles.sectionTitle}>Route</Text>
            </View>
            <Text style={styles.sectionValue}>{from || 'Not Set'} → {to || 'Not Set'}</Text>
          </View>

          {/* Dates & Travelers */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
               <View style={styles.sectionHeader}>
                 <Calendar size={16} color="#FFD700" />
                 <Text style={styles.sectionTitle}>Dates</Text>
               </View>
               <Text style={styles.sectionValue}>
                 {planning.arrivalDate ? `${planning.arrivalDate} to ${planning.departureDate}` : 'Not set'}
               </Text>
            </View>
            <View style={[styles.section, { flex: 1 }]}>
               <View style={styles.sectionHeader}>
                 <Wallet size={16} color="#FFD700" />
                 <Text style={styles.sectionTitle}>Stay Budget</Text>
               </View>
               <Text style={styles.sectionValue}>₹{planning.budget || 0}</Text>
            </View>
          </View>

          {/* Transport Estimates */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Fuel size={16} color="#FFD700" />
              <Text style={styles.sectionTitle}>Transport Estimates</Text>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>Estimated Fuel</Text>
               <Text style={styles.costValue}>₹{fuelCost.toLocaleString()}</Text>
            </View>
            <View style={styles.costRow}>
               <Text style={styles.costLabel}>Estimated Tolls</Text>
               <Text style={styles.costValue}>₹{tollCost.toLocaleString()}</Text>
            </View>
            <View style={styles.costDivider} />
            <View style={styles.costRow}>
               <Text style={styles.costTotalLabel}>Total Est. Costs</Text>
               <Text style={styles.costTotalValue}>₹{totalCost.toLocaleString()}</Text>
            </View>
          </View>

          {/* Planned Features */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Hotel size={16} color="#FFD700" />
              <Text style={styles.sectionTitle}>Planned Add-ons</Text>
            </View>
            <View style={styles.addonRow}>
               <Hotel size={16} color="#888" />
               <Text style={styles.addonText}>{planning.selectedHotelId ? '1 Hotel Selected' : 'No Hotel'}</Text>
            </View>
            <View style={styles.addonRow}>
               <Compass size={16} color="#888" />
               <Text style={styles.addonText}>{planning.selectedActivities?.length || 0} Activities Selected</Text>
            </View>
            <View style={styles.addonRow}>
               <Bike size={16} color="#888" />
               <Text style={styles.addonText}>{planning.selectedBikeId ? 'Transport Selected' : 'No Transport'}</Text>
            </View>
          </View>

        </ScrollView>

        <TouchableOpacity style={styles.saveBtn} onPress={onSave}>
          <Text style={styles.saveBtnText}>Save Trip</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.exploreBtn} onPress={onKeepExploring}>
          <ChevronLeft size={16} color="#888" />
          <Text style={styles.exploreBtnText}>Keep Exploring Hub</Text>
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  card: {
    backgroundColor: '#111',
    flex: 1,
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  iconContainer: { alignItems: 'center', marginBottom: 16 },
  title: { color: '#FFF', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 14, textAlign: 'center', marginBottom: 24 },
  summaryScroll: { flex: 1, marginBottom: 20 },
  section: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  sectionTitle: { color: '#FFD700', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  sectionValue: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row' },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { color: '#888', fontSize: 14 },
  costValue: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  costDivider: { height: 1, backgroundColor: '#333', marginVertical: 8 },
  costTotalLabel: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  costTotalValue: { color: '#FFD700', fontSize: 15, fontWeight: 'bold' },
  addonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  addonText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  saveBtn: {
    backgroundColor: '#FFD700',
    height: 56,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  exploreBtnText: { color: '#888', fontSize: 14, fontWeight: 'bold' },
});

export default SuccessScreen;
