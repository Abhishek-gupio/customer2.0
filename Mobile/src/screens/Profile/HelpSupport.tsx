import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../components/BackButton';
import { useNavigation } from '../../lib/react-navigation-native';
import { supportApi } from '../../api/support';

/* ── Data ── */
// ... (keep ch.onPress updates below)

export default function HelpSupport() {
  const navigation = useNavigation<any>();
  const [faqs, setFaqs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedIndex, setExpandedIndex] = React.useState<number | null>(null);
  const [activeCategory, setActiveCategory] = React.useState('ALL');
  const [ratings, setRatings] = React.useState<Record<number, 'LIKE' | 'DISLIKE' | null>>({});

  React.useEffect(() => {
    loadFaqs();
  }, []);

  const loadFaqs = async () => {
    try {
      const resp = await supportApi.getFaqs();
      if (resp.success) setFaqs(resp.data);
    } catch (err) {
      console.error('Failed to load FAQs', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredFaqs = faqs; // Simple list for now as per "delete search bar"

  const CATEGORIES = [
    { id: 'ALL', label: 'All', icon: 'th-large' },
    { id: 'VEHICLE', label: 'Vehicle', icon: 'car' },
    { id: 'DOCUMENTS', label: 'Documents', icon: 'file-invoice' },
    { id: 'VALET', label: 'Valet', icon: 'concierge-bell' },
    { id: 'AI_ASSISTANT', label: 'AI Assistant', icon: 'robot' },
    { id: 'BILLING', label: 'Billing', icon: 'credit-card' },
    { id: 'ACCOUNT', label: 'Account', icon: 'user-cog' },
    { id: 'TECHNICAL', label: 'Technical', icon: 'microchip' },
    { id: 'OTHER', label: 'Other', icon: 'ellipsis-h' },
  ];

  const SUPPORT_CHANNELS = [
    {
      icon: 'comment-alt',
      title: 'Live Chat',
      subtitle: 'Chat with our support team',
      available: true,
      onPress: () => navigation.navigate('LiveChat'),
    },
    {
      icon: 'phone-alt',
      title: 'Call Us',
      subtitle: '1800-123-4567 (Toll Free)',
      available: true,
      onPress: () => Linking.openURL('tel:18001234567'),
    },
    {
      icon: 'envelope',
      title: 'Email Support',
      subtitle: 'support@gupio.com',
      available: true,
      onPress: () => Linking.openURL('mailto:support@gupio.com'),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Unified Header ─── */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <Text style={styles.headerSubtitle}>We're here to assist you</Text>
          </View>
        </View>

        {/* ─── Support Top Cards ─── */}
        <View style={styles.topCardsRow}>
          <TouchableOpacity 
            style={[styles.topCard, styles.contactCard]} 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('ContactSupport')}
          >
            <View style={[styles.topCardIconWrap, styles.contactIconWrap]}>
              <Icon name="phone-alt" size={wp(4.5)} color="#4CAF50" />
            </View>
            <Text style={styles.topCardTitle}>Contact Support</Text>
            <Text style={styles.topCardSub}>Submit a ticket</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.topCard} 
            activeOpacity={0.85}
            onPress={() => navigation.navigate('TicketHistory')}
          >
            <View style={styles.topCardIconWrap}>
              <Icon name="file-alt" size={wp(4.5)} color="#aaa" />
            </View>
            <Text style={styles.topCardTitle}>My Tickets</Text>
            <Text style={styles.topCardSub}>Track requests</Text>
          </TouchableOpacity>
        </View>

        {/* ─── Support Channels List (Screenshot Style) ─── */}
        <View style={styles.channelsContainer}>
          {SUPPORT_CHANNELS.map((ch, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.channelItem, i === SUPPORT_CHANNELS.length - 1 && { borderBottomWidth: 0 }]}
              activeOpacity={0.85}
              onPress={ch.onPress}
            >
              <View style={styles.channelItemIconWrap}>
                <Icon name={ch.icon} size={wp(4.5)} color="#aaa" />
              </View>
              <View style={styles.channelItemInfo}>
                <Text style={styles.channelItemTitle}>{ch.title}</Text>
                <Text style={styles.channelItemSub}>{ch.subtitle}</Text>
              </View>
              {ch.available !== undefined && (
                <View style={styles.channelItemRight}>
                  <View style={[styles.availableDot, !ch.available && { backgroundColor: '#666' }]} />
                  <Text style={[styles.availableText, !ch.available && { color: '#666' }]}>
                    {ch.available ? 'Available' : 'Offline'}
                  </Text>
                  <Icon name="chevron-right" size={wp(2.8)} color="#444" style={{ marginLeft: wp(2) }} />
                </View>
              )}
            </TouchableOpacity>
          ))}
          
          {/* Support Hours Item */}
          <View style={[styles.channelItem, { borderBottomWidth: 0 }]}>
            <View style={styles.channelItemIconWrap}>
              <Icon name="clock" size={wp(4.5)} color="#aaa" />
            </View>
            <View style={styles.channelItemInfo}>
              <Text style={styles.channelItemTitle}>Support Hours</Text>
              <Text style={styles.channelItemSub}>Mon–Sun: 9AM–9PM IST</Text>
              <Text style={[styles.channelItemSub, { color: '#666', fontSize: wp(2.8) }]}>Emergency support 24/7</Text>
            </View>
          </View>
        </View>

        {/* ─── Frequently Asked Questions ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <View style={styles.questionsCard}>
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((q, i) => {
                const isExpanded = expandedIndex === i;
                return (
                  <View key={i} style={styles.questionContainer}>
                    <TouchableOpacity
                      style={[styles.questionRow, isExpanded && styles.questionRowExpanded]}
                      activeOpacity={0.85}
                      onPress={() => setExpandedIndex(isExpanded ? null : i)}
                    >
                      <View style={styles.questionIconWrap}>
                        <Icon 
                          name="question-circle" 
                          size={wp(4.2)} 
                          color={isExpanded ? "#4CAF50" : "#666"}
                        />
                      </View>
                      <Text style={[styles.questionText, isExpanded && styles.questionTextExpanded]}>
                        {q.question}
                      </Text>
                      <Icon
                        name={isExpanded ? "chevron-up" : "chevron-right"}
                        size={wp(3)}
                        color="#444"
                      />
                    </TouchableOpacity>
                    {isExpanded && (
                      <View style={styles.answerWrap}>
                        <Text style={styles.answerText}>{q.answer}</Text>
                        
                        {/* Rating Row */}
                        <View style={styles.ratingRow}>
                          <Text style={styles.ratingText}>Was this helpful?</Text>
                          <TouchableOpacity 
                            style={[styles.ratingBtn, ratings[i] === 'LIKE' && styles.ratingBtnActive]}
                            onPress={() => setRatings(prev => ({ ...prev, [i]: prev[i] === 'LIKE' ? null : 'LIKE' }))}
                          >
                            <Icon 
                              name="thumbs-up" 
                              size={wp(3.5)} 
                              color={ratings[i] === 'LIKE' ? "#4CAF50" : "#888"} 
                            />
                          </TouchableOpacity>
                          <TouchableOpacity 
                            style={[styles.ratingBtn, ratings[i] === 'DISLIKE' && styles.ratingBtnActive]}
                            onPress={() => setRatings(prev => ({ ...prev, [i]: prev[i] === 'DISLIKE' ? null : 'DISLIKE' }))}
                          >
                            <Icon 
                              name="thumbs-down" 
                              size={wp(3.5)} 
                              color={ratings[i] === 'DISLIKE' ? "#F44336" : "#888"} 
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Fallback CTA */}
                        <TouchableOpacity 
                          style={styles.faqContactBtn}
                          onPress={() => navigation.navigate('ContactSupport')}
                        >
                          <Text style={styles.faqContactBtnText}>Still need help? Contact Support</Text>
                          <Icon name="arrow-right" size={wp(2.8)} color="#4CAF50" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              <View style={styles.emptySearch}>
                <Text style={styles.emptySearchText}>No questions found.</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Pro Tip ─── */}
        <View style={styles.section}>
          <View style={styles.proTipCard}>
            <View style={styles.proTipIconWrap}>
              <Icon name="check-circle" size={wp(6)} color="#4CAF50" />
            </View>
            <View style={styles.proTipContent}>
              <Text style={styles.proTipTitle}>Pro Tip</Text>
              <Text style={styles.proTipText}>
                Use the AI Assistant in the app for instant answers to your questions. Just tap the
                AI icon in the bottom navigation!
              </Text>
            </View>
          </View>
        </View>

        {/* ─── Footer ─── */}
        <View style={styles.footer}>
          <Text style={styles.footerApp}>Gupio Customer App</Text>
          <Text style={styles.footerVersion}>Version 1.0.0</Text>
        </View>

        <View style={{ height: hp(4) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ════════════════════ Styles ════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp(4) },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(2.5), // Space below the header
  },
  headerTitleWrap: {
    marginLeft: wp(4),
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp(5.5),
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: wp(3),
    color: '#888',
    marginTop: hp(0.2),
  },

  /* Search Bar */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    marginHorizontal: wp(4),
    paddingHorizontal: wp(4),
    borderRadius: wp(3),
    height: hp(6),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  searchIcon: { marginRight: wp(3) },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
  },

  /* Category Filter */
  categoryWrap: {
    marginBottom: hp(2.5),
  },
  categoryScroll: {
    paddingHorizontal: wp(4),
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: wp(10),
    marginRight: wp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  categoryPillActive: {
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50',
  },
  categoryPillText: {
    marginLeft: wp(2),
    color: '#888',
    fontSize: wp(3.2),
    fontWeight: '600',
  },
  categoryPillTextActive: {
    color: '#000',
  },

  /* Section */
  section: {
    paddingHorizontal: wp(4),
    marginBottom: hp(1),
  },
  sectionTitle: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#888',
    marginBottom: hp(1.5),
    paddingLeft: wp(1),
  },

  /* Premium Top Cards */
  topCardsRow: {
    flexDirection: 'row',
    paddingHorizontal: wp(4),
    justifyContent: 'space-between',
    marginBottom: hp(2),
  },
  topCard: {
    width: wp(45),
    backgroundColor: '#121212',
    borderRadius: wp(5),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  contactCard: {
    borderColor: 'rgba(76,175,80,0.2)',
  },
  topCardIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(3),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
  },
  contactIconWrap: {
    backgroundColor: 'rgba(76,175,80,0.1)',
  },
  topCardTitle: {
    fontSize: wp(4.2),
    fontWeight: '800',
    color: '#fff',
    marginBottom: hp(0.3),
  },
  topCardSub: {
    fontSize: wp(3),
    color: '#888',
  },

  /* Support Channels Vertical List */
  channelsContainer: {
    backgroundColor: '#121212',
    borderRadius: wp(5),
    marginHorizontal: wp(4),
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: wp(4.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  channelItemIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(2.5),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(4),
  },
  channelItemInfo: { flex: 1 },
  channelItemTitle: {
    fontSize: wp(4.1),
    fontWeight: '700',
    color: '#fff',
  },
  channelItemSub: {
    fontSize: wp(3.3),
    color: '#888',
    marginTop: hp(0.2),
  },
  channelItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableDot: {
    width: wp(1.8),
    height: wp(1.8),
    borderRadius: wp(0.9),
    backgroundColor: '#4CAF50',
    marginRight: wp(1.5),
  },
  availableText: {
    fontSize: wp(3.1),
    fontWeight: '600',
    color: '#4CAF50',
  },

  /* Common Questions */
  questionsCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  questionContainer: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2.2),
    paddingHorizontal: wp(4.5),
  },
  questionRowExpanded: {
    backgroundColor: 'rgba(76,175,80,0.05)',
  },
  questionIconWrap: {
    marginRight: wp(3.5),
  },
  questionText: {
    flex: 1,
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
  },
  questionTextExpanded: {
    color: '#4CAF50',
  },
  answerWrap: {
    paddingHorizontal: wp(12),
    paddingBottom: hp(2),
    paddingTop: hp(0.5),
  },
  answerText: {
    fontSize: wp(3.6),
    color: '#aaa',
    lineHeight: wp(5.2),
    marginBottom: hp(2),
  },

  /* FAQ Ratings */
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: hp(1),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.03)',
    marginBottom: hp(2),
  },
  ratingText: {
    fontSize: wp(3),
    color: '#555',
    marginRight: wp(3),
  },
  ratingBtn: {
    padding: wp(2),
    marginRight: wp(2),
    backgroundColor: '#1a1a1a',
    borderRadius: wp(2),
    borderWidth: 1,
    borderColor: 'transparent',
  },
  ratingBtnActive: {
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#222',
  },

  /* FAQ Contact CTA */
  faqContactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.1)',
  },
  faqContactBtnText: {
    fontSize: wp(3.2),
    color: '#4CAF50',
    fontWeight: '700',
  },

  /* Pro Tip */
  proTipCard: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4.5),
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.25)',
    marginTop: hp(1),
  },
  proTipIconWrap: {
    marginRight: wp(3),
    marginTop: hp(0.3),
  },
  proTipContent: { flex: 1 },
  proTipTitle: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#4CAF50',
    marginBottom: hp(0.5),
  },
  proTipText: {
    fontSize: wp(3.4),
    color: '#888',
    lineHeight: wp(4.8),
  },
  emptySearch: {
    padding: wp(10),
    alignItems: 'center',
  },
  emptySearchText: {
    color: '#666',
    fontSize: wp(3.5),
    textAlign: 'center',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    paddingVertical: hp(3),
  },
  footerApp: {
    fontSize: wp(3.5),
    color: '#666',
    fontWeight: '500',
  },
  footerVersion: {
    fontSize: wp(3),
    color: '#555',
    marginTop: hp(0.3),
  },
});
