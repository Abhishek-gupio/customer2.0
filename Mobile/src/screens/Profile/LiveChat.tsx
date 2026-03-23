import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Platform,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import { supportApi } from '../../api/support';

const { width } = Dimensions.get('window');

interface ChatMessage {
  id: string;
  type: 'bot' | 'user';
  content: string;
  timestamp: string;
  options?: { label: string; nextFlow: string }[];
}

export default function LiveChat() {
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Initial greeting
    loadFlow('root');
  }, []);

  const loadFlow = async (flowId: string) => {
    setLoading(true);
    try {
      const resp = await supportApi.getChatFlow(flowId);
      if (resp.success) {
        const botMsg: ChatMessage = {
          id: Date.now().toString(),
          type: 'bot',
          content: resp.data.message,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          options: resp.data.options,
        };
        setMessages(prev => [...prev, botMsg]);
      }
    } catch (err) {
      console.error('Chat flow error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionPress = (option: { label: string; nextFlow: string }) => {
    // Add user message to UI
    const userMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      type: 'user',
      content: option.label,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    
    // Clear options from previous messages to avoid confusion
    setMessages(prev => [
      ...prev.map(m => ({ ...m, options: undefined })),
      userMsg
    ]);
    
    // Load next bot flow
    setTimeout(() => loadFlow(option.nextFlow), 600);
  };

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      {/* ─── Header (Myntra Style) ─── */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={wp(4.5)} color="#fff" />
          </TouchableOpacity>
          <View style={styles.agentInfo}>
            <View style={styles.avatarWrap}>
              <Icon name="robot" size={wp(5)} color="#ff4081" />
            </View>
            <View>
              <Text style={styles.agentName}>Gupio Support</Text>
              <Text style={styles.agentStatus}>Online</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <Icon name="times" size={wp(4.5)} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((item) => (
          <View key={item.id} style={[
            styles.messageRow,
            item.type === 'user' ? styles.userRow : styles.botRow
          ]}>
            {item.type === 'bot' && (
              <View style={styles.botIconSmall}>
                <Icon name="robot" size={wp(3)} color="#ff4081" />
              </View>
            )}
            <View style={styles.messageBubbleWrap}>
              <View style={[
                styles.bubble,
                item.type === 'user' ? styles.userBubble : styles.botBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  item.type === 'user' ? styles.userText : styles.botText
                ]}>
                  {item.content}
                </Text>
              </View>
              <Text style={styles.timestamp}>{item.timestamp}</Text>
              
              {/* Optional Quick Reply Buttons - Now Vertical & Premium */}
              {item.options && (
                <View style={styles.optionsWrap}>
                  {item.options.map((opt, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.optionBtn}
                      activeOpacity={0.8}
                      onPress={() => handleOptionPress(opt)}
                    >
                      <View style={styles.optionIconContainer}>
                         <Icon 
                           name={
                             opt.label.toLowerCase().includes('vehicle') ? 'car' :
                             opt.label.toLowerCase().includes('ticket') || opt.label.toLowerCase().includes('support') ? 'ticket-alt' :
                             opt.label.toLowerCase().includes('rc') ? 'id-card' :
                             opt.label.toLowerCase().includes('service') ? 'concierge-bell' : 
                             opt.label.toLowerCase().includes('expense') ? 'file-invoice-dollar' :
                             opt.label.toLowerCase().includes('sos') ? 'emergency' :
                             opt.label.toLowerCase().includes('budget') ? 'chart-pie' :
                             opt.label.toLowerCase().includes('health') ? 'heartbeat' :
                             'chevron-right'
                           } 
                           size={wp(3.5)} 
                           color="#ff4081" 
                         />
                      </View>
                      <Text style={styles.optionText}>{opt.label}</Text>
                      <Icon name="arrow-right" size={wp(3)} color="rgba(255, 64, 129, 0.4)" />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        ))}
        {loading && (
          <View style={styles.botRow}>
            <View style={styles.bubble}>
              <Text style={styles.botText}>...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* No Input bar as per request for button-driven chat */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Select an option to continue</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  
  /* Header */
  header: {
    height: hp(10),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  backBtn: { padding: wp(2), marginRight: wp(2) },
  agentInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: '#333',
  },
  agentName: { fontSize: wp(4), fontWeight: '700', color: '#fff' },
  agentStatus: { fontSize: wp(3), color: '#4CAF50' },
  closeBtn: {
    width: wp(9),
    height: wp(9),
    borderRadius: wp(4.5),
    backgroundColor: '#222',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Chat Area */
  chatArea: { flex: 1 },
  chatContent: { padding: wp(4), paddingBottom: hp(5) },
  messageRow: { marginBottom: hp(2.5), flexDirection: 'row' },
  botRow: { justifyContent: 'flex-start' },
  userRow: { justifyContent: 'flex-end' },
  botIconSmall: {
    width: wp(6),
    height: wp(6),
    borderRadius: wp(3),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(2),
    alignSelf: 'flex-end',
    marginBottom: hp(1.5),
  },
  messageBubbleWrap: { maxWidth: '80%' },
  bubble: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderRadius: wp(4),
  },
  botBubble: {
    backgroundColor: '#121212',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#222',
  },
  userBubble: {
    backgroundColor: '#ff4081',
    borderBottomRightRadius: 2,
  },
  messageText: { fontSize: wp(3.8), lineHeight: wp(5.5) },
  botText: { color: '#ddd' },
  userText: { color: '#fff', fontWeight: '500' },
  timestamp: {
    fontSize: wp(2.8),
    color: '#666',
    marginTop: hp(0.5),
    alignSelf: 'flex-end',
  },

  /* Options */
  optionsWrap: {
    marginTop: hp(1.5),
    width: '100%',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.8),
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255, 64, 129, 0.15)',
    marginBottom: hp(1.2),
    backgroundColor: '#161616',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  optionIconContainer: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(255, 64, 129, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  optionText: { 
    flex: 1,
    color: '#eee', 
    fontSize: wp(3.8), 
    fontWeight: '600' 
  },

  /* Footer */
  footer: {
    padding: hp(2),
    borderTopWidth: 1,
    borderTopColor: '#222',
    alignItems: 'center',
  },
  footerText: { color: '#666', fontSize: wp(3.2) },
});
