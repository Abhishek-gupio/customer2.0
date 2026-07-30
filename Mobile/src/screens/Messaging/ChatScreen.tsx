import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  PermissionsAndroid,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { format } from 'date-fns';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import {
  messagingService,
  type ChatMessage,
  type ConversationDetail,
  type QuickReply,
} from '../../services/messagingService';
import { useMessagingStore } from '../../store/messagingStore';
import { connectAndJoin } from '../../services/realtime/socketClient';

let Geolocation: any = null;
try {
  const geo = require('@react-native-community/geolocation') as any;
  Geolocation = geo?.default ?? geo;
} catch {
  Geolocation = null;
}

const REACTIONS = ['👍', '🙏', '✅', '❤️'];

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  WAITING_FOR_OWNER: 'Waiting for owner',
  WAITING_FOR_CUSTOMER: 'Waiting for reply',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
};

export default function ChatScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { conversationId } = route.params as { conversationId: string };
  const { user } = useSelector((state: RootState) => state.auth);
  const bumpVersion = useMessagingStore((s) => s.bumpVersion);

  const [conversation, setConversation] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [reactionTarget, setReactionTarget] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await messagingService.getConversation(conversationId);
      setConversation(data);
      setMessages(data.messages);
      await messagingService.markDelivered(conversationId);
      await messagingService.markRead(conversationId);
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not load conversation', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [conversationId, bumpVersion]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    messagingService.listQuickReplies().then(setQuickReplies);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const socket = connectAndJoin(user.id);

    const onNewMessage = (payload: { conversationId: string; message: ChatMessage }) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((prev) => [...prev, payload.message]);
      setOtherTyping(false);
      messagingService.markDelivered(conversationId).catch(() => {});
      messagingService.markRead(conversationId).catch(() => {});
      bumpVersion();
    };
    const onTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId !== conversationId || payload.userId === user.id) return;
      setOtherTyping(payload.isTyping);
    };
    const onRead = (payload: { conversationId: string; readAt: string }) => {
      if (payload.conversationId !== conversationId) return;
      const readAt = new Date(payload.readAt).getTime();
      setMessages((prev) =>
        prev.map((m) => (m.senderId === user.id && new Date(m.createdAt).getTime() <= readAt ? { ...m, isRead: true, readAt: payload.readAt } : m)),
      );
    };
    const onDelivered = (payload: { conversationId: string; deliveredAt: string }) => {
      if (payload.conversationId !== conversationId) return;
      const deliveredAt = new Date(payload.deliveredAt).getTime();
      setMessages((prev) =>
        prev.map((m) => (m.senderId === user.id && new Date(m.createdAt).getTime() <= deliveredAt ? { ...m, deliveredAt: payload.deliveredAt } : m)),
      );
    };
    const onReaction = (payload: { messageId: string; emoji: string }) => {
      setMessages((prev) => prev.map((m) => (m.id === payload.messageId ? { ...m, reaction: payload.emoji } : m)));
    };
    const onMessageDeleted = (payload: { conversationId: string; messageId: string }) => {
      if (payload.conversationId !== conversationId) return;
      setMessages((prev) => prev.filter((m) => m.id !== payload.messageId));
    };
    const onStatusChanged = (payload: { conversationId: string; status: string }) => {
      if (payload.conversationId !== conversationId) return;
      setConversation((prev) => (prev ? { ...prev, status: payload.status as any } : prev));
    };

    socket.on('new_message', onNewMessage);
    socket.on('conversation_typing', onTyping);
    socket.on('message_read', onRead);
    socket.on('message_delivered', onDelivered);
    socket.on('message_reaction', onReaction);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('conversation_status_changed', onStatusChanged);

    return () => {
      socket.off('new_message', onNewMessage);
      socket.off('conversation_typing', onTyping);
      socket.off('message_read', onRead);
      socket.off('message_delivered', onDelivered);
      socket.off('message_reaction', onReaction);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('conversation_status_changed', onStatusChanged);
    };
  }, [conversationId, user?.id, bumpVersion]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (!conversation) return;
      connectAndJoin(user?.id ?? '').emit('typing', {
        conversationId,
        receiverId: conversation.otherParty.id,
        isTyping,
      });
    },
    [conversation, conversationId, user?.id],
  );

  const onChangeText = (value: string) => {
    setText(value);
    emitTyping(true);
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => emitTyping(false), 1500);
  };

  const sendText = async (overrideText?: string, quickReplyKey?: string) => {
    const value = (overrideText ?? text).trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    emitTyping(false);
    try {
      const message = await messagingService.sendTextOrLocation(conversationId, { type: 'TEXT', text: value, quickReplyKey });
      setMessages((prev) => [...prev, message]);
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not send message', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendPhotos = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 5, quality: 0.7 });
    if (result.didCancel || !result.assets?.length) return;
    setSending(true);
    try {
      const photos = result.assets.map((a, i) => ({
        uri: a.uri!,
        name: a.fileName || `photo_${i}.jpg`,
        type: a.type || 'image/jpeg',
      }));
      const message = await messagingService.sendPhotos(conversationId, photos);
      setMessages((prev) => [...prev, message]);
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not send photos', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const sendLocation = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION).catch(() => {});
    }
    if (!Geolocation) {
      Alert.alert('Location unavailable', 'Could not access device location.');
      return;
    }
    setSending(true);
    Geolocation.getCurrentPosition(
      async (pos: any) => {
        try {
          const message = await messagingService.sendTextOrLocation(conversationId, {
            type: 'LOCATION',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          setMessages((prev) => [...prev, message]);
          bumpVersion();
        } catch (e: any) {
          Alert.alert('Could not send location', e?.message || 'Please try again.');
        } finally {
          setSending(false);
        }
      },
      () => {
        setSending(false);
        Alert.alert('Could not get your location', 'Check that location services are enabled.');
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const handleReact = async (emoji: string) => {
    if (!reactionTarget) return;
    const messageId = reactionTarget;
    setReactionTarget(null);
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reaction: emoji } : m)));
    try {
      await messagingService.addReaction(messageId, emoji);
    } catch {
      // optimistic update stands; a refresh will correct it if it actually failed
    }
  };

  const handleMarkResolved = async () => {
    setMenuOpen(false);
    try {
      await messagingService.updateStatus(conversationId, 'RESOLVED');
      setConversation((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not update status', e?.message || 'Please try again.');
    }
  };

  const handleReport = () => {
    setMenuOpen(false);
    setReportReason('');
    setReportModalOpen(true);
  };

  const submitReport = async () => {
    const reason = reportReason.trim();
    if (!reason) return;
    setReportModalOpen(false);
    try {
      await messagingService.reportConversation(conversationId, reason);
      Alert.alert('Reported', 'Our team will review this conversation.');
    } catch (e: any) {
      Alert.alert('Could not submit report', e?.message || 'Please try again.');
    }
  };

  const handleBlock = () => {
    setMenuOpen(false);
    if (!conversation) return;
    Alert.alert('Block this person?', "You won't receive messages from them about any of your vehicles again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagingService.blockContact(conversation.otherParty.id);
            Alert.alert('Blocked', 'They can no longer message you.');
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Could not block', e?.message || 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleDeleteConversation = () => {
    setMenuOpen(false);
    Alert.alert('Delete Conversation', 'Are you sure you want to delete this conversation?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagingService.deleteConversation(conversationId);
            bumpVersion();
            navigation.goBack();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete conversation');
          }
        },
      },
    ]);
  };

  const handleDeleteMessage = (messageId: string) => {
    setReactionTarget(null);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await messagingService.deleteMessage(messageId);
            setMessages((prev) => prev.filter((m) => m.id !== messageId));
            bumpVersion();
          } catch (e: any) {
            Alert.alert('Error', e?.message || 'Could not delete message');
          }
        },
      },
    ]);
  };

  const relevantQuickReplies = useMemo(
    () => (conversation ? quickReplies.filter((q) => q.category === conversation.category || q.category === 'GENERAL') : []),
    [quickReplies, conversation],
  );

  if (loading || !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#5F9EA0" />
        </View>
      </SafeAreaView>
    );
  }

  const isOwner = conversation.role === 'OWNER';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle} numberOfLines={1}>{conversation.vehicle.registrationNumber}</Text>
          <Text style={styles.headerSubtitle}>
            {otherTyping ? 'typing…' : conversation.otherParty.online ? 'Online' : STATUS_LABEL[conversation.status]}
          </Text>
        </View>
        <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuOpen(true)}>
          <IconMC name="dots-vertical" size={wp(5.5)} color="#fff" />
        </TouchableOpacity>
      </View>

      {conversation.priority !== 'NORMAL' && (
        <View style={[styles.priorityBanner, conversation.priority === 'EMERGENCY' && styles.priorityBannerEmergency]}>
          <IconMC name="alert" size={wp(4)} color="#fff" />
          <Text style={styles.priorityBannerText}>{conversation.priority === 'EMERGENCY' ? 'Emergency' : 'Urgent'}</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          overScrollMode="never"
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={12}
          renderItem={({ item }) => {
            const mine = item.senderId === user?.id;
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onLongPress={() => setReactionTarget(item.id)}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {item.type === 'IMAGE' && item.imageUrls.length > 0 && (
                    <View style={styles.imageGrid}>
                      {item.imageUrls.map((url) => (
                        <Image key={url} source={{ uri: url }} style={styles.messageImage} />
                      ))}
                    </View>
                  )}
                  {item.type === 'LOCATION' && item.latitude != null && (
                    <View style={styles.locationChip}>
                      <IconMC name="map-marker" size={wp(4)} color="#5F9EA0" />
                      <Text style={styles.locationText}>Shared location</Text>
                    </View>
                  )}
                  {item.text ? <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text> : null}
                  <View style={styles.bubbleMeta}>
                    <Text style={mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs}>
                      {format(new Date(item.createdAt), 'h:mm a')}
                    </Text>
                    {mine && (
                      <IconMC
                        name={item.readAt ? 'check-all' : item.deliveredAt ? 'check-all' : 'check'}
                        size={wp(3.4)}
                        color={item.readAt ? '#2563eb' : 'rgba(9,10,15,0.5)'}
                      />
                    )}
                  </View>
                  {item.reaction && (
                    <View style={styles.reactionBadge}>
                      <Text style={styles.reactionBadgeText}>{item.reaction}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />

        {relevantQuickReplies.length > 0 && conversation.status !== 'CLOSED' && (
          <FlatList
            horizontal
            style={{ flexGrow: 0 }}
            data={relevantQuickReplies}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickReplyRow}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.quickReplyChip} onPress={() => sendText(item.label, item.key)}>
                <Text style={styles.quickReplyText}>{item.label}</Text>
              </TouchableOpacity>
            )}
          />
        )}

        {conversation.status === 'CLOSED' ? (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>This conversation is closed.</Text>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TouchableOpacity style={styles.iconBtn} onPress={sendPhotos} disabled={sending}>
              <Icon name="camera" size={wp(4.2)} color="#5F9EA0" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={sendLocation} disabled={sending}>
              <IconMC name="map-marker-outline" size={wp(4.8)} color="#5F9EA0" />
            </TouchableOpacity>
            <TextInput
              value={text}
              onChangeText={onChangeText}
              placeholder="Type a message…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.textInput}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendText()} disabled={sending || !text.trim()}>
              <IconMC name="send" size={wp(4.5)} color="#090a0f" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>

      <Modal visible={!!reactionTarget} transparent animationType="fade" onRequestClose={() => setReactionTarget(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReactionTarget(null)}>
          <View style={styles.reactionPicker}>
            {REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => handleReact(emoji)}>
                <Text style={styles.reactionOptionText}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            {reactionTarget && messages.find((m) => m.id === reactionTarget)?.senderId === user?.id && (
              <TouchableOpacity
                style={[styles.reactionOption, { paddingHorizontal: wp(3), borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.1)' }]}
                onPress={() => reactionTarget && handleDeleteMessage(reactionTarget)}
              >
                <IconMC name="trash-can-outline" size={wp(5)} color="#FF453A" />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setMenuOpen(false)}>
          <View style={styles.actionMenu}>
            <TouchableOpacity style={styles.actionMenuItem} onPress={handleMarkResolved}>
              <IconMC name="check-circle-outline" size={wp(4.5)} color="#4ade80" />
              <Text style={styles.actionMenuText}>Mark Resolved</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionMenuItem} onPress={handleReport}>
              <IconMC name="flag-outline" size={wp(4.5)} color="#5f9ea0" />
              <Text style={styles.actionMenuText}>Report</Text>
            </TouchableOpacity>
            {isOwner && (
              <TouchableOpacity style={styles.actionMenuItem} onPress={handleBlock}>
                <IconMC name="cancel" size={wp(4.5)} color="#ef4444" />
                <Text style={styles.actionMenuText}>Block this person</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionMenuItem} onPress={handleDeleteConversation}>
              <IconMC name="trash-can-outline" size={wp(4.5)} color="#ef4444" />
              <Text style={[styles.actionMenuText, { color: '#ef4444' }]}>Delete Conversation</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={reportModalOpen} transparent animationType="fade" onRequestClose={() => setReportModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.reportCard}>
            <Text style={styles.reportTitle}>Report this conversation</Text>
            <Text style={styles.reportSubtitle}>What happened? Our team will review it.</Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.reportInput}
              multiline
              autoFocus
            />
            <View style={styles.reportActions}>
              <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportModalOpen(false)}>
                <Text style={styles.reportCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.reportSubmitBtn} onPress={submitReport} disabled={!reportReason.trim()}>
                <Text style={styles.reportSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    borderBottomColor: '#161926',
    backgroundColor: '#0d0f17',
  },
  headerBody: { flex: 1, marginLeft: wp(3) },
  headerTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), letterSpacing: 0.3 },
  headerSubtitle: { color: '#8890a6', fontFamily: 'Outfit-Medium', fontSize: wp(3), marginTop: 1 },
  menuBtn: { padding: wp(2), borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  priorityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    backgroundColor: '#5f9ea0',
    paddingVertical: hp(1),
    shadowColor: '#5f9ea0',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  priorityBannerEmergency: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  priorityBannerText: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.4), letterSpacing: 0.5 },
  messagesList: { paddingHorizontal: wp(4), paddingVertical: hp(2), gap: hp(1) },
  bubbleRow: { flexDirection: 'row', marginBottom: hp(0.4) },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: wp(78),
    borderRadius: 20,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.3),
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  bubbleMine: { backgroundColor: '#5F9EA0', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#161926', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#222636' },
  bubbleTextMine: { color: '#090a0f', fontFamily: 'Outfit-Medium', fontSize: wp(3.7), lineHeight: wp(5.2) },
  bubbleTextTheirs: { color: '#f1f5f9', fontFamily: 'Outfit-Medium', fontSize: wp(3.7), lineHeight: wp(5.2) },
  bubbleMeta: { flexDirection: 'row', alignItems: 'center', gap: wp(1.2), alignSelf: 'flex-end', marginTop: hp(0.5) },
  bubbleTimeMine: { fontSize: wp(2.7), color: 'rgba(9, 10, 15, 0.6)', fontFamily: 'Outfit-Regular' },
  bubbleTimeTheirs: { fontSize: wp(2.7), color: 'rgba(255, 255, 255, 0.45)', fontFamily: 'Outfit-Regular' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(1.5), marginBottom: hp(0.6) },
  messageImage: { width: wp(30), height: wp(30), borderRadius: 12 },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 10,
    marginBottom: hp(0.5),
  },
  locationText: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.4) },
  reactionBadge: {
    position: 'absolute',
    bottom: -hp(1),
    right: wp(2),
    backgroundColor: '#090a0f',
    borderWidth: 1,
    borderColor: '#222636',
    borderRadius: 12,
    paddingHorizontal: wp(1.8),
    paddingVertical: 2,
  },
  reactionBadgeText: { fontSize: wp(3.2) },
  quickReplyRow: { paddingHorizontal: wp(4), gap: wp(2), paddingBottom: hp(1.2) },
  quickReplyChip: {
    backgroundColor: '#161926',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.6)',
    borderRadius: 999,
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.9),
  },
  quickReplyText: { color: '#5F9EA0', fontFamily: 'Outfit-Medium', fontSize: wp(3.2) },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.4),
    borderTopWidth: 1,
    borderTopColor: '#161926',
    backgroundColor: '#0d0f17',
  },
  iconBtn: {
    width: wp(9.5),
    height: wp(9.5),
    borderRadius: wp(4.75),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.7),
    backgroundColor: '#161926',
    borderRadius: 22,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    maxHeight: hp(12),
    borderWidth: 1,
    borderColor: '#222636',
  },
  sendBtn: {
    width: wp(10.5),
    height: wp(10.5),
    borderRadius: wp(5.25),
    backgroundColor: '#5F9EA0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 3,
  },
  closedBanner: { padding: wp(4), alignItems: 'center', borderTopWidth: 1, borderTopColor: '#161926', backgroundColor: '#0d0f17' },
  closedBannerText: { color: '#64748b', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  reactionPicker: {
    flexDirection: 'row',
    backgroundColor: '#161926',
    borderRadius: 24,
    padding: wp(3.5),
    gap: wp(3.5),
    borderWidth: 1,
    borderColor: '#222636',
  },
  reactionOption: { padding: wp(2) },
  reactionOptionText: { fontSize: wp(7.5) },
  actionMenu: { backgroundColor: '#161926', borderRadius: 20, borderWidth: 1, borderColor: '#222636', overflow: 'hidden', minWidth: wp(65) },
  actionMenuItem: { flexDirection: 'row', alignItems: 'center', gap: wp(3), paddingHorizontal: wp(5), paddingVertical: hp(1.8) },
  actionMenuText: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.7) },
  reportCard: { width: wp(85), backgroundColor: '#161926', borderRadius: 22, borderWidth: 1, borderColor: '#222636', padding: wp(5.5) },
  reportTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5) },
  reportSubtitle: { color: '#8890a6', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginTop: hp(0.5), marginBottom: hp(1.5) },
  reportInput: {
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    backgroundColor: '#090a0f',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222636',
    padding: wp(4),
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  reportActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: wp(3), marginTop: hp(2) },
  reportCancelBtn: { paddingHorizontal: wp(4), paddingVertical: hp(1.2) },
  reportCancelText: { color: '#8890a6', fontFamily: 'Outfit-Bold', fontSize: wp(3.4) },
  reportSubmitBtn: { backgroundColor: '#5F9EA0', paddingHorizontal: wp(5.5), paddingVertical: hp(1.2), borderRadius: 12 },
  reportSubmitText: { color: '#090a0f', fontFamily: 'Outfit-Bold', fontSize: wp(3.4) },
});
