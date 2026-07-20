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

  if (loading || !conversation) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
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
      </View>

      <View style={styles.infoBanner}>
        <IconMC name="web" size={wp(4)} color="#888" />
        <Text style={styles.infoBannerText}>
          This person messaged from the web (no Gupio account). They can't get live push updates — they'll see your
          reply next time they open the link.
          {conversation.guestContact ? ` They shared this contact: ${conversation.guestContact}.` : ''}
        </Text>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(1.6) },
  headerBody: { flex: 1, marginLeft: wp(3) },
  headerTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.3) },
  headerSubtitle: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3) },
  resolveBtn: { padding: wp(2) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2.5),
    marginHorizontal: wp(4),
    marginBottom: hp(1),
    backgroundColor: '#141414',
    borderRadius: 14,
    padding: wp(3.5),
    borderWidth: 1,
    borderColor: '#222',
  },
  infoBannerText: { flex: 1, color: '#888', fontFamily: 'Outfit-Regular', fontSize: wp(2.9), lineHeight: wp(4.2) },
  messagesList: { paddingHorizontal: wp(4), paddingVertical: hp(1), gap: hp(0.8) },
  bubbleRow: { flexDirection: 'row', marginBottom: hp(0.4) },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: wp(75), borderRadius: 16, paddingHorizontal: wp(3.5), paddingVertical: hp(1) },
  bubbleMine: { backgroundColor: '#FFBF00', borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#1a1a1a', borderBottomLeftRadius: 4 },
  bubbleTextMine: { color: '#111', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  bubbleTextTheirs: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  bubbleTime: { fontSize: wp(2.6), color: 'rgba(255,255,255,0.35)', fontFamily: 'Outfit-Regular', marginTop: hp(0.3), alignSelf: 'flex-end' },
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp(1), marginBottom: hp(0.5) },
  messageImage: { width: wp(28), height: wp(28), borderRadius: 10 },
  closedBanner: { padding: wp(4), alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
  closedBannerText: { color: '#666', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: wp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    backgroundColor: '#141414',
    borderRadius: 18,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    maxHeight: hp(12),
  },
  sendBtn: {
    width: wp(10.5),
    height: wp(10.5),
    borderRadius: wp(5.25),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
