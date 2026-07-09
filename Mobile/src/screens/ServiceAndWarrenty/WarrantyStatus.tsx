import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusModal from '../../components/common/Modals/StatusModal';
import { api } from '../../services/api';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { PartStatusCard } from '../../components/ServiceAndWarranty/PartStatusCard';
import { WarrantySummary } from '../../components/ServiceAndWarranty/WarrantySummary';
import {
  getAndClearWarrantyStatusRefresh,
  setWarrantyStatusNeedsRefresh,
} from '../../utils/refreshManager';
import { useExpenseStore } from '../../store/expenseStore';
import BackButton from '../../components/BackButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { RootStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PART_TYPE_OPTIONS, getPartTypeLabel } from '../../constants/partTypes';

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
  /** VERIFIED | AI_PREDICTED | ESTIMATED — pre-computed equivalent of intervalSource tiering */
  dataQuality?: string;
}

const OEM_WARNING_EXCLUDED_PART_TYPES = new Set(["OTHER_PART"]);
const OEM_INTERVAL_SOURCES = new Set(["OEM_WEBSITE", "OEM"]);

const normalizeSelectedPartTypes = (partTypes: string[]): string[] => {
  const normalized = new Set<string>();

  for (const partType of partTypes) {
    const value = String(partType || '').trim().toUpperCase();
    if (!value) continue;

    if (value === 'TYRES') {
      normalized.add('TYRES_FRONT');
      normalized.add('TYRES_REAR');
      continue;
    }

    normalized.add(value);
  }

  return Array.from(normalized);
};

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
  const [selectedPartTypes, setSelectedPartTypes] = useState<string[]>([]);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [savingUpdate, setSavingUpdate] = useState(false);
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });
  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };

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

  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchData = useCallback(async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
      if (!primary || !isMountedRef.current) {
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }
      
      setVehicle(primary);

      api.post('/v1/expenses/warranty/primary/refresh-oem').catch(() => {});

      const [statusRes, upcomingRes, _] = await Promise.all([
        api.get<any>(`/v1/expenses/warranty/vehicles/${primary.id}/status`),
        api.get<any[]>(`/v1/expenses/warranty/vehicles/${primary.id}/upcoming`),
        vehicleService.recalculateHealth(primary.id).catch(() => null)
      ]);

      if (!isMountedRef.current) return;

      const upcomingData = (upcomingRes as any).data || upcomingRes;

      const processedParts: PartData[] = Array.isArray(upcomingData) ? upcomingData.map((item: any) => {
        const lifecycleKm = item.lifecycleKm || 10000;
        const kmSinceReplacement = item.kmSinceReplacement || 0;
        const percentage = Math.round((1 - (kmSinceReplacement / lifecycleKm)) * 100);

        return {
          id: item.partType,
          title: getPartTypeLabel(item.partType),
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
          dataQuality: item.dataQuality,
        };
      }) : [];

      const activeCount = processedParts.filter(p => p.percentage > 15).length;
      const expiredCount = processedParts.filter(p => p.percentage <= 15).length;

      setParts(processedParts);
      setSummary({
        active: activeCount,
        expired: expiredCount,
        critical: 0
      });

      const refreshed = await vehicleService.getVehicleById(primary.id).catch(() => null);
      if (refreshed && isMountedRef.current) setVehicle(refreshed);

    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      if (isMountedRef.current) setLoading(false);
      isFetchingRef.current = false;
    }
  }, []);

  const handlePressHistory = useCallback((partId: string) => {
    navigation.navigate('ServiceHistory', { selectedPartType: partId });
  }, [navigation]);

  const openUpdateModal = useCallback((part: PartData) => {
    setSelectedPart(part);
    setSelectedPartTypes([part.id]);
    setUpdateAmount('');
    setUpdateOdometer(vehicle?.currentOdometer ? String(vehicle.currentOdometer) : '');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes(part.subtitle || '');
    requestAnimationFrame(() => {
      setIsUpdateModalVisible(true);
    });
  }, [vehicle?.currentOdometer]);

  const handlePressUpdate = useCallback((item: PartData) => {
    openUpdateModal(item);
  }, [openUpdateModal]);

  const closeUpdateModal = useCallback(() => {
    setIsUpdateModalVisible(false);
    setSelectedPart(null);
    setSelectedPartTypes([]);
    setShowPartPicker(false);
    setUpdateAmount('');
    setUpdateOdometer('');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes('');
  }, []);

  const handlePartUpdate = useCallback(async () => {
    if (!vehicle || !selectedPart) {
      return;
    }

    const normalizedPartTypes = normalizeSelectedPartTypes(selectedPartTypes);

    const parsedAmount = Number(updateAmount);
    const parsedOdometer = Number(updateOdometer);

    if (normalizedPartTypes.length === 0) {
      showStatus('Missing parts', 'Select at least one part to update.', 'error');
      return;
    }

    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showStatus('Invalid amount', 'Enter a valid part cost.', 'error');
      return;
    }

    if (!Number.isFinite(parsedOdometer) || parsedOdometer <= 0) {
      showStatus('Invalid odometer', 'Enter a valid odometer reading.', 'error');
      return;
    }

    if (!updateDate.trim()) {
      showStatus('Missing date', 'Enter the service date in YYYY-MM-DD format.', 'error');
      return;
    }

    const parsedDate = new Date(updateDate);
    if (Number.isNaN(parsedDate.getTime())) {
      showStatus('Invalid date', 'Enter the service date in YYYY-MM-DD format.', 'error');
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
        parts: normalizedPartTypes.map((partType) => ({
          partType,
          cost: parsedAmount,
        })),
      });

      useExpenseStore.getState().notifyCreated();
      setWarrantyStatusNeedsRefresh();
      closeUpdateModal();
      await fetchData();
      showStatus(
        'Success',
        normalizedPartTypes.length === 1
          ? `${getPartTypeLabel(normalizedPartTypes[0])} updated successfully.`
          : `${normalizedPartTypes.length} parts updated successfully.`
      );
    } catch (error: any) {
      console.error('Part update failed:', error);
      showStatus('Error', error?.message || 'Failed to update part.', 'error');
    } finally {
      setSavingUpdate(false);
    }
  }, [vehicle, selectedPart, selectedPartTypes, updateAmount, updateOdometer, updateDate, updateNotes, closeUpdateModal, fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  useEffect(() => {
    const timer = setInterval(() => {
      if (getAndClearWarrantyStatusRefresh()) {
        fetchData();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center' }]}>
        <LoadingSpinner visible={true} />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Vehicle Health</Text>
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
            <Text style={styles.headerTitle}>Vehicle Health</Text>
            {vehicle && <Text style={styles.vehicleSub}>{vehicle.registrationNumber}</Text>}
          </View>
        </View>
      </View>
      <FlatList
        ListHeaderComponent={
          <View style={{ marginBottom: 15 }}>
            <WarrantySummary
              active={summary.active}
              expired={summary.expired}
              health={vehicle?.healthScore?.overallScore ?? 0}
            />
          </View>
        }
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
            onPressHistory={() => handlePressHistory(item.id)}
            onPressUpdate={() => handlePressUpdate(item)}
          />
        )}
        style={styles.list}
      />

      <Modal transparent visible={isUpdateModalVisible} animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={closeUpdateModal}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Pressable style={styles.modalPanel} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Update Part</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedPartTypes.length > 0
                      ? PART_TYPE_OPTIONS
                          .filter((part) => selectedPartTypes.includes(part.value))
                          .map((part) => part.label)
                          .join(', ')
                      : selectedPart?.title || ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={closeUpdateModal} disabled={savingUpdate}>
                  <Icon name="times" size={wp(5)} color="#fff" />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Parts Serviced</Text>
              <TouchableOpacity
                style={styles.selectorInput}
                onPress={() => setShowPartPicker(true)}
                disabled={savingUpdate}
              >
                <Text
                  style={[
                    styles.selectorInputText,
                    selectedPartTypes.length === 0 && styles.selectorPlaceholderText,
                  ]}
                >
                  {selectedPartTypes.length > 0
                    ? PART_TYPE_OPTIONS
                        .filter((part) => selectedPartTypes.includes(part.value))
                        .map((part) => part.label)
                        .join(', ')
                    : 'Select parts'}
                </Text>
                <Icon name="chevron-down" size={wp(3.5)} color="#999" />
              </TouchableOpacity>

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
                {savingUpdate ? null : (
                  <Text style={styles.updateButtonText}>Save Update</Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal transparent visible={showPartPicker} animationType="fade" statusBarTranslucent>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowPartPicker(false)}>
          <Pressable style={styles.partPickerPanel} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.partPickerTitle}>Select Parts</Text>
            <ScrollView style={styles.partPickerScroll} showsVerticalScrollIndicator={false}>
              {PART_TYPE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.partPickerItem,
                    selectedPartTypes.includes(item.value) && styles.partPickerItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedPartTypes((prev) =>
                      prev.includes(item.value)
                        ? prev.filter((value) => value !== item.value)
                        : [...prev, item.value],
                    );
                  }}
                >
                  <Text style={styles.partPickerItemText}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.partPickerActions}>
              <TouchableOpacity
                style={styles.partPickerActionButton}
                onPress={() => setSelectedPartTypes(selectedPart ? [selectedPart.id] : [])}
              >
                <Text style={styles.partPickerActionText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.partPickerActionButton}
                onPress={() => setShowPartPicker(false)}
              >
                <Text style={styles.partPickerActionText}>Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp(5),
  },
  loadingBarText: {
    color: '#b5b5b5',
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
    marginTop: hp(1.4),
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
  selectorInput: {
    backgroundColor: '#0f0f0f',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.7),
    marginBottom: hp(1.8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: wp(3),
  },
  selectorInputText: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Regular',
  },
  selectorPlaceholderText: {
    color: '#666',
  },
  notesInput: {
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  partPickerPanel: {
    width: '100%',
    maxWidth: wp(90),
    maxHeight: hp(65),
    backgroundColor: '#151515',
    borderRadius: wp(6),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  partPickerTitle: {
    color: '#fff',
    fontSize: wp(4.8),
    fontFamily: 'Outfit-Bold',
    marginBottom: hp(1.5),
  },
  partPickerScroll: {
    maxHeight: hp(45),
  },
  partPickerItem: {
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(4),
    borderRadius: wp(3.5),
    backgroundColor: '#0f0f0f',
    marginBottom: hp(1),
  },
  partPickerItemSelected: {
    borderWidth: 1,
    borderColor: '#FFBF00',
    backgroundColor: 'rgba(255,191,0,0.12)',
  },
  partPickerItemText: {
    color: '#fff',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
  },
  partPickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: wp(3),
    marginTop: hp(1),
  },
  partPickerActionButton: {
    backgroundColor: '#242424',
    borderRadius: wp(3.5),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  partPickerActionText: {
    color: '#fff',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
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
