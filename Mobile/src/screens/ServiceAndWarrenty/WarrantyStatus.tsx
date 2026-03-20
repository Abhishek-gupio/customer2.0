import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../../services/api';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { PartStatusCard } from '../../components/ServiceAndWarranty/PartStatusCard';
import { WarrantySummary } from '../../components/ServiceAndWarranty/WarrantySummary';
import {
  getAndClearWarrantyStatusRefresh,
  setExpenseListNeedsRefresh,
  setWarrantyStatusNeedsRefresh,
} from '../../utils/refreshManager';
import BackButton from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

interface PartData {
  id: string;
  title: string;
  subtitle: string;
  percentage: number;
  statusText: string;
  color: string;
  icon: string;
  urgency: 'OVERDUE' | 'DUE_BY_KM' | 'DUE_SOON' | 'ACTIVE';
  predictedDate?: string;
  garageName?: string;
  serviceType?: string;
  warrantyMonths?: number;
  lastReplacedOdo?: number;
  kmSinceReplacement?: number;
  lifecycleKm?: number;
  lifecycleMonths?: number;
  lastReplacedAt?: string;
  currentOdo?: number;
  overdueByKm?: number;
  /** OEM_WEBSITE = scraped from OEM; DEFAULT/FALLBACK = not from OEM, may be incorrect */
  intervalSource?: string;
}

export const WarrantyStatus = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [parts, setParts] = useState<PartData[]>([]);
  const [summary, setSummary] = useState({ active: 0, expired: 0, critical: 0 });
  const [selectedPart, setSelectedPart] = useState<PartData | null>(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [updateAmount, setUpdateAmount] = useState('');
  const [updateOdometer, setUpdateOdometer] = useState('');
  const [updateDate, setUpdateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [updateNotes, setUpdateNotes] = useState('');
  const [savingUpdate, setSavingUpdate] = useState(false);

  const getPartIcon = (type: string) => {
    switch (type) {
      case 'ENGINE_OIL': return 'oil';
      case 'BATTERY': return 'battery';
      case 'TYRES_FRONT':
      case 'TYRES_REAR': return 'car-tire-alert';
      case 'BRAKE_PADS': return 'disc';
      case 'AIR_FILTER': return 'air-filter';
      case 'COOLANT': return 'coolant-temperature';
      default: return 'wrench';
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'OVERDUE': return '#EF4444';
      case 'DUE_BY_KM': return '#F59E0B';
      case 'DUE_SOON': return '#F97316';
      default: return '#22C55E';
    }
  };

  const getUrgencyLabel = (urgency: string) => {
    switch (urgency) {
      case 'OVERDUE': return 'Overdue';
      case 'DUE_BY_KM': return 'Due by km';
      case 'DUE_SOON': return 'Due soon';
      case 'ACTIVE': return 'Active';
      default: return (urgency || '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
  };

  const fetchData = async () => {
    try {
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
      if (!primary) {
        setLoading(false);
        return;
      }
      setVehicle(primary);

      // Refresh OEM manual intervals for primary vehicle (fire-and-forget) so part intervals match OEM e.g. 60k km for tyres
      api.post('/v1/expenses/warranty/primary/refresh-oem').catch(() => {});

      const [warrantyRes, upcomingRes] = await Promise.all([
        api.get<any>(`/v1/expenses/warranty/vehicles/${primary.id}/status`),
        api.get<any[]>(`/v1/expenses/warranty/vehicles/${primary.id}/upcoming`),
      ]);

      // Handle both {data: []} and [] formats depending on api service behavior
      const warrantyData = (warrantyRes as any).data || warrantyRes;
      const upcomingData = (upcomingRes as any).data || upcomingRes;

      const processedParts: PartData[] = Array.isArray(upcomingData) ? upcomingData.map((item: any) => {
        const lifecycleKm = item.lifecycleKm || 10000;
        const kmSinceReplacement = item.kmSinceReplacement || 0;
        const percentage = Math.round((1 - (kmSinceReplacement / lifecycleKm)) * 100);

        return {
          id: item.partType,
          title: item.partType.replace(/_/g, ' '),
          subtitle: item.message,
          percentage: Math.max(0, Math.min(100, percentage)),
          statusText: getUrgencyLabel(item.urgency),
          color: getUrgencyColor(item.urgency),
          icon: getPartIcon(item.partType),
          urgency: item.urgency,
          predictedDate: item.predictedReplacementDate ? new Date(item.predictedReplacementDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : undefined,
          garageName: item.garageName,
          serviceType: item.serviceType,
          warrantyMonths: item.warrantyMonths,
          lastReplacedOdo: item.lastReplacedOdo,
          kmSinceReplacement: item.kmSinceReplacement,
          lifecycleKm: item.lifecycleKm,
          lifecycleMonths: item.lifecycleMonths,
          lastReplacedAt: item.lastReplacedAt,
          currentOdo: primary.currentOdometer,
          overdueByKm: item.overdueByKm,
          intervalSource: item.intervalSource,
        };
      }) : [];

      const activeCount = processedParts.filter(p => p.percentage > 15).length;
      const expiredCount = processedParts.filter(p => p.percentage <= 15).length;

      setParts(processedParts);
      setSummary({
        active: activeCount,
        expired: expiredCount,
        critical: 0 // No longer used in summary UI but kept in state for now
      });

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (part: PartData) => {
    setSelectedPart(part);
    setUpdateAmount('');
    setUpdateOdometer(vehicle?.currentOdometer ? String(vehicle.currentOdometer) : '');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes(part.subtitle || '');
    setIsUpdateModalVisible(true);
  };

  const closeUpdateModal = () => {
    setIsUpdateModalVisible(false);
    setSelectedPart(null);
    setUpdateAmount('');
    setUpdateOdometer('');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes('');
  };

  const handlePartUpdate = async () => {
    if (!vehicle || !selectedPart) {
      return;
    }

    const parsedAmount = Number(updateAmount);
    const parsedOdometer = Number(updateOdometer);

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid part cost.');
      return;
    }

    if (!Number.isFinite(parsedOdometer) || parsedOdometer <= 0) {
      Alert.alert('Invalid odometer', 'Enter a valid odometer reading.');
      return;
    }

    if (!updateDate.trim()) {
      Alert.alert('Missing date', 'Enter the service date in YYYY-MM-DD format.');
      return;
    }

    const parsedDate = new Date(updateDate);
    if (Number.isNaN(parsedDate.getTime())) {
      Alert.alert('Invalid date', 'Enter the service date in YYYY-MM-DD format.');
      return;
    }

    setSavingUpdate(true);
    try {
      await api.post('/v1/expenses', {
        amount: parsedAmount,
        category: 'SERVICE',
        vehicleId: vehicle.id,
        notes: updateNotes.trim() || undefined,
        date: parsedDate.toISOString(),
        source: 'MANUAL',
        odometerReading: parsedOdometer,
        parts: [
          {
            partType: selectedPart.id,
            cost: parsedAmount,
          },
        ],
      });

      setExpenseListNeedsRefresh();
      setWarrantyStatusNeedsRefresh();
      closeUpdateModal();
      await fetchData();
      Alert.alert('Success', `${selectedPart.title} updated successfully.`);
    } catch (error: any) {
      console.error('Part update failed:', error);
      Alert.alert('Error', error?.message || 'Failed to update part.');
    } finally {
      setSavingUpdate(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  // Periodic check or manual trigger check since FocusEffect might not catch Modal closes
  useEffect(() => {
    const timer = setInterval(() => {
      if (getAndClearWarrantyStatusRefresh()) {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Warranty Status</Text>
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Icon name="car" size={wp(15)} color="#333" />
          <Text style={{ color: '#888', marginTop: 20, fontSize: wp(4), textAlign: 'center' }}>
            No vehicles found. Please add a vehicle to track its warranty and maintenance.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Warranty Status</Text>
            {vehicle && <Text style={styles.vehicleSub}>{vehicle.registrationNumber}</Text>}
          </View>
        </View>
        <WarrantySummary
          active={summary.active}
          expired={summary.expired}
        />
      </View>

      {parts.some(p => (p.intervalSource || '').toUpperCase() !== 'OEM_WEBSITE') && (
        <View style={styles.oemWarningBanner}>
          <Icon name="exclamation-triangle" size={wp(4)} color="#F59E0B" style={styles.oemWarningIcon} />
          <Text style={styles.oemWarningText}>
            Intervals not from OEM manual — data may be incorrect. Set vehicle make/model and pull to refresh to fetch from manufacturer.
          </Text>
        </View>
      )}

      <FlatList
        data={parts}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />
        }
        renderItem={({ item }) => (
          <PartStatusCard
            {...item}
            onPressHistory={() =>
              navigation.navigate('ServiceHistory', { selectedPartType: item.id })
            }
            onPressUpdate={() => openUpdateModal(item)}
          />
        )}
        style={styles.list}
      />

      <Modal transparent visible={isUpdateModalVisible} animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={closeUpdateModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Pressable style={styles.modalPanel} onPress={() => {}}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Update Part</Text>
                  <Text style={styles.modalSubtitle}>{selectedPart?.title || ''}</Text>
                </View>
                <TouchableOpacity onPress={closeUpdateModal} disabled={savingUpdate}>
                  <Icon name="times" size={wp(5)} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Part Cost</Text>
              <TextInput
                value={updateAmount}
                onChangeText={setUpdateAmount}
                keyboardType="numeric"
                placeholder="Enter amount"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Odometer Reading</Text>
              <TextInput
                value={updateOdometer}
                onChangeText={setUpdateOdometer}
                keyboardType="numeric"
                placeholder="Enter km"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Service Date</Text>
              <TextInput
                value={updateDate}
                onChangeText={setUpdateDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor="#666"
                style={styles.input}
              />

              <Text style={styles.inputLabel}>Notes</Text>
              <TextInput
                value={updateNotes}
                onChangeText={setUpdateNotes}
                placeholder="Optional notes"
                placeholderTextColor="#666"
                style={[styles.input, styles.notesInput]}
                multiline
              />

              <TouchableOpacity
                style={[styles.updateButton, savingUpdate && styles.updateButtonDisabled]}
                onPress={handlePartUpdate}
                disabled={savingUpdate}
              >
                {savingUpdate ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.updateButtonText}>Save Update</Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  headerContainer: {
    paddingBottom: hp(2),
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(5),
    marginRight: wp(4),
  },
  headerText: {
    flex: 1,
    marginLeft: wp(3), // Added marginLeft
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
  },
  vehicleSub: {
    color: '#888',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  list: {
    flex: 1,
  },
  listContainer: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
    paddingTop: hp(1),
  },
  oemWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 158, 11, 0.4)',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  oemWarningIcon: {
    marginRight: wp(2),
  },
  oemWarningText: {
    flex: 1,
    fontSize: wp(3.2),
    color: '#F59E0B',
    lineHeight: 18,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(4),
  },
  modalKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  modalPanel: {
    width: '100%',
    backgroundColor: '#151515',
    borderRadius: wp(6),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
    gap: wp(3),
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  modalSubtitle: {
    color: '#999',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Regular',
    marginTop: hp(0.3),
  },
  inputLabel: {
    color: '#bbb',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
    marginBottom: hp(0.8),
  },
  input: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: wp(4),
    color: '#fff',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    marginBottom: hp(1.8),
  },
  notesInput: {
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  updateButton: {
    backgroundColor: '#FFBF00',
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: hp(6.5),
    marginTop: hp(1),
  },
  updateButtonDisabled: {
    opacity: 0.7,
  },
  updateButtonText: {
    color: '#000',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
  },
});
