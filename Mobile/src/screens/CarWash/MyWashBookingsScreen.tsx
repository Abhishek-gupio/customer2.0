import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, Alert, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import {
  carwashService,
  type WashBooking,
  type WashBookingStatus,
  WASH_TYPE_LABELS,
} from '../../services/carwashService';
import { useCarwashStore } from '../../store/carwashStore';

const STATUS_STYLE: Record<WashBookingStatus, { label: string; bg: string; fg: string }> = {
  PENDING_PAYMENT: { label: 'Awaiting payment', bg: 'rgba(245,158,11,0.15)', fg: '#f59e0b' },
  CONFIRMED: { label: 'Confirmed', bg: 'rgba(34,197,94,0.15)', fg: '#4ade80' },
  TECHNICIAN_ASSIGNED: { label: 'Technician assigned', bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa' },
  IN_PROGRESS: { label: 'In progress', bg: 'rgba(99,102,241,0.15)', fg: '#818cf8' },
  COMPLETED: { label: 'Completed', bg: 'rgba(74,222,128,0.15)', fg: '#4ade80' },
  CANCELLED: { label: 'Cancelled', bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
  REFUNDED: { label: 'Refunded', bg: 'rgba(148,163,184,0.15)', fg: '#94a3b8' },
};

export default function MyWashBookingsScreen() {
  const navigation = useNavigation<any>();
  const version = useCarwashStore((s) => s.version);
  const notifyBookingChanged = useCarwashStore((s) => s.notifyBookingChanged);

  const [bookings, setBookings] = useState<WashBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const data = await carwashService.listMyBookings();
      setBookings(data);
    } catch (e: any) {
      Alert.alert('Could not load bookings', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, version]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const onCancel = (booking: WashBooking) => {
    Alert.alert('Cancel this booking?', 'If eligible, your payment will be refunded automatically.', [
      { text: 'Keep booking', style: 'cancel' },
      {
        text: 'Cancel booking',
        style: 'destructive',
        onPress: async () => {
          setCancellingId(booking.id);
          try {
            await carwashService.cancelBooking(booking.id);
            notifyBookingChanged();
          } catch (e: any) {
            Alert.alert('Could not cancel', e?.message || 'Please try again.');
          } finally {
            setCancellingId(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>My Wash Bookings</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : bookings.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="car-wash" size={wp(12)} color="#444" />
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptyText}>Book a wash to see it here.</Text>
          <TouchableOpacity style={styles.searchBtn} onPress={() => navigation.navigate('WashSearch')}>
            <Text style={styles.searchBtnText}>Find a wash</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
          renderItem={({ item }) => {
            const statusStyle = STATUS_STYLE[item.status];
            const cancellable = item.status === 'PENDING_PAYMENT' || item.status === 'CONFIRMED';
            const title = item.serviceModel === 'DOORSTEP' ? 'Doorstep Wash' : (item.center?.name ?? 'Wash Center');
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.bookingTitle} numberOfLines={1}>{title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.fg }]}>{statusStyle.label}</Text>
                  </View>
                </View>
                <Text style={styles.washTypeText}>{WASH_TYPE_LABELS[item.washType]}</Text>
                {(item.center?.address || item.addressLine) && (
                  <Text style={styles.addressText} numberOfLines={1}>{item.center?.address ?? item.addressLine}</Text>
                )}
                {item.technician && (
                  <View style={styles.metaRow}>
                    <IconMC name="account-hard-hat" size={wp(3.6)} color="#888" />
                    <Text style={styles.metaText}>{item.technician.name} · {item.technician.phoneNumber}</Text>
                  </View>
                )}
                {item.beforePhotoUrls.length > 0 && (
                  <View style={styles.photoRow}>
                    {item.beforePhotoUrls.slice(0, 3).map((url) => (
                      <Image key={url} source={{ uri: url }} style={styles.photoThumb} />
                    ))}
                    {item.afterPhotoUrls.slice(0, 3).map((url) => (
                      <Image key={url} source={{ uri: url }} style={styles.photoThumb} />
                    ))}
                  </View>
                )}
                <View style={styles.cardBottom}>
                  <Text style={styles.amountText}>₹{(item.amountPaise / 100).toFixed(0)}</Text>
                  {cancellable && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => onCancel(item)}
                      disabled={cancellingId === item.id}
                    >
                      <Text style={styles.cancelBtnText}>{cancellingId === item.id ? 'Cancelling…' : 'Cancel'}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: hp(1), paddingHorizontal: wp(8) },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), marginTop: hp(1) },
  emptyText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  searchBtn: { marginTop: hp(2), backgroundColor: '#FFBF00', paddingHorizontal: wp(6), paddingVertical: hp(1.4), borderRadius: 12 },
  searchBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  card: { backgroundColor: '#111', borderRadius: 18, padding: wp(4.5), marginBottom: hp(1.6), borderWidth: 1, borderColor: '#222' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp(0.4) },
  bookingTitle: { flex: 1, color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4), marginRight: wp(2) },
  statusBadge: { paddingHorizontal: wp(2.5), paddingVertical: hp(0.5), borderRadius: 8 },
  statusText: { fontFamily: 'Outfit-Bold', fontSize: wp(2.8) },
  washTypeText: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.1), marginBottom: hp(0.4) },
  addressText: { color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.1), marginBottom: hp(0.8) },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: wp(1.5), marginBottom: hp(0.8) },
  metaText: { color: '#aaa', fontFamily: 'Outfit-Medium', fontSize: wp(3.1) },
  photoRow: { flexDirection: 'row', gap: wp(1.5), marginBottom: hp(1) },
  photoThumb: { width: wp(12), height: wp(12), borderRadius: 8, backgroundColor: '#222' },
  cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amountText: { color: '#FFBF00', fontFamily: 'Outfit-Black', fontSize: wp(4) },
  cancelBtn: { borderWidth: 1, borderColor: '#ef4444', paddingHorizontal: wp(4), paddingVertical: hp(0.8), borderRadius: 10 },
  cancelBtnText: { color: '#ef4444', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
});
