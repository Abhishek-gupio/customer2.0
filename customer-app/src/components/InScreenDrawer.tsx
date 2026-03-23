import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Pressable,
  BackHandler,
  Alert,
  useWindowDimensions,
  Platform,
  Easing,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import DrawerContent from './DrawerContent';
import ReusableModal from './ReusableModal';
import { getProfile } from '../services/authApi';
import { useAuth } from '../context/AuthContext';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

type InScreenDrawerProps = {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  setDrawerOpen?: (open: boolean) => void;
};

/* ----- Configuration ----- */
// Base percent width for drawer on phones
const BASE_DRAWER_PERCENT = 0.7; // 70%
const ANIM_DURATION = 500; // slower, smooth feel (ms)
const ANIM_CLOSE_MULTIPLIER = 0.85; // close slightly faster than open

const InScreenDrawer: React.FC<InScreenDrawerProps> = ({ open, onClose, setDrawerOpen }) => {
  /* ===== window / device + safe-area ===== */
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /* ===== detect tablet-ish devices ===== */
  const isTablet = useMemo(
    () =>
      windowWidth >= 768 ||
      Math.max(windowWidth, windowHeight) / Math.min(windowWidth, windowHeight) < 1.6,
    [windowWidth, windowHeight],
  );

  /* ===== drawer size (reacts to orientation) ===== */
  const effectivePercent = isTablet ? 0.5 : Math.min(0.85, BASE_DRAWER_PERCENT);
  const DRAWER_WIDTH = Math.round(windowWidth * effectivePercent);

  /* ===== animated values: translateX (drawer) and overlay opacity ===== */
  // Keep refs stable across renders
  const translateXRef = useRef<Animated.Value>(new Animated.Value(-DRAWER_WIDTH));
  const overlayOpacityRef = useRef<Animated.Value>(new Animated.Value(0));
  const translateX = translateXRef.current;
  const overlayOpacity = overlayOpacityRef.current;

  /* When drawer width changes (rotation), ensure translateX base value is consistent.
     If drawer is open -> keep at 0; if closed -> reset to -DRAWER_WIDTH.
     We also stop current animations before setting to avoid janky jumps.
  */
  useEffect(() => {
    // stop any running animations
    translateX.stopAnimation?.();
    overlayOpacity.stopAnimation?.();

    // Immediately position based on open state & new width
    translateX.setValue(open ? 0 : -DRAWER_WIDTH);
    overlayOpacity.setValue(open ? 1 : 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAWER_WIDTH]); // note: purposely exclude translateX/overlay refs from deps

  /* ===== navigation / auth / profile data ===== */
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
  const { signOut } = useAuth();

  const [displayName, setDisplayName] = useState<string>('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  /* ===== Android back handler when drawer open ===== */
  useEffect(() => {
    if (!open) return;
    const onBack = () => {
      onClose();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [open, onClose]);

  /* ===== prevent navigation while drawer open ===== */
  useEffect(() => {
    if (!open) return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (open) {
        e.preventDefault();
        onClose();
      }
    });
    return unsub;
  }, [open, onClose, navigation]);

  /* ===== animate open/close (smooth) ===== */
  useEffect(() => {
    // Stop previous animations before starting new ones (prevents queueing)
    translateX.stopAnimation?.();
    overlayOpacity.stopAnimation?.();

    const easingFn = Easing.out(Easing.cubic);
    const durationOpen = ANIM_DURATION;
    const durationClose = Math.round(ANIM_DURATION * ANIM_CLOSE_MULTIPLIER);

    const drawerAnim = Animated.timing(translateX, {
      toValue: open ? 0 : -DRAWER_WIDTH,
      duration: open ? durationOpen : durationClose,
      easing: easingFn,
      useNativeDriver: true,
    });

    const overlayAnim = Animated.timing(overlayOpacity, {
      toValue: open ? 1 : 0,
      duration: open ? durationOpen : durationClose,
      easing: easingFn,
      useNativeDriver: true,
    });

    // Run in parallel for cohesive motion
    const current = Animated.parallel([drawerAnim, overlayAnim]);

    // Start animation and return cleanup to stop if component unmounts during animation
    current.start();
    return () => current.stop();
  }, [open, DRAWER_WIDTH, translateX, overlayOpacity]);

  /* ===== load profile once drawer opens (cancellable) ===== */
  useEffect(() => {
    let mounted = true;
    if (!open) return;

    (async () => {
      setIsLoadingProfile(true);
      try {
        const prof = await getProfile();
        if (!mounted) return;
        setDisplayName(prof?.fullName ?? 'User');
        setAvatarUri(prof?.image ?? null);
      } catch {
        // silent
      } finally {
        if (mounted) setIsLoadingProfile(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [open]);

  /* ===== stable action handlers (memoized) ===== */
  const handleProfile = useCallback(() => {
    navigation.navigate('MyProfile' as never);
    setDrawerOpen?.(false);
  }, [navigation, setDrawerOpen]);

  const handleQrCode = useCallback(() => {
    navigation.navigate('QRCode' as never);
    setDrawerOpen?.(false);
  }, [navigation, setDrawerOpen]);

  const handleNotifications = useCallback(() => {
    navigation.navigate('Notification' as never);
    setDrawerOpen?.(false);
  }, [navigation,setDrawerOpen]);

  const handleHistory = useCallback(() => {
    navigation.navigate('History' as never);
    setDrawerOpen?.(false);
  }, [navigation, setDrawerOpen]);

  const handleMedia = useCallback(() => {
    navigation.navigate('Media' as never);
    setDrawerOpen?.(false);
  }, [navigation, setDrawerOpen]);

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLogoutErrorModal, setShowLogoutErrorModal] = useState(false);

  const handleHelp = useCallback(() => {
    setShowHelpModal(true);
  }, []);

  const handleLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
      setDrawerOpen?.(false);
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Wellcome' as never }],
      });
    } catch {
      setShowLogoutErrorModal(true);
    }
  }, [signOut, setDrawerOpen, navigation]);

  /* ===== animated style (memoized) ===== */
  const animatedStyle = useMemo(
    () => ({
      transform: [{ translateX }],
      width: DRAWER_WIDTH,
    }),
    [translateX, DRAWER_WIDTH],
  );

  /* ===== header band size (safe area aware) ===== */
  const headerBandHeight = Math.max(hp('18%'), insets.top + hp('12%'));

  /* ===== overlay color tuned per platform ===== */
  const overlayColor =
    Platform.OS === 'ios' ? 'rgba(0,0,0,0.30)' : 'rgba(0,0,0,0.22)';

  /* ===== render ===== */
  return (
    <>
      {/* Animated backdrop (fade) + tap-to-close */}
      <Animated.View
        pointerEvents={open ? 'auto' : 'none'}
        style={[
          styles.overlayAnimated,
          {
            opacity: overlayOpacity,
            backgroundColor: overlayColor,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close drawer overlay"
        />
      </Animated.View>

      {/* Drawer (animated) */}
      <Animated.View
        style={[
          styles.drawer,
          animatedStyle,
          isTablet ? styles.drawerTablet : null,
        ]}
        pointerEvents={open ? 'auto' : 'none'}
      >
        {/* Decorative header band */}
        <View
          style={[
            styles.headerBand,
            {
              height: headerBandHeight,
              borderBottomRightRadius: wp('6%'),
            },
          ]}
          pointerEvents="none"
        />

        <SafeAreaView style={[styles.safeArea, { paddingTop: 0 }]} edges={['top', 'bottom', 'left']}>
          <View style={styles.drawerContent}>
            <DrawerContent
              onClose={() => setDrawerOpen?.(false)}
              onProfile={handleProfile}
              onQrCode={handleQrCode}
              onNotifications={handleNotifications}
              onHistory={handleHistory}
              onMedia={handleMedia}
              onHelp={handleHelp}
              onLogout={handleLogout}
              name={displayName}
              avatarUri={avatarUri}
              isLoading={isLoadingProfile}
            />
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Help & Support Modal */}
      <ReusableModal
        visible={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="Help & Support"
        subtitle="Contact us at support@gupio.com"
        vectorIcon={{
          name: 'support-agent',
          size: wp(15),
          color: '#1F1B4E',
          library: 'MaterialIcons',
        }}
        buttonText="OK"
        onButtonPress={() => setShowHelpModal(false)}
      />

      {/* Logout Confirmation Modal */}
      <ReusableModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        title="Logout"
        subtitle="Are you sure you want to logout?"
        iconType="question"
        primaryButton={{
          text: 'LOGOUT',
          onPress: confirmLogout,
        }}
        secondaryButton={{
          text: 'CANCEL',
          onPress: () => setShowLogoutModal(false),
        }}
      />

      {/* Logout Error Modal */}
      <ReusableModal
        visible={showLogoutErrorModal}
        onClose={() => setShowLogoutErrorModal(false)}
        title="Error"
        subtitle="Failed to logout. Please try again."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowLogoutErrorModal(false)}
      />
    </>
  );
};

/* ===== styles ===== */
const styles = StyleSheet.create({
  overlayAnimated: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },

  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: wp('0.5%'), height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: wp('3%'),
    elevation: 12,
    borderTopRightRadius: wp('3%'),
    borderBottomRightRadius: wp('3%'),
    overflow: 'hidden',
  },

  drawerTablet: {
    borderTopRightRadius: wp('4%'),
    borderBottomRightRadius: wp('4%'),
    backgroundColor: 'rgba(255,255,255,0.98)',
  },

  headerBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },

  safeArea: {
    flex: 1,
    zIndex: 2,
  },

  drawerContent: {
    flex: 1,
    paddingVertical: hp('2.5%'),
    paddingHorizontal: wp('4%'),
  },
});

export default React.memo(InScreenDrawer);
