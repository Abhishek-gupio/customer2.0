import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, RefreshControl, ActivityIndicator, Alert } from 'react-native';
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

  const handleDeleteConversation = (item: InboxItem) => {
    Alert.alert(
      'Delete Vehicle Message',
      'Are you sure you want to delete this conversation?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (item.kind === 'guest') {
                await messagingService.deleteGuestConversation(item.id);
              } else {
                await messagingService.deleteConversation(item.id);
              }
              setItems((prev) => prev.filter((i) => i.id !== item.id));
              bumpVersion();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Failed to delete conversation');
            }
          },
        },
      ]
    );
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
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Vehicle Messages</Text>
          <Text style={styles.headerSubtitle}>Real-time guest & owner alerts</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.qrBtn} onPress={() => navigation.navigate('MyVehicleQrCode')} activeOpacity={0.75}>
            <IconMC name="qrcode" size={wp(5)} color="#5F9EA0" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('ScanQr')} activeOpacity={0.75}>
            <IconMC name="qrcode-scan" size={wp(4.8)} color="#111" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <IconMC name="magnify" size={wp(4.5)} color="#5F9EA0" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search plate, owner, or message…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <IconMC name="close-circle" size={wp(4.5)} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#5F9EA0" />
          <Text style={styles.loadingText}>Fetching conversations…</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconBg}>
            <IconMC name="message-text-outline" size={wp(10)} color="#5F9EA0" />
          </View>
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptyText}>Scan a vehicle's QR code or share your own to initiate instant, privacy-first alerts.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#5F9EA0" />}
          renderItem={({ item }) => {
            const isGuest = item.kind === 'guest';
            const roleLabel = isGuest ? 'Web Scan' : item.role === 'OWNER' ? 'Your Car' : 'Contacted';
            const unreadCount = isGuest ? 0 : item.unreadCount;
            return (
              <TouchableOpacity
                style={[styles.rowCard, unreadCount > 0 && styles.rowCardUnread]}
                activeOpacity={0.85}
                onPress={() =>
                  navigation.navigate(isGuest ? 'GuestConversation' : 'ChatConversation', { conversationId: item.id })
                }
                onLongPress={() => handleDeleteConversation(item)}
              >
                <View style={styles.avatarWrap}>
                  <IconMC name={isGuest ? 'earth' : 'car-sports'} size={wp(6.5)} color="#5F9EA0" />
                  {!isGuest && item.otherParty.online && <View style={styles.onlineDot} />}
                </View>

                <View style={styles.rowBody}>
                  <View style={styles.rowTop}>
                    <View style={styles.plateWrap}>
                      <Text style={styles.vehicleName} numberOfLines={1}>
                        {item.vehicle.registrationNumber}
                      </Text>
                      <View style={[styles.roleBadge, isGuest ? styles.roleBadgeGuest : item.role === 'OWNER' ? styles.roleBadgeOwner : styles.roleBadgeOther]}>
                        <Text style={styles.roleBadgeText}>{roleLabel}</Text>
                      </View>
                    </View>
                    {item.lastMessageAt && (
                      <Text style={styles.time}>{formatDistanceToNowStrict(new Date(item.lastMessageAt))}</Text>
                    )}
                  </View>

                  <View style={styles.rowBottom}>
                    <Text style={[styles.lastMessage, unreadCount > 0 && styles.lastMessageUnread]} numberOfLines={1}>
                      {item.lastMessage || (isGuest ? `${item.guestName || 'Someone'} sent a message` : 'Tap to open chat…')}
                    </Text>
                    {unreadCount > 0 && (
                      <View style={styles.unreadBadge}>
                        <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <TouchableOpacity
                  style={{ paddingLeft: wp(2), paddingVertical: hp(0.5) }}
                  onPress={() => handleDeleteConversation(item)}
                  activeOpacity={0.7}
                >
                  <IconMC name="trash-can-outline" size={wp(5)} color="#FF453A" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(1.8) },
  headerTitleWrap: { flex: 1, marginLeft: wp(3) },
  headerTitle: { fontSize: wp(5.2), fontFamily: 'Outfit-Bold', color: '#fff', tracking: 0.2 },
  headerSubtitle: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: '#888', marginTop: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: wp(2.5) },
  scanBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  qrBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(95, 158, 160,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    marginHorizontal: wp(5),
    marginBottom: hp(1.8),
    backgroundColor: '#13151f',
    borderWidth: 1,
    borderColor: '#222636',
    borderRadius: 16,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.3),
  },
  searchInput: { flex: 1, color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6), padding: 0 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1.5) },
  emptyIconBg: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: 'rgba(95, 158, 160,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.4)',
  },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.8) },
  emptyText: { color: '#8890a6', fontFamily: 'Outfit-Regular', fontSize: wp(3.4), textAlign: 'center', lineHeight: wp(5) },
  loadingText: { color: '#8890a6', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4), gap: hp(1.2) },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(3.8),
    backgroundColor: '#12141d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1d2130',
  },
  rowCardUnread: {
    borderColor: 'rgba(95, 158, 160,0.8)',
    backgroundColor: '#171a26',
  },
  avatarWrap: {
    width: wp(13),
    height: wp(13),
    borderRadius: wp(6.5),
    backgroundColor: 'rgba(95, 158, 160,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.5)',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: wp(3.2),
    height: wp(3.2),
    borderRadius: wp(1.6),
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#12141d',
  },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  plateWrap: { flexDirection: 'row', alignItems: 'center', gap: wp(2), flexShrink: 1 },
  vehicleName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4), flexShrink: 1 },
  roleBadge: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 6,
  },
  roleBadgeGuest: { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
  roleBadgeOwner: { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
  roleBadgeOther: { backgroundColor: 'rgba(95, 158, 160, 0.3)' },
  roleBadgeText: { fontSize: wp(2.6), fontFamily: 'Outfit-Bold', color: '#e2e8f0' },
  time: { color: '#64748b', fontFamily: 'Outfit-Regular', fontSize: wp(2.8) },
  rowBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hp(0.6) },
  lastMessage: { flex: 1, color: '#94a3b8', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginRight: wp(2) },
  lastMessageUnread: { color: '#fff', fontFamily: 'Outfit-Bold' },
  unreadBadge: {
    minWidth: wp(5.5),
    height: wp(5.5),
    borderRadius: wp(2.75),
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(1.5),
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadBadgeText: { color: '#090a0f', fontFamily: 'Outfit-Black', fontSize: wp(2.7) },
});
