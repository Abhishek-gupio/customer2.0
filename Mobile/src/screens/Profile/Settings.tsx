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
  Alert,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
// @ts-ignore pnpm symlink resolution
import { CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { logoutStorage } from '../../services/authService';

type SettingsNavProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

interface MenuItem {
  icon: string;
  label: string;
  route?: keyof RootStackParamList;
  onPress?: () => void;
}

export default function Settings() {
  const navigation = useNavigation<SettingsNavProp>();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logoutStorage();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Signin' }],
            })
          );
        },
      },
    ]);
  };

  const handleMenuPress = (item: MenuItem) => {
    if (item.route) {
      navigation.navigate(item.route as never);
    } else if (item.onPress) {
      item.onPress();
    }
  };

  const ACCOUNT_ITEMS: MenuItem[] = [
    { icon: 'user-alt', label: 'My Profile', route: 'MyProfile' },
    { icon: 'car', label: 'My Vehicles' },
    { icon: 'file-alt', label: 'Documents', route: 'DocumentList' },
    { icon: 'receipt', label: 'Expenses' },
  ];

  const SERVICES_ITEMS: MenuItem[] = [
    { icon: 'map-marker-alt', label: 'Valet History' },
    { icon: 'file-contract', label: 'RTO Services' },
    { icon: 'wallet', label: 'Set Budget', route: 'BudgetSettings' },
  ];

  const SETTINGS_ITEMS: MenuItem[] = [
    { icon: 'bell', label: 'Notifications' },
    { icon: 'shield-alt', label: 'Privacy & Security' },
    { icon: 'ellipsis-h', label: 'App Settings' },
  ];

  const SUPPORT_ITEMS: MenuItem[] = [
    { icon: 'question-circle', label: 'Help & Support', route: 'HelpSupport' },
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
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.85}
          >
            <Icon name="arrow-left" size={wp(4)} color="#FFBF00" />
          </TouchableOpacity>
          <Text style={styles.title}>More</Text>
        </View>

        <View style={styles.subtitleWrap}>
          <Text style={styles.subtitle}>Settings & Preferences</Text>
        </View>

        {/* ─── SOS Emergency ─── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sosCard}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('SOSButton')}
          >
            <View style={styles.sosIconWrap}>
              <Icon name="phone-alt" size={wp(5)} color="#000" />
            </View>
            <View style={styles.sosInfo}>
              <Text style={styles.sosTitle}>SOS Emergency</Text>
              <Text style={styles.sosSub}>24/7 Emergency assistance</Text>
            </View>
            <Icon name="chevron-right" size={wp(3.5)} color="#FFBF00" />
          </TouchableOpacity>
        </View>

        {/* ─── Account ─── */}
        <SectionGroup
          title="Account"
          items={ACCOUNT_ITEMS}
          onPress={handleMenuPress}
        />

        {/* ─── Services ─── */}
        <SectionGroup
          title="Services"
          items={SERVICES_ITEMS}
          onPress={handleMenuPress}
        />

        {/* ─── Settings ─── */}
        <SectionGroup
          title="Settings"
          items={SETTINGS_ITEMS}
          onPress={handleMenuPress}
        />

        {/* ─── Support ─── */}
        <SectionGroup
          title="Support"
          items={SUPPORT_ITEMS}
          onPress={handleMenuPress}
        />

        {/* ─── Logout ─── */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutBtn}
            activeOpacity={0.85}
            onPress={handleLogout}
          >
            <Icon name="sign-out-alt" size={wp(4.5)} color="#F44336" style={{ marginRight: wp(2.5) }} />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
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

/* ── Section Group Component ── */
function SectionGroup({
  title,
  items,
  onPress,
}: {
  title: string;
  items: MenuItem[];
  onPress: (item: MenuItem) => void;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.groupCard}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={i}
            style={[
              styles.menuRow,
              i < items.length - 1 && styles.menuRowBorder,
            ]}
            activeOpacity={0.85}
            onPress={() => onPress(item)}
          >
            <View style={styles.menuIconWrap}>
              <Icon name={item.icon} size={wp(4.2)} color="#aaa" />
            </View>
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Icon name="chevron-right" size={wp(3)} color="#555" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
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
    paddingBottom: hp(0.5),
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Title */
  title: {
    fontSize: wp(6.5),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    marginLeft: wp(3),
  },
  subtitleWrap: {
    paddingHorizontal: wp(5),
    paddingTop: hp(0.5),
    paddingBottom: hp(2),
  },
  subtitle: {
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.5)',
  },

  /* Section */
  section: {
    paddingHorizontal: wp(4),
    marginBottom: hp(1.5),
  },
  sectionTitle: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
    marginBottom: hp(1),
    paddingLeft: wp(1),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* SOS Card */
  sosCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
    borderRadius: wp(4),
    padding: wp(4.5),
    borderWidth: 1.2,
    borderColor: 'rgba(255, 191, 0, 0.3)',
  },
  sosIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  sosInfo: { flex: 1 },
  sosTitle: {
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
  },
  sosSub: {
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.6)',
    marginTop: hp(0.2),
  },

  /* Group Card */
  groupCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2.2),
    paddingHorizontal: wp(4.5),
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  menuLabel: {
    flex: 1,
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },

  /* Logout */
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#121212',
    borderRadius: wp(4),
    paddingVertical: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    color: '#F44336',
  },

  /* Footer */
  footer: {
    alignItems: 'center',
    paddingVertical: hp(2),
  },
  footerApp: {
    fontSize: wp(3.5),
    color: '#444',
    fontFamily: 'Outfit-Medium',
  },
  footerVersion: {
    fontSize: wp(3),
    color: '#333',
    fontFamily: 'Outfit-Regular',
    marginTop: hp(0.3),
  },
});
