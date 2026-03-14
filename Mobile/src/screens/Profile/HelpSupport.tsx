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

/* ── Data ── */
const SUPPORT_CHANNELS = [
  {
    icon: 'comment-dots',
    title: 'Live Chat',
    subtitle: 'Chat with our support team',
    available: true,
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
  {
    icon: 'clock',
    title: 'Support Hours',
    subtitle: 'Monday - Sunday: 9:00 AM - 9:00 PM IST',
    extra: 'Emergency support available 24/7',
    available: false,
  },
];

const HELP_RESOURCES = [
  { icon: 'book-open', title: 'User Guide', subtitle: 'Learn how to use the app' },
  { icon: 'clipboard-list', title: 'FAQs', subtitle: 'Find answers to common questions' },
  { icon: 'play-circle', title: 'Video Tutorials', subtitle: 'Watch step-by-step guides' },
  { icon: 'shield-alt', title: 'Privacy & Security', subtitle: 'Learn about data protection' },
];

const COMMON_QUESTIONS = [
  'How to add a new vehicle?',
  'How to upload documents?',
  'How to track expenses?',
  'How to request valet service?',
  'How to use AI Assistant?',
];

export default function HelpSupport() {
  const navigation = useNavigation();

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
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <View style={{ flex: 1, marginLeft: wp(3) }}>
            <Text style={styles.title}>Help & Support</Text>
            <Text style={styles.subtitle}>We're here to help you</Text>
          </View>
        </View>

        {/* ─── Support Channels ─── */}
        <View style={styles.section}>
          {SUPPORT_CHANNELS.map((ch, i) => (
            <TouchableOpacity
              key={i}
              style={styles.channelCard}
              activeOpacity={0.85}
              onPress={ch.onPress}
            >
              <View style={styles.channelIconWrap}>
                <Icon name={ch.icon} size={wp(5)} color="#aaa" />
              </View>
              <View style={styles.channelInfo}>
                <Text style={styles.channelTitle}>{ch.title}</Text>
                <Text style={styles.channelSub}>{ch.subtitle}</Text>
                {ch.extra ? (
                  <Text style={styles.channelExtra}>{ch.extra}</Text>
                ) : null}
              </View>
              {ch.available ? (
                <View style={styles.channelRight}>
                  <View style={styles.availableDot} />
                  <Text style={styles.availableText}>Available</Text>
                  <Icon name="chevron-right" size={wp(3)} color="#888" style={{ marginLeft: wp(1.5) }} />
                </View>
              ) : null}
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Help Resources ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Help Resources</Text>
          {HELP_RESOURCES.map((res, i) => (
            <TouchableOpacity key={i} style={styles.resourceRow} activeOpacity={0.85}>
              <View style={styles.resourceIconWrap}>
                <Icon name={res.icon} size={wp(4.5)} color="#aaa" />
              </View>
              <View style={styles.resourceInfo}>
                <Text style={styles.resourceTitle}>{res.title}</Text>
                <Text style={styles.resourceSub}>{res.subtitle}</Text>
              </View>
              <Icon name="external-link-alt" size={wp(3.5)} color="#888" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Common Questions ─── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Questions</Text>
          <View style={styles.questionsCard}>
            {COMMON_QUESTIONS.map((q, i) => (
              <TouchableOpacity key={i} style={styles.questionRow} activeOpacity={0.85}>
                <View style={styles.questionIconWrap}>
                  <Icon name="exclamation-circle" size={wp(4)} color="#4CAF50" />
                </View>
                <Text style={styles.questionText}>{q}</Text>
                <Icon name="chevron-right" size={wp(3)} color="#888" />
              </TouchableOpacity>
            ))}
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
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp(4) },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },

  title: {
    fontSize: wp(6.5),
    fontWeight: '800',
    color: '#fff',
  },
  subtitle: {
    fontSize: wp(3.8),
    color: '#888',
    marginTop: hp(0.2),
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

  /* Support Channel Card */
  channelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: wp(4),
    padding: wp(4.5),
    marginBottom: hp(1.2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  channelIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  channelInfo: { flex: 1 },
  channelTitle: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#fff',
  },
  channelSub: {
    fontSize: wp(3.3),
    color: '#888',
    marginTop: hp(0.3),
  },
  channelExtra: {
    fontSize: wp(3),
    color: '#666',
    marginTop: hp(0.2),
  },
  channelRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableDot: {
    width: wp(2),
    height: wp(2),
    borderRadius: wp(1),
    backgroundColor: '#4CAF50',
    marginRight: wp(1.5),
  },
  availableText: {
    fontSize: wp(3.2),
    fontWeight: '600',
    color: '#4CAF50',
  },

  /* Help Resources */
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: wp(4),
    padding: wp(4.5),
    marginBottom: hp(1),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  resourceIconWrap: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(3),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  resourceInfo: { flex: 1 },
  resourceTitle: {
    fontSize: wp(4),
    fontWeight: '700',
    color: '#fff',
  },
  resourceSub: {
    fontSize: wp(3.2),
    color: '#888',
    marginTop: hp(0.2),
  },

  /* Common Questions */
  questionsCard: {
    backgroundColor: '#111',
    borderRadius: wp(4),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2),
    paddingHorizontal: wp(4.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  questionIconWrap: {
    marginRight: wp(3),
  },
  questionText: {
    flex: 1,
    fontSize: wp(3.8),
    fontWeight: '500',
    color: '#fff',
  },

  /* Pro Tip */
  proTipCard: {
    flexDirection: 'row',
    backgroundColor: '#111',
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
    fontSize: wp(3.5),
    color: '#aaa',
    lineHeight: wp(5.2),
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
