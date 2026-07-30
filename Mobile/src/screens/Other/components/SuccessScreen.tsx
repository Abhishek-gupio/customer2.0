import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, ActivityIndicator, Share } from 'react-native';
import { CheckCircle2, MapPin, Calendar, Fuel, Receipt, Hotel, Compass, Bike, Wallet, ChevronLeft } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';
import { TripExpenseResult } from '../../../services/tripExpenseService';

interface Props {
  planning: PlanningState;
  tripResult?: TripExpenseResult | null;
  from?: string;
  to?: string;
  onSave: () => void;
  isSaving?: boolean;
  saveError?: string | null;
  onEditSetup: () => void;
  onEditAddOns: () => void;
  onKeepExploring: () => void;
}

const SuccessScreen = ({
  planning,
  tripResult,
  from,
  to,
  onSave,
  isSaving = false,
  saveError = null,
  onEditSetup,
  onEditAddOns,
  onKeepExploring,
}: Props) => {
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

  const activeRoute =
    tripResult?.routes?.[planning.selectedRouteIndex ?? 0] ||
    tripResult?.cheapestRoute ||
    tripResult?.routes?.[0];
  const fuelCost = activeRoute?.costs?.fuel || 0;
  const tollCost = activeRoute?.costs?.tollFastag || 0;
  const totalCost = fuelCost + tollCost;
  const routeFrom = from || tripResult?.from || 'Not Set';
  const routeTo = to || tripResult?.to || 'Not Set';
  const categoryBudgetParts = [
    (planning.hotelBudget || 0) > 0 ? `Stay ₹${(planning.hotelBudget || 0).toLocaleString('en-IN')}` : null,
    (planning.activityBudget || 0) > 0 ? `Activities ₹${(planning.activityBudget || 0).toLocaleString('en-IN')}` : null,
    (planning.transportBudget || 0) > 0 ? `Transport ₹${(planning.transportBudget || 0).toLocaleString('en-IN')}` : null,
  ].filter((part): part is string => !!part);
  const hasCategoryBudgets = categoryBudgetParts.length > 0;
  const categoryBudgetTotal = (planning.hotelBudget || 0) + (planning.activityBudget || 0) + (planning.transportBudget || 0);
  const effectiveBudget = planning.budget > 0 ? planning.budget : categoryBudgetTotal;
  const hasBudget = effectiveBudget > 0;
  const budgetDelta = effectiveBudget - totalCost;
  const isOverBudget = hasBudget && budgetDelta < 0;
  const selectedHotel = planning.selectedHotelDetails;
  const selectedActivities = planning.selectedActivityDetails || [];
  const selectedTransport = planning.selectedTransportDetails;
  const fallbackActivityCount = planning.selectedActivities?.length || 0;
  const previewDays = Math.min(Math.max(planning.stayDays || 1, 1), 4);
  const primaryActivity = selectedActivities[0]?.name || (fallbackActivityCount > 0 ? 'Selected activities' : 'Local sightseeing');
  const primaryTransport = selectedTransport?.name || 'Local transport';
  const handleSharePlan = async () => {
    const lines = [
      'Trip Itinerary',
      `${routeFrom} -> ${routeTo}`,
      planning.arrivalDate && planning.departureDate
        ? `Dates: ${planning.arrivalDate} to ${planning.departureDate}`
        : 'Dates: Not set',
      `Budget: ₹${effectiveBudget.toLocaleString('en-IN')}`,
      `Estimated Route Cost: ₹${totalCost.toLocaleString('en-IN')}`,
      `Hotel: ${selectedHotel?.name || 'Not selected'}`,
      `Activities: ${selectedActivities.length > 0 ? selectedActivities.map((a) => a.name).join(', ') : `${fallbackActivityCount} selected`}`,
      `Transport: ${selectedTransport?.name || 'Not selected'}`,
    ];
    await Share.share({
      title: 'Trip Itinerary',
      message: lines.filter(Boolean).join('\n'),
    });
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.card, { transform: [{ scale }], opacity }]}>
        <View style={styles.iconContainer}>
          <CheckCircle2 size={60} color="#5F9EA0" />
        </View>

        <Text style={styles.title}>Trip Summary</Text>
        <Text style={styles.subtitle}>Review your planned journey before saving.</Text>

        <ScrollView style={styles.summaryScroll} showsVerticalScrollIndicator={false}>
          
          {/* Route Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={16} color="#5F9EA0" />
              <Text style={styles.sectionTitle}>Route</Text>
            </View>
            <Text style={styles.sectionValue}>{routeFrom} → {routeTo}</Text>
          </View>

          {/* Dates & Travelers */}
          <View style={styles.row}>
            <View style={[styles.section, { flex: 1, marginRight: 10 }]}>
               <View style={styles.sectionHeader}>
                 <Calendar size={16} color="#5F9EA0" />
                 <Text style={styles.sectionTitle}>Dates</Text>
               </View>
               <Text style={styles.sectionValue}>
                 {planning.arrivalDate ? `${planning.arrivalDate} to ${planning.departureDate}` : 'Not set'}
               </Text>
            </View>
            <View style={[styles.section, { flex: 1 }]}>
               <View style={styles.sectionHeader}>
                 <Wallet size={16} color="#5F9EA0" />
                 <Text style={styles.sectionTitle}>Trip Budget</Text>
               </View>
               <Text style={styles.sectionValue}>₹{effectiveBudget.toLocaleString('en-IN')}</Text>
               {hasCategoryBudgets ? (
                 <Text style={styles.sectionSubValue}>{categoryBudgetParts.join(' | ')}</Text>
               ) : null}
            </View>
          </View>

          <View style={styles.quickEditRow}>
            <TouchableOpacity
              style={styles.quickEditBtn}
              onPress={onEditSetup}
              accessibilityRole="button"
              accessibilityLabel="Edit trip setup"
              accessibilityHint="Go back to update dates, travelers, and budget"
            >
              <Text style={styles.quickEditText}>Edit Setup</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.quickEditBtn}
              onPress={onEditAddOns}
              accessibilityRole="button"
              accessibilityLabel="Edit add-ons"
              accessibilityHint="Go back to update hotels, activities, and transport"
            >
              <Text style={styles.quickEditText}>Edit Add-ons</Text>
            </TouchableOpacity>
          </View>

          {/* Transport Estimates */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Fuel size={16} color="#5F9EA0" />
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
            {hasBudget && (
              <>
                <View style={styles.costDivider} />
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Budget Status</Text>
                  <Text style={[styles.budgetStatusText, isOverBudget ? styles.budgetOverText : styles.budgetUnderText]}>
                    {isOverBudget
                      ? `Over by ₹${Math.abs(budgetDelta).toLocaleString()}`
                      : `Under by ₹${budgetDelta.toLocaleString()}`}
                  </Text>
                </View>
              </>
            )}
          </View>

          {/* Planned Features */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Hotel size={16} color="#5F9EA0" />
              <Text style={styles.sectionTitle}>Planned Add-ons</Text>
            </View>
            <View style={styles.addonDetailCard}>
              <View style={styles.addonRow}>
                <Hotel size={16} color="#888" />
                <Text style={styles.addonText}>{selectedHotel?.name || (planning.selectedHotelId ? 'Hotel Selected' : 'No Hotel')}</Text>
              </View>
              {selectedHotel ? (
                <>
                  {selectedHotel.address ? <Text style={styles.addonSubText}>{selectedHotel.address}</Text> : null}
                  <Text style={styles.addonSubText}>
                    {selectedHotel.price && selectedHotel.price > 0
                      ? `Est. from ₹${selectedHotel.price.toLocaleString('en-IN')}/night`
                      : 'Price unavailable'}
                    {selectedHotel.distance ? ` • ${selectedHotel.distance}` : ''}
                  </Text>
                </>
              ) : null}
            </View>

            <View style={styles.addonDetailCard}>
              <View style={styles.addonRow}>
                <Compass size={16} color="#888" />
                <Text style={styles.addonText}>
                  {selectedActivities.length > 0
                    ? `${selectedActivities.length} Activities Selected`
                    : `${fallbackActivityCount} Activities Selected`}
                </Text>
              </View>
              {selectedActivities.length > 0 ? (
                <Text style={styles.addonSubText}>
                  {selectedActivities.map((a) => a.name).join(' • ')}
                </Text>
              ) : null}
            </View>

            <View style={styles.addonDetailCard}>
              <View style={styles.addonRow}>
                <Bike size={16} color="#888" />
                <Text style={styles.addonText}>
                  {selectedTransport?.name || (planning.selectedBikeId ? 'Transport Selected' : 'No Transport')}
                </Text>
              </View>
              {selectedTransport ? (
                <Text style={styles.addonSubText}>
                  {selectedTransport.type || 'Transport option'}
                  {selectedTransport.priceLabel ? ` • ${selectedTransport.priceLabel}` : ''}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Calendar size={16} color="#5F9EA0" />
              <Text style={styles.sectionTitle}>Day-wise Flow</Text>
            </View>
            {Array.from({ length: previewDays }, (_, index) => {
              const dayLabel = `Day ${index + 1}`;
              const morning = index === 0
                ? selectedHotel?.name || 'Arrival & hotel check-in'
                : 'Breakfast and local start';
              const evening = index === previewDays - 1
                ? 'Wrap-up and departure prep'
                : 'Leisure walk and dinner';
              return (
                <View key={dayLabel} style={styles.dayFlowCard}>
                  <Text style={styles.dayFlowTitle}>{dayLabel}</Text>
                  <Text style={styles.dayFlowLine}>Morning: {morning}</Text>
                  <Text style={styles.dayFlowLine}>Afternoon: {primaryActivity}</Text>
                  <Text style={styles.dayFlowLine}>Mobility: {primaryTransport}</Text>
                  <Text style={styles.dayFlowLine}>Evening: {evening}</Text>
                </View>
              );
            })}
          </View>

        </ScrollView>

        <TouchableOpacity
          style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
          onPress={onSave}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={saveError ? 'Retry save trip' : 'Save trip'}
          accessibilityHint="Saves this planned trip to your trip history"
          accessibilityState={{ busy: isSaving, disabled: isSaving }}
        >
          {isSaving ? (
            <View style={styles.saveBtnBusyRow}>
              <ActivityIndicator size="small" color="#000" />
              <Text style={styles.saveBtnText}>Saving...</Text>
            </View>
          ) : (
            <Text style={styles.saveBtnText}>{saveError ? 'Retry Save Trip' : 'Save Trip'}</Text>
          )}
        </TouchableOpacity>
        {saveError ? (
          <View style={styles.saveErrorBox}>
            <Text style={styles.saveErrorText}>{saveError}</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleSharePlan}
          accessibilityRole="button"
          accessibilityLabel="Share trip plan"
          accessibilityHint="Share this itinerary with friends and family"
        >
          <Text style={styles.shareBtnText}>Share Plan</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.exploreBtn}
          onPress={onKeepExploring}
          accessibilityRole="button"
          accessibilityLabel="Keep exploring"
          accessibilityHint="Returns to add-ons so you can update this itinerary"
        >
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
  sectionTitle: { color: '#5F9EA0', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' },
  sectionValue: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  sectionSubValue: { color: '#8F8F8F', fontSize: 11, marginTop: 4, lineHeight: 16 },
  row: { flexDirection: 'row' },
  quickEditRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  quickEditBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
  },
  quickEditText: { color: '#DDD', fontSize: 13, fontWeight: '700' },
  costRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  costLabel: { color: '#888', fontSize: 14 },
  costValue: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  costDivider: { height: 1, backgroundColor: '#333', marginVertical: 8 },
  costTotalLabel: { color: '#FFF', fontSize: 15, fontWeight: 'bold' },
  costTotalValue: { color: '#5F9EA0', fontSize: 15, fontWeight: 'bold' },
  budgetStatusText: { fontSize: 13, fontWeight: '700' },
  budgetUnderText: { color: '#32D74B' },
  budgetOverText: { color: '#4A7C7E' },
  addonDetailCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232323',
    padding: 10,
    marginBottom: 8,
  },
  addonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  addonText: { color: '#FFF', fontSize: 14, fontWeight: '500' },
  addonSubText: { color: '#8B8B8B', fontSize: 12, lineHeight: 18 },
  dayFlowCard: {
    backgroundColor: '#141414',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#232323',
    padding: 10,
    marginBottom: 8,
  },
  dayFlowTitle: {
    color: '#5F9EA0',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  dayFlowLine: { color: '#BBB', fontSize: 12, lineHeight: 18 },
  saveBtn: {
    backgroundColor: '#5F9EA0',
    height: 56,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  saveBtnDisabled: { opacity: 0.75 },
  saveBtnBusyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  saveErrorBox: {
    backgroundColor: 'rgba(74, 124, 126, 0.24)',
    borderWidth: 1,
    borderColor: 'rgba(74, 124, 126, 0.85)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: -6,
    marginBottom: 10,
  },
  saveErrorText: { color: '#A9CCCC', fontSize: 12, textAlign: 'center', fontWeight: '600' },
  shareBtn: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2C2C2C',
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  shareBtnText: { color: '#EAEAEA', fontSize: 14, fontWeight: '700' },
  exploreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  exploreBtnText: { color: '#888', fontSize: 14, fontWeight: 'bold' },
});

export default SuccessScreen;
