import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { messagingService, type ConversationSummary, type GuestConversationSummary } from '../../services/messagingService';
import { useMessagingStore } from '../../store/messagingStore';
import { connectAndJoin } from '../../services/realtime/socketClient';

type InboxItem =
  | ({ kind: 'app' } & ConversationSummary)
  | ({ kind: 'guest' } & GuestConversationSummary);

export default function InboxScreen() {
  const navigation = useNavigation<any>();
  const { user } = useSelector((state: RootState) => state.auth);
  const version = useMessagingStore((s) => s.version);
  const bumpVersion = useMessagingStore((s) => s.bumpVersion);

  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    Promise.all([messagingService.listConversations(), messagingService.listGuestConversations()])
      .then(([conversations, guestConversations]) => {
        const merged: InboxItem[] = [
          ...conversations.map((c): InboxItem => ({ kind: 'app', ...c })),
          ...guestConversations.map((g): InboxItem => ({ kind: 'guest', ...g })),
        ].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        setItems(merged);
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(load, [load, version]);

  useEffect(() => {
    if (!user?.id) return;
    const socket = connectAndJoin(user.id);
    const onChange = () => bumpVersion();
    socket.on('new_message', onChange);
    socket.on('conversation_status_changed', onChange);
    socket.on('message_read', onChange);
    socket.on('new_guest_message', onChange);
    return () => {
      socket.off('new_message', onChange);
      socket.off('conversation_status_changed', onChange);
      socket.off('message_read', onChange);
      socket.off('new_guest_message', onChange);
    };
  }, [user?.id, bumpVersion]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const filtered = query.trim()
    ? items.filter((item) => {
        const q = query.toLowerCase();
        const name = item.kind === 'app' ? item.otherParty.name : item.guestName;
        return (
          item.vehicle.registrationNumber.toLowerCase().includes(q) ||
          (name ?? '').toLowerCase().includes(q) ||
          (item.lastMessage ?? '').toLowerCase().includes(q)
        );
      })
    : items;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Vehicle Messages</Text>
        <TouchableOpacity style={styles.qrBtn} onPress={() => navigation.navigate('MyVehicleQrCode')}>
          <IconMC name="qrcode" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('ScanQr')}>
          <IconMC name="qrcode-scan" size={wp(5)} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <IconMC name="magnify" size={wp(4.5)} color="rgba(255,255,255,0.4)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by vehicle, name, or message"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="message-text-outline" size={wp(12)} color="#444" />
          <Text style={styles.emptyTitle}>No conversations yet</Text>
          <Text style={styles.emptyText}>Scan a vehicle's QR code to message its owner.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
          renderItem={({ item }) => {
            const isGuest = item.kind === 'guest';
            const roleLabel = isGuest ? '· web scan, no app' : item.role === 'OWNER' ? '· your vehicle' : '· you messaged';
            // Guest conversations don't track a numeric unread count (no per-party read receipts
            // for an anonymous, account-less visitor) — the status pill is the signal instead.
            const unreadCount = isGuest ? 0 : item.unreadCount;
            return (
              <TouchableOpacity
                style={styles.row}
                activeOpacity={0.8}
                onPress={() =>
                  navigation.navigate(isGuest ? 'GuestConversation' : 'ChatConversation', { conversationId: item.id })
                }
              >
                <View style={styles.avatarWrap}>
                  <IconMC name={isGuest ? 'web' : 'car'} size={wp(6)} color="#FFBF00" />
                  {!isGuest && item.otherParty.online && <View style={styles.onlineDot} />}
                </View>
                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <Text style={styles.vehicleName} numberOfLines={1}>
                      {item.vehicle.registrationNumber}
                      <Text style={styles.roleTag}>  {roleLabel}</Text>
                    </Text>
                    {item.lastMessageAt && (
                      <Text style={styles.time}>{formatDistanceToNowStrict(new Date(item.lastMessageAt))}</Text>
                    )}
                  </View>
                  <View style={styles.rowBottom}>
                    <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                      {item.lastMessage || (isGuest ? `${item.guestName || 'Someone'} messaged you` : 'Say hello…')}
                    </Text>
                    {unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
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
  headerTitle: { flex: 1, fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  scanBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(2),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    marginHorizontal: wp(5),
    marginBottom: hp(1.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  searchInput: { flex: 1, color: '#fff', fontFamily: 'Outfit-Regular', fontSize: wp(3.5), padding: 0 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1) },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), marginTop: hp(1) },
  emptyText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.6),
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },
  avatarWrap: {
    width: wp(13),
    height: wp(13),
    borderRadius: wp(6.5),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: wp(3),
    height: wp(3),
    borderRadius: wp(1.5),
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#0a0a0a',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  vehicleName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8), flexShrink: 1 },
  roleTag: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.8) },
  time: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.8) },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hp(0.4) },
  lastMessage: { flex: 1, color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginRight: wp(2) },
  lastMessageUnread: { color: '#ddd', fontFamily: 'Outfit-Bold' },
  unreadBadge: {
    minWidth: wp(5.5),
    height: wp(5.5),
    borderRadius: wp(2.75),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(1),
  },
  unreadBadgeText: { color: '#111', fontFamily: 'Outfit-Black', fontSize: wp(2.7) },
});
