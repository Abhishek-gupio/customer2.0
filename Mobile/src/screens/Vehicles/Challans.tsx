import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../components/BackButton';
import { vehicleService } from '../../services/vehicleService';

export interface Challan {
  id: string;
  type: string;
  icon: string;
  amount: number;
  status: 'UNPAID' | 'PAID' | 'PENDING';
  date: string;
  location: string;
  dueDate?: string;
  offeneAmount?: number;
}

export interface Vehicle {
  vehicleNumber: string;
  model: string;
  brand?: string;
}

interface ChallansScreenProps {
  vehicle: Vehicle;
  onSync?: () => Promise<void>;
  onMarkAsPaid?: (challanId: string) => Promise<void>;
  initialChallans?: Challan[];
}

const Challans: React.FC<any> = ({ navigation, route }: any) => {
  const vehicleData = route.params?.vehicle;

  const [isSyncing, setIsSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [challanList, setChallanList] = useState<Challan[]>([]);

  const fetchChallans = useCallback(async () => {
    if (!vehicleData?.id) return;
    try {
      const data = await vehicleService.getChallans(vehicleData.id);
      // Map backend fields to frontend UI expectations seamlessly
      const mapped = data.map((c: any) => ({
        id: c.id,
        type: c.violationNumber || 'Traffic Violation',
        icon: 'receipt', // fallback icon
        amount: c.amount,
        status: c.status,
        date: new Date(c.violationDate).toLocaleDateString(),
        location: c.location || 'Unknown',
        dueDate: c.dueDate,
        offeneAmount: c.offeneAmount,
      }));
      setChallanList(mapped);
    } catch (err) {
      console.error('Fetch challans error:', err);
    }
  }, [vehicleData?.id]);

  React.useEffect(() => {
    fetchChallans();
  }, [fetchChallans]);

  const handleSync = useCallback(async () => {
    if (!vehicleData?.id) return;
    setIsSyncing(true);
    try {
      await vehicleService.syncChallans(vehicleData.id);
      Alert.alert('Success', 'Challans synced successfully!');
      fetchChallans(); // refresh list
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to sync challans');
    } finally {
      setIsSyncing(false);
    }
  }, [vehicleData?.id, fetchChallans]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChallans();
    setRefreshing(false);
  }, [fetchChallans]);

  const handleMarkAsPaid = (challanId: string) => {
    Alert.alert(
      'Mark as Paid',
      'Are you sure you want to mark this challan as paid?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              await vehicleService.markChallanAsPaid(challanId);
              setChallanList(prev =>
                prev.map(item =>
                  item.id === challanId
                    ? { ...item, status: 'PAID' as const }
                    : item,
                ),
              );
              Alert.alert('Success', 'Challan marked as paid!');
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to update status');
            }
          },
        },
      ],
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'UNPAID':
        return '#ef4444';
      case 'PAID':
        return '#22c55e';
      case 'PENDING':
        return '#f59e0b';
      default:
        return '#888';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'UNPAID':
        return 'rgba(239,68,68,0.15)';
      case 'PAID':
        return 'rgba(34,197,94,0.15)';
      case 'PENDING':
        return 'rgba(245,158,11,0.15)';
      default:
        return 'rgba(136,136,136,0.15)';
    }
  };

  const getIconBg = (type: string) => {
    if (type.includes('Speed')) return 'rgba(239,68,68,0.15)';
    if (type.includes('Signal')) return 'rgba(245,158,11,0.15)';
    if (type.includes('Parking')) return 'rgba(59,130,246,0.15)';
    return 'rgba(136,136,136,0.15)';
  };

  const getIconColor = (type: string) => {
    if (type.includes('Speed')) return '#ef4444';
    if (type.includes('Signal')) return '#f59e0b';
    if (type.includes('Parking')) return '#3b82f6';
    return '#888';
  };

  const unpaidChallans = challanList.filter(c => c.status === 'UNPAID');
  const paidChallans = challanList.filter(c => c.status === 'PAID');
  const totalUnpaidAmount = unpaidChallans.reduce(
    (sum, c) => sum + c.amount,
    0,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <BackButton onPress={() => navigation.goBack()} />
      <View style={styles.header}>
        <View style={[styles.headerCenter, { marginLeft: 0 }]}>
          <Text style={styles.headerTitle}>Challans</Text>
          <Text style={styles.headerSubtitle}>
            {vehicleData?.plate ||
              vehicleData?.vehicleNumber ||
              'DL 01 AB 1234'}{' '}
            - {vehicleData?.model || 'Swift'}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.syncIconBtn}
          onPress={handleSync}
          activeOpacity={0.7}
        >
          <FontAwesome5
            name="sync-alt"
            size={wp(4)}
            color={isSyncing ? '#666' : '#FFBF00'}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFBF00"
            colors={['#FFBF00']}
          />
        }
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total Challans</Text>
              <Text style={styles.summaryValue}>{challanList.length}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Unpaid</Text>
              <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                {unpaidChallans.length}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Amount Due</Text>
              <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
                ₹{totalUnpaidAmount.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>

        {unpaidChallans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Unpaid Challans</Text>
              <View style={styles.sectionLine} />
            </View>

            {unpaidChallans.map(item => (
              <View key={item.id} style={styles.challanCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeContainer}>
                    <View
                      style={[
                        styles.iconBg,
                        { backgroundColor: getIconBg(item.type) },
                      ]}
                    >
                      <FontAwesome5
                        name={item.icon as any}
                        size={wp(4)}
                        color={getIconColor(item.type)}
                      />
                    </View>
                    <View>
                      <Text style={styles.typeName}>{item.type}</Text>
                      <Text style={styles.challanId}>
                        #CHN{item.id.padStart(5, '0')}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBg(item.status) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.amountRow}>
                    <View>
                      <Text style={styles.amountLabel}>Challan Amount</Text>
                      <Text style={styles.amountText}>
                        ₹{item.amount.toLocaleString()}
                      </Text>
                    </View>
                    {item.offeneAmount && item.offeneAmount > 0 && (
                      <View style={styles.offeneContainer}>
                        <Text style={styles.offeneLabel}>After Due Date</Text>
                        <Text style={styles.offeneAmount}>
                          ₹{(item.amount + item.offeneAmount).toLocaleString()}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                      <FontAwesome5
                        name="calendar-alt"
                        size={wp(3)}
                        color="#555"
                      />
                      <Text style={styles.detailText}>{item.date}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <FontAwesome5
                        name="map-marker-alt"
                        size={wp(3)}
                        color="#555"
                      />
                      <Text style={styles.detailText}>{item.location}</Text>
                    </View>
                    {item.dueDate && (
                      <View style={[styles.detailRow, { marginTop: hp(0.5) }]}>
                        <FontAwesome5
                          name="clock"
                          size={wp(3)}
                          color="#f59e0b"
                        />
                        <Text style={[styles.detailText, { color: '#f59e0b' }]}>
                          Due: {item.dueDate}
                        </Text>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={styles.payBtn}
                    onPress={() => handleMarkAsPaid(item.id)}
                    activeOpacity={0.8}
                  >
                    <FontAwesome5
                      name="credit-card"
                      size={wp(4)}
                      color="#000"
                    />
                    <Text style={styles.payBtnText}>Pay Now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {paidChallans.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Paid Challans</Text>
              <View style={styles.sectionLine} />
            </View>

            {paidChallans.map(item => (
              <View key={item.id} style={[styles.challanCard, styles.paidCard]}>
                <View style={styles.cardHeader}>
                  <View style={styles.typeContainer}>
                    <View
                      style={[
                        styles.iconBg,
                        { backgroundColor: 'rgba(34,197,94,0.15)' },
                      ]}
                    >
                      <FontAwesome5
                        name={item.icon as any}
                        size={wp(4)}
                        color="#22c55e"
                      />
                    </View>
                    <View>
                      <Text style={styles.typeName}>{item.type}</Text>
                      <Text style={styles.challanId}>
                        #CHN{item.id.padStart(5, '0')}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: getStatusBg(item.status) },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        { color: getStatusColor(item.status) },
                      ]}
                    >
                      {item.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <View style={styles.amountRow}>
                    <View>
                      <Text style={styles.amountLabel}>Paid Amount</Text>
                      <Text style={styles.amountText}>
                        ₹{item.amount.toLocaleString()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsContainer}>
                    <View style={styles.detailRow}>
                      <FontAwesome5
                        name="calendar-check"
                        size={wp(3)}
                        color="#22c55e"
                      />
                      <Text style={[styles.detailText, { color: '#22c55e' }]}>
                        {item.date}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <FontAwesome5
                        name="map-marker-alt"
                        size={wp(3)}
                        color="#555"
                      />
                      <Text style={styles.detailText}>{item.location}</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {challanList.length === 0 && (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBg}>
              <FontAwesome5 name="check-double" size={wp(12)} color="#22c55e" />
            </View>
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptySubtext}>
              No challans found for this vehicle. Drive safe!
            </Text>
          </View>
        )}

        <View style={styles.footerInfo}>
          <FontAwesome5 name="info-circle" size={14} color="#555" />
          <Text style={styles.footerText}>
            Challan data is synced from the Parivahan portal. Last updated just
            now.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: { flex: 1, marginLeft: wp(3) },
  headerTitle: { color: '#fff', fontSize: wp(5.5), fontWeight: 'bold' },
  headerSubtitle: { color: '#666', fontSize: wp(3.2), marginTop: 2 },
  syncIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(5) },
  summaryCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: wp(4),
    marginTop: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  summaryLabel: { color: '#666', fontSize: wp(2.8), fontWeight: '600' },
  summaryValue: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: 'bold',
    marginTop: 4,
  },

  section: { marginTop: hp(3) },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: wp(3),
  },

  challanCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: wp(4),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  paidCard: { opacity: 0.8 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  typeContainer: { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: { color: '#fff', fontSize: wp(4), fontWeight: 'bold' },
  challanId: { color: '#444', fontSize: wp(2.5), marginTop: 2 },
  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 8,
  },
  statusText: { fontSize: wp(2.5), fontWeight: 'bold' },

  cardBody: { marginTop: hp(1) },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  amountLabel: { color: '#666', fontSize: wp(2.8) },
  amountText: {
    color: '#fff',
    fontSize: wp(6),
    fontWeight: 'bold',
    marginTop: 2,
  },
  offeneContainer: { alignItems: 'flex-end' },
  offeneLabel: { color: '#f59e0b', fontSize: wp(2.5) },
  offeneAmount: {
    color: '#f59e0b',
    fontSize: wp(4),
    fontWeight: 'bold',
    marginTop: 2,
  },

  detailsContainer: { marginTop: hp(2) },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    marginBottom: hp(0.5),
  },
  detailText: { color: '#666', fontSize: wp(3), flex: 1 },

  payBtn: {
    backgroundColor: '#FFBF00',
    borderRadius: 14,
    paddingVertical: hp(1.8),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    marginTop: hp(2.5),
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  payBtnText: { color: '#000', fontSize: wp(4), fontWeight: 'bold' },

  emptyContainer: { alignItems: 'center', marginTop: hp(8) },
  emptyIconBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34,197,94,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: 'bold',
    marginTop: hp(2),
  },
  emptySubtext: {
    color: '#666',
    fontSize: wp(3.2),
    marginTop: hp(1),
    textAlign: 'center',
  },

  footerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2),
    marginTop: hp(3),
    padding: wp(3),
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
  },
  footerText: { color: '#444', fontSize: wp(2.8), flex: 1, lineHeight: wp(4) },
});

export default Challans;
