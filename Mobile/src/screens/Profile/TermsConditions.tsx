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

export default function TermsConditions() {
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
          <Text style={styles.headerTitle}>Terms & Conditions</Text>
          <View style={styles.badgeRow}>
            <View style={styles.versionBadge}>
              <Text style={styles.versionBadgeText}>v1.0</Text>
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
            By downloading, installing, accessing, or using the GUPIO CUSTOMER APP mobile application ("the App"), you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions ("Terms").
          </Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>App Name: <Text style={styles.metaValue}>GUPIO CUSTOMER APP</Text></Text>
            <Text style={styles.metaLabel}>Jurisdiction: <Text style={styles.metaValue}>Mysuru, Karnataka</Text></Text>
          </View>
        </View>

        <LegalSection 
          index={1} 
          title="Acceptance of Terms"
          content={
            <Text style={styles.bodyText}>
              These Terms constitute a legally binding agreement between you ("User") and GUPIO ("Company," "we," "our," or "us").{'\n\n'}
              If you do not agree to any part of these Terms, you must immediately cease using the App and uninstall it from your device. Continued use of the App following any updates to these Terms constitutes your acceptance of the revised Terms.
            </Text>
          }
        />

        <LegalSection 
          index={2} 
          title="User Responsibilities"
          content={
            <View>
              <Text style={styles.subTitle}>2.1 Account Security</Text>
              <Text style={styles.bodyText}>
                You are solely responsible for maintaining the confidentiality of your login credentials. You agree to notify us immediately at support@gupio.io of any unauthorised access or security breach.
              </Text>
              <Text style={styles.subTitle}>2.2 Accurate Information</Text>
              <Text style={styles.bodyText}>
                You agree to provide accurate, current, and complete information, including but not limited to vehicle records, driver details, and billing information. GUPIO is not responsible for errors resulting from incorrect data entry.
              </Text>
              <Text style={styles.subTitle}>2.3 Lawful Use</Text>
              <Text style={styles.bodyText}>
                You agree to use the App only for lawful purposes and in compliance with all applicable Indian laws, including the Motor Vehicles Act, 1988, and the Information Technology Act, 2000.
              </Text>
            </View>
          }
        />

        <LegalSection 
          index={3} 
          title="Fleet Data & Usage"
          content={
            <View>
              <Text style={styles.subTitle}>3.1 Data Ownership</Text>
              <Text style={styles.bodyText}>All fleet data, records, and documents you input remains your property. GUPIO does not claim ownership over your operational records.</Text>
              <Text style={styles.subTitle}>3.2 Processing Licence</Text>
              <Text style={styles.bodyText}>By using the App, you grant GUPIO a limited, non-exclusive, world-wide licence to store, process, and display your data solely for the purpose of providing and improving the App's services.</Text>
              <Text style={styles.subTitle}>3.3 Compliance Records</Text>
              <Text style={styles.bodyText}>You acknowledge that you are responsible for maintaining and updating all mandatory compliance documents (e.g., insurance, PUC) within the App.</Text>
            </View>
          }
        />

        <LegalSection 
          index={4} 
          title="Prohibited Activities"
          content={
            <View>
              <Text style={styles.bodyText}>You agree not to engage in any of the following prohibited activities:</Text>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Tracking individuals without their informed consent.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Accessing or attempting to access another user's account without authorisation.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Reverse engineering, decompiling, or disassembling any part of the App.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Copying, reproducing, or creating derivative works based on the App's design or software.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Uploading malicious code, viruses, or any software intended to disrupt service.</Text>
              </View>
              <View style={styles.bulletRow}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>Submitting false or fraudulent expense claims, vehicle records, or documents.</Text>
              </View>
            </View>
          }
        />

        <LegalSection 
          index={5} 
          title="Intellectual Property"
          content={
            <Text style={styles.bodyText}>
              The GUPIO CUSTOMER APP name, logo, trade names, and interface design are the exclusive property of GUPIO and are protected under Indian intellectual property laws. 
              Nothing in these Terms grants you any right or title to our intellectual property except for the limited right to use the App as intended.
            </Text>
          }
        />

        <LegalSection 
          index={6} 
          title="Limitation of Liability"
          content={
            <Text style={styles.bodyText}>
              To the maximum extent permitted by law, GUPIO shall not be liable for any indirect, incidental, or consequential damages, including but not limited to:{'\n'}
              • Loss of fleet data or operational records{'\n'}
              • Any vehicle accidents or road incidents{'\n'}
              • Financial losses arising from incorrect vehicle tracking{'\n'}
              • Service interruptions or App downtime{'\n\n'}
              Our total liability for any claim arising out of these Terms shall not exceed the amount paid by you for the service in the preceding three (3) months.
            </Text>
          }
        />

        <LegalSection 
          index={7} 
          title="Termination"
          content={
            <View>
              <Text style={styles.subTitle}>7.1 Termination by User</Text>
              <Text style={styles.bodyText}>You may terminate your account at any time. Upon termination, your data will be retained for 30 days before permanent deletion from our active servers.</Text>
              <Text style={styles.subTitle}>7.2 Termination by GUPIO</Text>
              <Text style={styles.bodyText}>We reserve the right to suspend or permanently terminate your account, without prior notice, for violations of these Terms, fraudulent activity, or non-payment of subscription fees (if applicable).</Text>
            </View>
          }
        />

        <LegalSection 
          index={8} 
          title="Governing Law"
          content={
            <Text style={styles.bodyText}>
              These Terms shall be governed by and construed in accordance with the laws of India. 
              Any disputes arising from these Terms shall be resolved through good-faith negotiation, and if unresolved, shall be subject to binding arbitration in Mysuru, Karnataka.
            </Text>
          }
        />

        <View style={styles.contactFooter}>
          <Text style={styles.footerHeading}>Legal Questions?</Text>
          <Text style={styles.footerSubText}>Our team is here to help you understand our agreement.</Text>
          
          <View style={styles.btnRow}>
            <TouchableOpacity 
              style={styles.contactBtn}
              onPress={() => Linking.openURL('mailto:legal@gupio.io')}
            >
              <Icon name="envelope" size={12} color="#5F9EA0" />
              <Text style={styles.contactBtnText}>Email Legal</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.contactBtn, styles.supportBtn]}
              onPress={() => navigation.navigate('HelpSupport')}
            >
              <Icon name="headset" size={12} color="#fff" />
              <Text style={[styles.contactBtnText, { color: '#fff' }]}>Support</Text>
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
  versionBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.2),
    borderRadius: wp(1),
    marginRight: wp(2),
    borderWidth: 1,
    borderColor: '#333',
  },
  versionBadgeText: { fontSize: wp(2.5), color: '#5F9EA0', fontFamily: 'Outfit-Bold' },
  headerSubtitle: { fontSize: wp(3), color: '#888', fontFamily: 'Outfit-Medium' },
  
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(5) },

  introCard: {
    backgroundColor: '#111',
    borderRadius: wp(4),
    padding: wp(4.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  introText: {
    fontSize: wp(3.5),
    color: '#aaa',
    lineHeight: wp(5),
    fontFamily: 'Outfit-Medium',
  },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: hp(1.5) },
  metaLabel: { fontSize: wp(3), color: '#666', fontFamily: 'Outfit-Regular' },
  metaValue: { color: '#888', fontFamily: 'Outfit-Bold' },

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
    backgroundColor: 'rgba(95, 158, 160, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160, 0.6)',
  },
  indexText: { color: '#5F9EA0', fontSize: wp(3.2), fontFamily: 'Outfit-Bold' },
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
    marginTop: hp(1.2),
    marginBottom: hp(0.5),
  },
  bulletRow: { flexDirection: 'row', marginBottom: hp(0.8), paddingRight: wp(5) },
  bullet: { color: '#5F9EA0', marginRight: wp(3), fontSize: wp(4) },
  bulletText: { flex: 1, fontSize: wp(3.6), color: '#bbb', fontFamily: 'Outfit-Regular' },

  contactFooter: {
    marginTop: hp(1),
    backgroundColor: '#111',
    borderRadius: wp(4),
    padding: wp(5),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160, 0.2)',
  },
  footerHeading: { fontSize: wp(4), color: '#fff', fontFamily: 'Outfit-Bold', marginBottom: hp(0.5) },
  footerSubText: { fontSize: wp(3), color: '#888', textAlign: 'center', marginBottom: hp(2) },
  btnRow: { flexDirection: 'row', gap: wp(4) },
  contactBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(95, 158, 160, 0.1)',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160, 0.4)',
    gap: wp(2),
  },
  supportBtn: {
    backgroundColor: '#4CAF50',
    borderColor: '#45a049',
  },
  contactBtnText: { color: '#5F9EA0', fontSize: wp(3.2), fontFamily: 'Outfit-Bold' },
});
