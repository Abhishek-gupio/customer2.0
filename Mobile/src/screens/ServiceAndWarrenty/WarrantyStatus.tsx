import React, { useEffect, useState, useCallback } from 'react';
import {
  FlatList,
  StyleSheet,
  View,
  Text,
  RefreshControl,
  StatusBar,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import StatusModal from '../../components/common/Modals/StatusModal';
import type { Vehicle } from '../../services/vehicleService';
import {
  normalizeSelectedWarrantyPartTypes,
  type WarrantyDashboardPart,
  warrantyService,
} from '../../services/warrantyService';
import { PartStatusCard } from '../../components/ServiceAndWarranty/PartStatusCard';
import { WarrantyUpdateModal } from '../../components/ServiceAndWarranty/WarrantyUpdateModal';
import { WarrantySummary } from '../../components/ServiceAndWarranty/WarrantySummary';
import {
  setExpenseListNeedsRefresh,
  setWarrantyStatusNeedsRefresh,
  subscribeWarrantyStatusRefresh,
} from '../../utils/refreshManager';
import BackButton from '../../components/BackButton';
import LoadingSpinner from '../../components/LoadingSpinner';
import type { RootStackParamList } from '../../navigation/types';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getPartTypeLabel } from '../../constants/partTypes';

export const WarrantyStatus = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [parts, setParts] = useState<WarrantyDashboardPart[]>([]);
  const [summary, setSummary] = useState({ active: 0, expired: 0, critical: 0 });
  const [selectedPart, setSelectedPart] = useState<WarrantyDashboardPart | null>(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);
  const [updateAmount, setUpdateAmount] = useState('');
  const [updateOdometer, setUpdateOdometer] = useState('');
  const [updateDate, setUpdateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [updateNotes, setUpdateNotes] = useState('');
  const [selectedPartTypes, setSelectedPartTypes] = useState<string[]>([]);
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

  const fetchData = useCallback(async () => {
    try {
      const dashboard = await warrantyService.fetchPrimaryWarrantyDashboard();
      if (!dashboard.vehicle) {
        setVehicle(null);
        setParts([]);
        setSummary({ active: 0, expired: 0, critical: 0 });
        setLoading(false);
        return;
      }
      setVehicle(dashboard.vehicle);
      setParts(dashboard.parts);
      setSummary({
        active: dashboard.summary.active,
        expired: dashboard.summary.expired,
        critical: dashboard.summary.critical,
      });
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const openUpdateModal = (part: WarrantyDashboardPart) => {
    setSelectedPart(part);
    setSelectedPartTypes([part.id]);
    setUpdateAmount('');
    setUpdateOdometer(vehicle?.currentOdometer ? String(vehicle.currentOdometer) : '');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes(part.subtitle || '');
    requestAnimationFrame(() => {
      setIsUpdateModalVisible(true);
    });
  };

  const closeUpdateModal = () => {
    setIsUpdateModalVisible(false);
    setSelectedPart(null);
    setSelectedPartTypes([]);
    setUpdateAmount('');
    setUpdateOdometer('');
    setUpdateDate(new Date().toISOString().slice(0, 10));
    setUpdateNotes('');
  };

  const handlePartUpdate = async () => {
    if (!vehicle || !selectedPart) {
      return;
    }

    const normalizedPartTypes = normalizeSelectedWarrantyPartTypes(selectedPartTypes);

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
      await warrantyService.createManualWarrantyUpdate({
        amount: parsedAmount,
        vehicleId: vehicle.id,
        notes: updateNotes.trim() || undefined,
        date: parsedDate.toISOString(),
        odometerReading: parsedOdometer,
        partTypes: normalizedPartTypes,
      });

      setExpenseListNeedsRefresh();
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
  };

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
    const unsubscribe = subscribeWarrantyStatusRefresh(() => {
      fetchData();
    });
    return unsubscribe;
  }, [fetchData]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.safeCentered]}>
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
        <View style={styles.emptyState}>
          <Icon name="car" size={wp(15)} color="#333" />
          <Text style={styles.emptyStateText}>
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
          <View style={styles.listHeader}>
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
            onPressHistory={() =>
              navigation.navigate('ServiceHistory', { selectedPartType: item.id })
            }
            onPressUpdate={() => openUpdateModal(item)}
          />
        )}
        style={styles.list}
      />

      <WarrantyUpdateModal
        visible={isUpdateModalVisible}
        selectedPart={selectedPart}
        selectedPartTypes={selectedPartTypes}
        updateAmount={updateAmount}
        updateOdometer={updateOdometer}
        updateDate={updateDate}
        updateNotes={updateNotes}
        savingUpdate={savingUpdate}
        onClose={closeUpdateModal}
        onSave={handlePartUpdate}
        onSelectedPartTypesChange={setSelectedPartTypes}
        onUpdateAmountChange={setUpdateAmount}
        onUpdateOdometerChange={setUpdateOdometer}
        onUpdateDateChange={setUpdateDate}
        onUpdateNotesChange={setUpdateNotes}
      />

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
  safeCentered: {
    justifyContent: 'center',
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
  listHeader: {
    marginBottom: 15,
  },
  listContainer: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
    paddingTop: hp(1),
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    color: '#888',
    marginTop: 20,
    fontSize: wp(4),
    textAlign: 'center',
  },
});
