import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const Challans = ({ navigation, route }: any) => {
  const { vehicle } = route.params;
  const [isSyncing, setIsSyncing] = useState(false);

  const [challanList, setChallanList] = useState([
    {
      id: '1',
      type: 'Speed Violation',
      icon: 'bolt',
      amount: '2,000',
      status: 'UNPAID',
      date: '12 Jan 2026',
      location: 'NH-48, Pune',
    },
    {
      id: '2',
      type: 'Signal Jump',
      icon: 'traffic-light',
      amount: '2,500',
      status: 'PAID',
      date: '05 Dec 2025',
      location: 'Hinjewadi Ph-1, Pune',
    },
  ]);

  const handleSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 2000);
  };

  const markAsPaid = (id: string) => {
    setChallanList(prev =>
      prev.map(item => (item.id === id ? { ...item, status: 'PAID' } : item)),
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Challans</Text>
          <Text style={styles.headerSub}>
            {vehicle?.plate || vehicle?.vehicleNumber || 'MH12AB1234'}
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <TouchableOpacity
          style={styles.syncBtn}
          onPress={handleSync}
          activeOpacity={0.8}
        >
          <FontAwesome5
            name="sync-alt"
            size={wp(4)}
            color="#FFBF00"
            style={isSyncing ? { transform: [{ rotate: '45deg' }] } : {}}
          />
          <Text style={styles.syncBtnText}>
            {isSyncing ? 'Syncing...' : 'Sync Challans'}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        {challanList.map(item => (
          <View key={item.id} style={styles.challanCard}>
            <View style={styles.cardHeader}>
              <View style={styles.typeContainer}>
                <FontAwesome5
                  name={item.icon}
                  size={wp(4)}
                  color={item.status === 'UNPAID' ? '#f87171' : '#4ade80'}
                />
                <Text style={styles.typeName}>{item.type}</Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  item.status === 'PAID'
                    ? styles.paidBadge
                    : styles.unpaidBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    item.status === 'PAID'
                      ? styles.paidText
                      : styles.unpaidText,
                  ]}
                >
                  {item.status}
                </Text>
              </View>
            </View>

            <View style={styles.cardBody}>
              <View style={styles.infoRow}>
                <Text style={styles.amountText}>₹{item.amount}</Text>
                <Text style={styles.dateText}>{item.date}</Text>
              </View>

              <View style={styles.locationRow}>
                <FontAwesome5 name="map-marker-alt" size={wp(3)} color="#555" />
                <Text style={styles.locationText}>{item.location}</Text>
              </View>

              {item.status === 'UNPAID' && (
                <TouchableOpacity
                  style={styles.payBtn}
                  onPress={() => markAsPaid(item.id)}
                >
                  <Text style={styles.payBtnText}>Mark as Paid</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}

        {challanList.length === 0 && (
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="check-circle" size={wp(15)} color="#1a1a1a" />
            <Text style={styles.emptyText}>No pending challans found</Text>
          </View>
        )}
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
    paddingVertical: hp(1.5),
    marginBottom: hp(3),
  },
  backBtn: { padding: wp(2) },
  headerCenter: { flex: 1, marginLeft: wp(2) },
  headerTitle: { color: '#fff', fontSize: wp(6), fontWeight: '700' },
  headerSub: { color: '#888', fontSize: wp(3.5), marginTop: hp(0.2) },

  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(5) },
  syncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161616',
    paddingVertical: hp(1.8),
    borderRadius: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 191, 0, 0.2)',
  },
  syncBtnText: {
    color: '#FFBF00',
    fontWeight: 'bold',
    marginLeft: wp(3),
    fontSize: wp(4),
  },
  divider: { height: 1, backgroundColor: '#1a1a1a', marginVertical: hp(3) },

  challanCard: {
    backgroundColor: '#121212',
    borderRadius: 22,
    padding: wp(5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  typeContainer: { flexDirection: 'row', alignItems: 'center' },
  typeName: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: 'bold',
    marginLeft: wp(3),
  },

  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 8,
  },
  unpaidBadge: { backgroundColor: 'rgba(248, 113, 113, 0.1)' },
  paidBadge: { backgroundColor: 'rgba(74, 222, 128, 0.1)' },
  statusText: { fontSize: wp(2.8), fontWeight: 'bold' },
  unpaidText: { color: '#f87171' },
  paidText: { color: '#4ade80' },

  cardBody: { marginTop: hp(1) },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  amountText: { color: '#fff', fontSize: wp(6), fontWeight: 'bold' },
  dateText: { color: '#666', fontSize: wp(3.2) },

  locationRow: { flexDirection: 'row', alignItems: 'center', marginTop: hp(1) },
  locationText: { color: '#555', fontSize: wp(3.2), marginLeft: wp(2) },

  payBtn: {
    backgroundColor: '#fff',
    paddingVertical: hp(1.5),
    borderRadius: 12,
    alignItems: 'center',
    marginTop: hp(2.5),
  },
  payBtnText: { color: '#000', fontWeight: 'bold', fontSize: wp(3.8) },

  emptyContainer: { alignItems: 'center', marginTop: hp(10) },
  emptyText: { color: '#333', marginTop: hp(2), fontSize: wp(4) },
});

export default Challans;
