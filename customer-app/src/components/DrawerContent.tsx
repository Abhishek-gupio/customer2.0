// DrawerContent.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CircleAvatar from './CircleAvatar';
import DrawerItem from './DrawerItem';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

// local icons - keep requires at top-level, not inside render
const profileIcon = require('../assets/my_profile.png');
const helpIcon = require('../assets/question_mark.png');
const qrIcon = require('../assets/QRCode.png');
const signOutIcon = require('../assets/SignOut.png');
const bellIcon = require('../assets/Bell.png');
const historyIcon = require('../assets/history.png');
const mediaIcon = require('../assets/history.png'); // Using history icon as placeholder, can be replaced later

type Props = {
  onClose: () => void;
  onProfile: () => void;
  onHelp: () => void;
  onQrCode: () => void;
  onNotifications: () => void;
  onHistory: () => void;
  onMedia: () => void;
  onLogout: () => void;
  name?: string;
  avatarUri?: string | null;
  isLoading?: boolean;
};

const DrawerContent: React.FC<Props> = ({
  onProfile,
  onQrCode,
  onHelp,
  onNotifications,
  onHistory,
  onMedia,
  onLogout,
  name,
  avatarUri,
  isLoading,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  // Simple tablet detection — tune if needed
  const isTablet = useMemo(
    () => windowWidth >= 768 || Math.max(windowWidth, windowHeight) / Math.min(windowWidth, windowHeight) < 1.6,
    [windowWidth, windowHeight],
  );

  // >>> ADJUST THESE TWO VALUES to move content up/down:
  // topInsetReduction: how much we reduce the safe-area top padding (positive means reduce)
  // profilePullUp: negative value (in hp %) to pull profile slightly up visually (over header band)
  const topInsetReduction = isTablet ? hp('1.2%') : hp('1.8%'); // change this to increase/decrease upward shift
  const profilePullUp = isTablet ? -hp('1%') : -hp('1.8%'); // negative => move profile up

  // Avatar size: clamp between a min and max so it stays proportional across devices
  const avatarSize = isTablet ? wp('14%') : Math.max(wp('14%'), Math.min(wp('16%'), wp('18%')));

  // Name font scales a bit larger on tablets
  const nameFontSize = isTablet ? hp('3%') : hp('2.2%');

  // Compute top padding but reduce a bit so the whole block moves up
  const topPadding = Math.max(insets.top - topInsetReduction, hp('0.6%'));

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <View style={[styles.profileSection, { marginTop: profilePullUp }]}>
        <CircleAvatar
          source={avatarUri ? { uri: avatarUri } : undefined}
          size={avatarSize}
          placeholderText={isLoading ? '...' : name ? name.charAt(0).toUpperCase() : 'U'}
          placeholderBg="#000000"
        />

        <View style={styles.nameContainer}>
          <Text
            style={[styles.name, { fontSize: nameFontSize }]}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessible
            accessibilityLabel={name ?? 'User name'}
            allowFontScaling
          >
            {name || 'Dr.Yadhagiri'}
          </Text>
        </View>
      </View>

      <View style={styles.menuContainer}>
        <DrawerItem label="My Profile" icon={profileIcon} onPress={onProfile} showSeparator />
        <DrawerItem label="QR Scanner" icon={qrIcon} onPress={onQrCode} showSeparator />
        <DrawerItem label="Notifications" icon={bellIcon} onPress={onNotifications} showSeparator />
        {/* <DrawerItem label="Notifications" icon={bellIcon} onPress={navigateToNotification} showSeparator /> */}
        <DrawerItem label="History" icon={historyIcon} onPress={onHistory} showSeparator />
        <DrawerItem label="Media" icon={mediaIcon} onPress={onMedia} showSeparator />
        <DrawerItem label="Help & Support" icon={helpIcon} onPress={onHelp} showSeparator />
        <DrawerItem label="Logout" icon={signOutIcon} onPress={onLogout} isLogout showSeparator={false} />
      </View>
    </View>
  );
};

export default React.memo(DrawerContent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: hp('0.8%'), // keep vertical padding smaller; top padding handled via insets
    paddingHorizontal: wp('3.5%'),
    backgroundColor: 'transparent',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('1.6%'),
  },
  nameContainer: {
    marginLeft: wp('3.5%'),
    flex: 1,
    justifyContent: 'center',
  },
  name: {
    fontWeight: Platform.OS === 'ios' ? '700' : '800',
    color: '#000',
    includeFontPadding: false,
    lineHeight: undefined,
  },
  divider: {
    height: hp('0.12%'),
    backgroundColor: '#E0E0E0',
    width: '100%',
    marginBottom: hp('1.6%'),
  },
  menuContainer: {
    width: '100%',
    marginTop: hp('1%'),
  },
});

