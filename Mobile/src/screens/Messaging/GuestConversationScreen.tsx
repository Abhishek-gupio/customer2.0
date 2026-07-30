import React, { useCallback, useEffect, useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { messagingService, type GuestConversationDetail, type GuestMessageEntry } from '../../services/messagingService';
import { useMessagingStore } from '../../store/messagingStore';

export default function GuestConversationScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { conversationId } = route.params as { conversationId: string };
  const bumpVersion = useMessagingStore((s) => s.bumpVersion);

  const [conversation, setConversation] = useState<GuestConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await messagingService.getGuestConversation(conversationId);
      setConversation(data);
    } catch (e: any) {
      Alert.alert('Could not load conversation', e?.message || 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSend = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    setText('');
    try {
      const entry = await messagingService.replyToGuestConversation(conversationId, value);
      setConversation((prev) => (prev ? { ...prev, entries: [...prev.entries, entry] } : prev));
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not send reply', e?.message || 'Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleMarkResolved = async () => {
    try {
      await messagingService.updateGuestConversationStatus(conversationId, 'RESOLVED');
      setConversation((prev) => (prev ? { ...prev, status: 'RESOLVED' } : prev));
      bumpVersion();
    } catch (e: any) {
      Alert.alert('Could not update status', e?.message || 'Please try again.');
    }
  };

  const handleDeleteGuestConversation = () => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this guest message thread?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await messagingService.deleteGuestConversation(conversationId);
              bumpVersion();
              navigation.goBack();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete conversation');
            }
          },
        },
      ]
    );
  };

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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerBody}>
          <Text style={styles.headerTitle} numberOfLines={1}>{conversation.guestName || 'Anonymous scan'}</Text>
          <Text style={styles.headerSubtitle}>{conversation.vehicle.registrationNumber} · no app installed</Text>
        </View>
        {conversation.status !== 'RESOLVED' && conversation.status !== 'CLOSED' && (
          <TouchableOpacity style={styles.resolveBtn} onPress={handleMarkResolved}>
            <IconMC name="check-circle-outline" size={wp(5)} color="#4ade80" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.resolveBtn, { marginLeft: wp(2) }]} onPress={handleDeleteGuestConversation}>
          <IconMC name="trash-can-outline" size={wp(5)} color="#FF453A" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoBanner}>
        <IconMC name="web" size={wp(4)} color="#888" />
        <Text style={styles.infoBannerText}>
          This person messaged from the web (no Gupio account). They can't get live push updates — they'll see your
          reply next time they open the link.
          {conversation.guestContact ? ` They shared this contact: ${conversation.guestContact}.` : ''}
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          data={conversation.entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }: { item: GuestMessageEntry }) => {
            const mine = item.sender === 'OWNER';
            return (
              <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {item.imageUrls.length > 0 && (
                    <View style={styles.imageGrid}>
                      {item.imageUrls.map((url) => (
                        <Image key={url} source={{ uri: url }} style={styles.messageImage} />
                      ))}
                    </View>
                  )}
                  {item.text ? <Text style={mine ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.text}</Text> : null}
                  <Text style={styles.bubbleTime}>{format(new Date(item.createdAt), 'h:mm a')}</Text>
                </View>
              </View>
            );
          }}
        />

        {conversation.status === 'CLOSED' ? (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>This conversation is closed.</Text>
          </View>
        ) : (
          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Type a reply…"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.textInput}
              multiline
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending || !text.trim()}>
              <IconMC name="send" size={wp(4.5)} color="#111" />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
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
  resolveBtn: { padding: wp(2), borderRadius: 10, backgroundColor: 'rgba(74, 222, 128, 0.1)' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2.5),
    marginHorizontal: wp(4),
    marginTop: hp(1),
    marginBottom: hp(0.5),
    backgroundColor: '#12141d',
    borderRadius: 16,
    padding: wp(3.8),
    borderWidth: 1,
    borderColor: '#222636',
  },
  infoBannerText: { flex: 1, color: '#8890a6', fontFamily: 'Outfit-Regular', fontSize: wp(3), lineHeight: wp(4.5) },
  messagesList: { paddingHorizontal: wp(4), paddingVertical: hp(2), gap: hp(1) },
  bubbleRow: { flexDirection: 'row', marginBottom: hp(0.4) },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: wp(78),
    borderRadius: 20,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.3),
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
  bubbleTime: { fontSize: wp(2.7), color: 'rgba(255,255,255,0.4)', fontFamily: 'Outfit-Regular', marginTop: hp(0.4), alignSelf: 'flex-end' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(1.5), marginBottom: hp(0.6) },
  messageImage: { width: wp(30), height: wp(30), borderRadius: 12 },
  closedBanner: { padding: wp(4), alignItems: 'center', borderTopWidth: 1, borderTopColor: '#161926', backgroundColor: '#0d0f17' },
  closedBannerText: { color: '#64748b', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
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
});
