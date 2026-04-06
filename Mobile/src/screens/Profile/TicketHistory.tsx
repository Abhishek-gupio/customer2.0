import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import { supportApi } from '../../api/support';

export default function TicketHistory() {
  const navigation = useNavigation<any>();
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTickets = async () => {
    try {
      const resp = await supportApi.getTickets();
      if (resp.success) setTickets(resp.data);
    } catch (err) {
      console.error('Failed to load tickets', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadTickets();
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


  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(4)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>My Tickets</Text>
          <Text style={styles.headerSubtitle}>Track your support requests</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('ContactSupport')} style={styles.addBtn}>
          <Icon name="plus" size={wp(4.5)} color="#4CAF50" />
        </TouchableOpacity>
      </View>


      <ScrollView 
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4CAF50" />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#4CAF50" />
          </View>
        ) : tickets.length > 0 ? (
          tickets.map((ticket) => {
            const lastMessage = ticket.messages?.[ticket.messages.length - 1];
            const hasReply = lastMessage?.senderId !== 'CUSTOMER'; // Dummy logic for now
            
            return (
              <TouchableOpacity 
                key={ticket.id} 
                style={styles.ticketCard} 
                activeOpacity={0.85}
                onPress={() => navigation.navigate('TicketDetail', { ticketId: ticket.id })}
              >
                <View style={styles.ticketTop}>
                  <View style={styles.ticketIdWrap}>
                    <View style={styles.ticketIconWrap}>
                      <Icon 
                        name={ticket.category === 'VEHICLE' ? 'car' : ticket.category === 'DOCUMENTS' ? 'file-alt' : 'ticket-alt'} 
                        size={wp(3.5)} 
                        color="#888" 
                      />
                    </View>
                    <View>
                      <Text style={styles.ticketId}>{ticket.id.substring(0, 12).toUpperCase()}</Text>
                      <Text style={styles.ticketDate}>
                        {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(ticket.status) + '20', borderColor: getStatusColor(ticket.status) + '40' }]}>
                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(ticket.status) }]} />
                    <Text style={[styles.statusText, { color: getStatusColor(ticket.status) }]}>
                      {ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status.charAt(0) + ticket.status.slice(1).toLowerCase()}
                    </Text>
                  </View>
                </View>

                <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
                
                <View style={styles.ticketFooter}>
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>{ticket.category}</Text>
                  </View>
                  {hasReply && (
                    <View style={styles.replyBadge}>
                      <Icon name="reply" size={wp(2.5)} color="#4CAF50" style={{ transform: [{ scaleX: -1 }] }} />
                      <Text style={styles.replyText}>Reply received</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <Icon name="chevron-right" size={wp(3)} color="#333" />
                </View>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Icon name="ticket-alt" size={wp(15)} color="#151515" />
            <Text style={styles.emptyText}>No tickets found</Text>
            <Text style={styles.emptySubText}>You haven't raised any support requests yet</Text>
            <TouchableOpacity 
              style={styles.raiseBtn}
              onPress={() => navigation.navigate('ContactSupport')}
            >
              <Text style={styles.raiseBtnText}>Raise a Ticket</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    flex: 1, 
    marginLeft: wp(4),
    justifyContent: 'center',
  },
  headerTitle: { 
    fontSize: wp(5.5), 
    fontWeight: '800', 
    color: '#fff' 
  },
  headerSubtitle: { 
    fontSize: wp(3), 
    color: '#888', 
    marginTop: hp(0.2) 
  },
  addBtn: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  

  content: { flex: 1, paddingHorizontal: wp(4) },
  loadingWrap: {
    minHeight: hp(65),
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketCard: {
    backgroundColor: '#121212',
    borderRadius: wp(5),
    padding: wp(4.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  ticketTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: hp(1.5) },
  ticketIdWrap: { flexDirection: 'row', alignItems: 'center' },
  ticketIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(2.5),
    backgroundColor: '#161616',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  ticketId: { fontSize: wp(3.5), fontWeight: '800', color: '#fff' },
  ticketDate: { fontSize: wp(2.8), color: '#555', marginTop: hp(0.2) },
  
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(2.8),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
    borderWidth: 1,
  },
  statusDot: { width: wp(1.8), height: wp(1.8), borderRadius: wp(0.9), marginRight: wp(1.5) },
  statusText: { fontSize: wp(2.8), fontWeight: '800' },
  
  ticketSubject: { fontSize: wp(4), fontWeight: '700', color: '#fff', marginBottom: hp(1.8), lineHeight: wp(5.5) },
  
  ticketFooter: { flexDirection: 'row', alignItems: 'center' },
  categoryTag: {
    backgroundColor: '#161616',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: '#222',
  },
  categoryTagText: { fontSize: wp(2.8), color: '#888', fontWeight: '800', textTransform: 'uppercase' },
  
  replyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.08)',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(2),
    marginLeft: wp(3),
    borderWidth: 0.5,
    borderColor: 'rgba(76, 175, 80, 0.2)',
  },
  replyText: { fontSize: wp(2.8), color: '#4CAF50', fontWeight: '800', marginLeft: wp(1.5) },

  emptyState: { alignItems: 'center', marginTop: hp(12), paddingHorizontal: wp(10) },
  emptyText: { fontSize: wp(5), color: '#fff', fontWeight: '800', marginTop: hp(2) },
  emptySubText: { fontSize: wp(3.5), color: '#444', textAlign: 'center', marginTop: hp(1), lineHeight: wp(5) },
  raiseBtn: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.2),
    borderRadius: wp(3),
    marginTop: hp(3),
  },
  raiseBtnText: { color: '#000', fontWeight: '700', fontSize: wp(3.8) },
});
