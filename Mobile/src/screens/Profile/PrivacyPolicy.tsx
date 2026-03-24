import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  Platform,
  TouchableOpacity,
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

const LegalSection = ({ title, content, index }: { title: string; content: React.ReactNode; index: number }) => (
  <View style={styles.sectionCard}>
    <View style={styles.sectionHeader}>
      <View style={styles.indexBadge}>
        <Text style={styles.indexText}>{index}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
    <View style={styles.sectionBody}>
      {content}
    </View>
  </View>
);

export default function PrivacyPolicy() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#000' : undefined}
      />
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <View style={styles.badgeRow}>
            <View style={styles.securityBadge}>
              <Icon name="shield-alt" size={8} color="#4CAF50" />
              <Text style={styles.securityBadgeText}>ENCRYPTED</Text>
            </View>
            <Text style={styles.headerSubtitle}>Last Updated: March 2026</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introCard}>
          <Text style={styles.introText}>
            GUPIO CUSTOMER APP ("App," "we," "us," or "our") is committed to protecting your privacy. This policy explains how we collect and use your data to ensure a secure experience.
          </Text>
        </View>

        <LegalSection 
          index={1} 
          title="Data We Collect"
          content={
            <View>
              <Text style={styles.subTitle}>1.1 Account Data</Text>
              <Text style={styles.bodyText}>Full name, email address, mobile number, company registration details, and GSTIN (if applicable).</Text>
              
              <Text style={styles.subTitle}>1.2 Vehicle Data</Text>
              <Text style={styles.bodyText}>Registration numbers, RC documents, insurance details, PUC certificates, and service/maintenance records.</Text>
              
              <Text style={styles.subTitle}>1.3 Driver Data</Text>
              <Text style={styles.bodyText}>Names and contact information of drivers associated with your fleet account.</Text>

              <Text style={styles.subTitle}>1.4 Expense Data</Text>
              <Text style={styles.bodyText}>Fuel receipts, maintenance invoices, and other operational expenses logged within the App.</Text>

              <Text style={styles.subTitle}>1.5 Location Data</Text>
              <Text style={styles.bodyText}>GPS coordinates of vehicles (collected only when tracking is active) to provide route history and alerts.</Text>

              <Text style={styles.subTitle}>1.6 Emergency Data</Text>
              <Text style={styles.bodyText}>Contact details of designated emergency personnel notified during SOS alerts.</Text>

              <Text style={styles.subTitle}>1.7 Technical Data</Text>
              <Text style={styles.bodyText}>IP address, device type, operating system, and app usage analytics.</Text>
            </View>
          }
        />

        <LegalSection 
          index={2} 
          title="How We Use Your Data"
          content={
            <View>
              <Text style={styles.bodyText}>We use your data for the following essential purposes:</Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Providing core tracking and expense management features.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Sending automated alerts for document expiries, safety incidents, and SOS events.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Generating business reports and operational insights for your account.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Complying with legal requirements and government regulations in India.</Text>
              </View>
            </View>
          }
        />

        <LegalSection 
          index={3} 
          title="Data Sharing"
          content={
            <View>
              <Text style={styles.subTitle}>3.1 Third-Party Providers</Text>
              <Text style={styles.bodyText}>We share necessary data with trusted service providers (e.g., Google Maps, cloud hosting) solely to ensure App functionality.</Text>
              <Text style={styles.subTitle}>3.2 Law Enforcement</Text>
              <Text style={styles.bodyText}>We may disclose information to law enforcement only if legally required by a subpoena or court order.</Text>
              <Text style={[styles.bodyText, { color: '#4CAF50', fontFamily: 'Outfit-Bold', marginTop: hp(1) }]}>
                Important: GUPIO does not sell, rent, or trade your personal or fleet data.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={4} 
          title="Data Retention"
          content={
            <View>
              <Text style={styles.bodyText}>
                We retain account data for the lifetime of your active account. Financial records are kept for 7 years for tax audits. Trip logs and location data are archived after 12 months.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={5} 
          title="Your Rights"
          content={
            <View>
              <Text style={styles.bodyText}>
                You have the right to access, correct, or delete your data at any time. You may withdraw consent for location tracking via App settings.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={6} 
          title="Security Measures"
          content={
            <View>
              <Text style={styles.bodyText}>
                We implement AES-256 encryption and TLS 1.3 to safeguard your sensitive information.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={7} 
          title="Cookies & Analytics"
          content={
            <View>
              <Text style={styles.bodyText}>
                We use Firebase and Crashlytics to monitor App stability. No tracking cookies are used for advertising.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={8} 
          title="Contact Us"
          content={
            <View>
              <View style={styles.contactPoint}>
                <Text style={styles.contactLabel}>Company Office:</Text>
                <Text style={styles.contactValue}>GUPIO, 77, near Medplus Naidu Store, Sriramapura 2nd Stage, Ayodhya Nagar, Mysuru, Karnataka 570034</Text>
              </View>
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={() => Linking.openURL('mailto:privacy@gupio.io')}
              >
                <Text style={styles.actionBtnText}>Contact Privacy Officer</Text>
                <Icon name="arrow-right" size={10} color="#FFD700" />
              </TouchableOpacity>
            </View>
          }
        />

        <View style={styles.securityFooter}>
          <Icon name="lock" size={24} color="rgba(76,175,80,0.5)" style={{ marginBottom: hp(1) }} />
          <Text style={styles.footerHeading}>Privacy is Our Priority</Text>
          
          <View style={styles.emailRow}>
            <TouchableOpacity onPress={() => Linking.openURL('mailto:privacy@gupio.io')}>
              <Text style={styles.footerEmail}>privacy@gupio.io</Text>
            </TouchableOpacity>
            <View style={styles.dot} />
            <TouchableOpacity onPress={() => Linking.openURL('mailto:security@gupio.io')}>
              <Text style={styles.footerEmail}>security@gupio.io</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: hp(5) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(2),
  },
  headerTitleWrap: { marginLeft: wp(4), justifyContent: 'center' },
  headerTitle: {
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  badgeRow: { flexDirection: 'row', alignItems: 'center', marginTop: hp(0.3) },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.2),
    borderRadius: wp(1),
    marginRight: wp(2),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.2)',
    gap: wp(1),
  },
  securityBadgeText: { fontSize: wp(2), color: '#4CAF50', fontFamily: 'Outfit-Bold' },
  headerSubtitle: { fontSize: wp(3), color: '#888', fontFamily: 'Outfit-Medium' },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(5) },

  introCard: {
    backgroundColor: 'rgba(76,175,80,0.05)',
    borderRadius: wp(4),
    padding: wp(4.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(76,175,80,0.1)',
  },
  introText: {
    fontSize: wp(3.6),
    color: '#ccc',
    lineHeight: wp(5.2),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
  },

  sectionCard: {
    backgroundColor: '#111',
    borderRadius: wp(4),
    marginBottom: hp(2),
    padding: wp(4.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(1.2) },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  indexText: { color: '#4CAF50', fontSize: wp(3.2), fontFamily: 'Outfit-Bold' },
  sectionTitle: { fontSize: wp(4.2), color: '#fff', fontFamily: 'Outfit-Bold' },
  sectionBody: { borderTopWidth: 0.5, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: hp(1.5) },
  
  bodyText: {
    fontSize: wp(3.6),
    color: '#bbb',
    lineHeight: wp(5.2),
    fontFamily: 'Outfit-Regular',
  },
  subTitle: {
    fontSize: wp(3.6),
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    marginTop: hp(1),
    marginBottom: hp(0.5),
  },
  bulletRow: { flexDirection: 'row', marginBottom: hp(0.8), paddingRight: wp(5) },
  bullet: { color: '#4CAF50', marginRight: wp(3), fontSize: wp(4) },
  bulletText: { flex: 1, fontSize: wp(3.6), color: '#bbb', fontFamily: 'Outfit-Regular' },

  contactPoint: { marginBottom: hp(1.5) },
  contactLabel: { color: '#666', fontSize: wp(3), fontFamily: 'Outfit-Medium', marginBottom: hp(0.2) },
  contactValue: { color: '#aaa', fontSize: wp(3.4), fontFamily: 'Outfit-Regular', lineHeight: wp(4.5) },

  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: wp(2) },
  actionBtnText: { color: '#FFD700', fontSize: wp(3.5), fontFamily: 'Outfit-Bold' },

  securityFooter: {
    marginTop: hp(2),
    paddingVertical: hp(3),
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(76,175,80,0.1)',
  },
  footerHeading: { fontSize: wp(4), color: '#4CAF50', fontFamily: 'Outfit-Bold', marginBottom: hp(1) },
  emailRow: { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  footerEmail: { fontSize: wp(3.2), color: '#888', fontFamily: 'Outfit-Medium' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#333' },
});
