import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import { supportApi } from '../../api/support';

export default function TicketDetail() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { ticketId } = route.params;
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const loadTicketDetail = async () => {
    try {
      const resp = await supportApi.getTicket(ticketId);
      if (resp.success) setTicket(resp.data);
    } catch (err) {
      console.error('Failed to load ticket detail', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTicketDetail();
  }, []);

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    try {
      const resp = await supportApi.addMessage(ticketId, reply);
      if (resp.success) {
        setReply('');
        loadTicketDetail();
      }
    } catch (err) {
      console.error('Failed to send reply', err);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'OPEN': return '#2196F3';
      case 'IN_PROGRESS': return '#FF9800';
      case 'RESOLVED': return '#4CAF50';
      case 'CLOSED': return '#F44336';
      default: return '#888';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" style={{ marginTop: hp(10) }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(4.5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{ticketId.substring(0, 15).toUpperCase()}</Text>
          <Text style={styles.headerSubtitle}>Ticket Conversation</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={hp(10)}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Ticket Original Content */}
          <View style={styles.ticketCard}>
            <View style={styles.ticketMeta}>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20', borderColor: getStatusColor(ticket.status) + '40' }]}>
                <View style={[styles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
                <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>{ticket.status}</Text>
              </View>
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{ticket.category}</Text>
              </View>
              <Text style={styles.ticketDate}>
                {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
            </View>
            <Text style={styles.ticketSubject}>{ticket.subject}</Text>
            <Text style={styles.ticketDescription}>{ticket.description}</Text>
          </View>

          {/* Conversation History */}
          <Text style={styles.sectionTitle}>CONVERSATION HISTORY</Text>
          
          {(ticket.messages || []).map((msg: any) => {
            const isAgent = msg.senderRole === 'AGENT';
            return (
              <View key={msg.id} style={[styles.msgContainer, isAgent ? styles.agentMsgAlign : styles.customerMsgAlign]}>
                <View style={[styles.msgCard, isAgent ? styles.agentMsgCard : styles.customerMsgCard]}>
                  {isAgent && (
                    <View style={styles.agentInfo}>
                      <View style={styles.avatarWrap}>
                        <Icon name="user-tie" size={wp(3)} color="#4CAF50" />
                      </View>
                      <View>
                        <Text style={styles.agentName}>Gupio Support</Text>
                        <Text style={styles.msgTime}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  )}
                  <Text style={[styles.msgContent, isAgent ? styles.agentMsgContent : styles.customerMsgContent]}>
                    {msg.content}
                  </Text>
                  {!isAgent && (
                    <Text style={styles.customerMsgTime}>
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Reply Area */}
        <View style={styles.replyArea}>
          <Text style={styles.replyLabel}>Add a reply</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="Type your reply..."
              placeholderTextColor="#555"
              multiline
              value={reply}
              onChangeText={setReply}
            />
          </View>
          <TouchableOpacity 
            style={[styles.sendBtn, !reply.trim() && styles.sendBtnDisabled]} 
            onPress={handleSendReply}
            disabled={sending || !reply.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <View style={styles.sendBtnContent}>
                <Icon name="paper-plane" size={wp(4)} color="#000" />
                <Text style={styles.sendBtnText}>Send Reply</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(2.5),
    borderBottomWidth: 1,
    borderBottomColor: '#111',
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  headerTitleWrap: {
    marginLeft: wp(4),
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp(4),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: wp(2.8),
    color: '#888',
    marginTop: hp(0.2),
  },
  content: { flex: 1, paddingHorizontal: wp(4), paddingTop: hp(2) },
  
  ticketCard: {
    backgroundColor: '#121212',
    borderRadius: wp(5),
    padding: wp(5),
    marginBottom: hp(3),
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  ticketMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(2) },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.5),
    borderRadius: wp(1.5),
    borderWidth: 1,
    marginRight: wp(2.5),
  },
  statusDot: { width: wp(1.5), height: wp(1.5), borderRadius: wp(0.75), marginRight: wp(1.5) },
  statusText: { fontSize: wp(2.6), fontWeight: '800', textTransform: 'uppercase' },
  categoryBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.5),
    borderRadius: wp(1.5),
    borderWidth: 1,
    borderColor: '#222',
    marginRight: wp(2.5),
  },
  categoryText: { fontSize: wp(2.6), color: '#888', fontWeight: '800', textTransform: 'uppercase' },
  ticketDate: { fontSize: wp(3), color: '#444', flex: 1, textAlign: 'right' },
  ticketSubject: { fontSize: wp(4.5), fontWeight: '800', color: '#fff', marginBottom: hp(1.5), lineHeight: wp(6) },
  ticketDescription: { fontSize: wp(3.5), color: '#888', lineHeight: wp(5.5) },
  
  sectionTitle: { fontSize: wp(3), fontWeight: '800', color: '#222', letterSpacing: 1, marginBottom: hp(2), textAlign: 'center' },
  
  msgContainer: { marginBottom: hp(2), width: '100%' },
  agentMsgAlign: { alignItems: 'flex-start' },
  customerMsgAlign: { alignItems: 'flex-end' },
  msgCard: { maxWidth: '85%', padding: wp(4), borderRadius: wp(4) },
  agentMsgCard: { backgroundColor: '#121212', borderWidth: 1, borderColor: '#1a1a1a' },
  customerMsgCard: { backgroundColor: '#161616', borderBottomRightRadius: wp(1) },
  
  agentInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(1.5) },
  avatarWrap: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  agentName: { fontSize: wp(3.2), fontWeight: '800', color: '#4CAF50' },
  msgTime: { fontSize: wp(2.6), color: '#444', marginTop: hp(0.2) },
  
  msgContent: { fontSize: wp(3.8), lineHeight: wp(5.5) },
  agentMsgContent: { color: '#ccc' },
  customerMsgContent: { color: '#fff' },
  customerMsgTime: { fontSize: wp(2.5), color: '#444', marginTop: hp(1), textAlign: 'right' },
  
  replyArea: { padding: wp(5), backgroundColor: '#000000', borderTopWidth: 1, borderTopColor: '#111' },
  replyLabel: { fontSize: wp(3.5), fontWeight: '800', color: '#444', marginBottom: hp(1.5) },
  inputWrap: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: '#1a1a1a',
    paddingHorizontal: wp(4),
    marginBottom: hp(2),
  },
  input: {
    color: '#fff',
    fontSize: wp(4),
    minHeight: hp(8),
    paddingVertical: hp(2),
    textAlignVertical: 'top',
  },
  sendBtn: {
    backgroundColor: '#4CAF50',
    height: hp(7),
    borderRadius: wp(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#1a1a1a', opacity: 0.5 },
  sendBtnContent: { flexDirection: 'row', alignItems: 'center' },
  sendBtnText: { color: '#000', fontWeight: '800', fontSize: wp(4), marginLeft: wp(3) },
});
