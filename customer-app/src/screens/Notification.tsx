import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Platform,
  BackHandler,
  useWindowDimensions,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import WaveLayout from '../components/CommonUI';

import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { moderateScale } from 'react-native-size-matters';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import { getNotifications, NotificationItem as ApiNotificationItem } from '../services/notificationApi';

const appIcon = require('../assets/app-icon.png');
const sideArrow = require('../assets/CaretLeft.png');

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timeAgo: string;
  hasCheckmark: boolean;
}

type RootStackParamList = {
  Home: undefined;
  Notification: undefined;
  TrackVehicle: undefined;
};

const Notification: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('Home');
  if (error) return ErrorBoundaryUI;

  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { height: windowHeight } = useWindowDimensions();

  // tune cutoff for very small devices
  const isVerySmall = windowHeight <= 600;

  // tighten the back-button width so title and arrow are adjacent
  const BACK_BTN_WIDTH = isVerySmall ? wp('8%') : wp('10%');

  // *** ADJUSTED: make arrow slightly SMALLER on very small screens ***
  // previous small sizes were a bit large; reduced to avoid visual crowding
  const ARROW_W = isVerySmall ? Math.round(wp('5%')) : Math.round(wp('5.5%'));
  const ARROW_H = isVerySmall ? Math.round(hp('2.8%')) : Math.round(hp('3%'));

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper function to format time ago
  const formatTimeAgo = useCallback((date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins} ${diffMins === 1 ? 'min' : 'mins'} ago`;
    if (diffHours < 24) return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
  }, []);

  // Fetch notifications from backend
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      console.log('🔄 [Notification] Fetching notifications...');
      const apiNotifications = await getNotifications();
      console.log(`📬 [Notification] Received ${apiNotifications.length} notifications from API`);
      
      // Convert API notifications to UI format
      const formattedNotifications: NotificationItem[] = apiNotifications.map((notif) => ({
        id: notif.id,
        title: notif.title,
        body: notif.body,
        timeAgo: formatTimeAgo(new Date(notif.createdAt)),
        hasCheckmark: true,
      }));

      console.log(`✅ [Notification] Formatted ${formattedNotifications.length} notifications for display`);
      setNotifications(formattedNotifications);
    } catch (error) {
      console.error('❌ [Notification] Error fetching notifications:', error);
      // Don't clear notifications on error - keep existing ones if any
      // Only set empty if we don't have any notifications yet
      setNotifications((prev) => prev.length > 0 ? prev : []);
    } finally {
      setLoading(false);
    }
  }, [formatTimeAgo]);

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [fetchNotifications])
  );

  const waveSectionStyle =
    notifications.length === 0
      ? { minHeight: hp('42%') }
      : { minHeight: hp('25%') };

  const goBack = useCallback(() => {
    if (navigation.canGoBack && navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  // Android hardware back handler (keeps previous removal guards)
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        goBack();
        return true;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
          return;
        }
        if ((BackHandler as any).removeEventListener) {
          (BackHandler as any).removeEventListener(
            'hardwareBackPress',
            onBackPress,
          );
        }
      };
    }, [goBack]),
  );

  const renderNotificationItem = ({ item }: { item: NotificationItem }) => {
    return (
      <TouchableOpacity
        style={styles.notificationCard}
        onPress={() => console.log('Notification tapped:', item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <View style={styles.brandContainer}>
            <Image source={appIcon} style={styles.appIcon} />
            <Text style={styles.brandName}>Gupio Customer</Text>
          </View>
          <Text style={styles.timeAgo}>{item.timeAgo}</Text>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.cardTitle}>{item.title}</Text>
          {item.hasCheckmark && (
            <View style={styles.checkmarkCircle}>
              <Text style={styles.checkmark}>✓</Text>
            </View>
          )}
        </View>

        <Text style={styles.cardBody} numberOfLines={3}>
          {item.body}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyStateContainer}>
          <Text style={styles.emptySubtitle}>Loading notifications...</Text>
          <Text style={[styles.emptySubtitle, { marginTop: hp('1%'), fontSize: moderateScale(12), color: '#999' }]}>
            Checking for new notifications...
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyStateContainer}>
        <View style={styles.illustrationContainer}>
          <Image
            source={require('../assets/Push-notifications.png')}
            style={styles.emptyStateImage}
            resizeMode="contain"
          />
          <View style={styles.textContentContainer}>
            <Text style={styles.emptyTitle}>No Notification Found</Text>
            <Text style={styles.emptySubtitle}>
              There is no Notification to show right now!
            </Text>
            <Text style={[styles.emptySubtitle, { marginTop: hp('1%'), fontSize: moderateScale(12), color: '#999' }]}>
              Notifications will appear here when you receive updates about your vehicle.
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const header = useMemo(() => {
    return (
      <View
        style={[styles.header, { height: isVerySmall ? hp('7%') : hp('8%') }]}
      >
        {/* Back + Title inline with no big gap */}
        <Pressable
          onPress={goBack}
          style={[styles.backButton, { width: BACK_BTN_WIDTH }]}
          android_ripple={{ color: '#00000010', radius: 22 }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          {sideArrow ? (
            <Image
              source={sideArrow}
              style={{
                width: ARROW_W,
                height: ARROW_H,
                resizeMode: 'contain',
                tintColor: '#FFFFFF',
              }}
            />
          ) : (
            // fallback text arrow; slightly smaller on very small screens
            <Text
              style={[styles.backArrow, isVerySmall && styles.backArrowSmall]}
            >
              ‹
            </Text>
          )}
        </Pressable>

        {/* Title immediately after back button, minimal left margin */}
        <Text
          accessibilityRole="header"
          style={[
            styles.headerTitle,
            isVerySmall && styles.headerTitleSmall,
            { marginLeft: wp('1%') }, // minimal gap so not touching
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          Notifications
        </Text>

        {/* Keep invisible view of same width to preserve visual balance */}
        <View style={{ width: BACK_BTN_WIDTH }} />
      </View>
    );
  }, [BACK_BTN_WIDTH, ARROW_W, ARROW_H, goBack, isVerySmall]);

  return (
    <WaveLayout
      waveSectionStyle={waveSectionStyle}
      topContent={<View style={styles.topWrapper}>{header}</View>}
      topContainerStyle={styles.topContainer}
      topPlatformAdjust={
        Platform.OS === 'ios'
          ? { paddingTop: hp('0%') }
          : { paddingTop: hp('0%') }
      }
      bottomContent={
        <View style={styles.bottomContent}>
          {notifications.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={notifications}
              renderItem={renderNotificationItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={loading}
                  onRefresh={fetchNotifications}
                  colors={['#007AFF']}
                  tintColor="#007AFF"
                />
              }
            />
          )}
        </View>
      }
    />
  );
};

export default Notification;

const styles = StyleSheet.create({
  topWrapper: {
    alignItems: 'flex-start',
    width: '100%',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp('2%'),
    backgroundColor: 'transparent',
  },

  backButton: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingVertical: hp('0.4%'),
    paddingLeft: wp('1%'),
  },

  backArrow: {
    fontSize: hp('3%'),
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 0,
    includeFontPadding: false,
    lineHeight: Math.round(hp('3.6%')),
  },

  backArrowSmall: {
    fontSize: hp('3%'), // reduced text fallback on very small to match smaller icon
    lineHeight: Math.round(hp('3.6%')),
  },

  headerTitle: {
    flex: 0,
    textAlign: 'left',
    fontSize: hp('2.6%'),
    fontWeight: '700',
    color: '#FFFFFF',
    includeFontPadding: false,
  },

  headerTitleSmall: {
    fontSize: hp('2.2%'),
  },

  topContainer: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-start',
  },

  bottomContent: {
    flex: 1,
    paddingHorizontal: wp('4%'),
  },

  listContent: {
    paddingBottom: hp('2%'),
  },

  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(16),
    padding: wp('4%'),
    marginBottom: hp('2%'),

    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp('1%'),
  },

  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  appIcon: {
    width: wp('6%'),
    height: wp('6%'),
    borderRadius: moderateScale(5),
  },

  brandName: {
    fontSize: moderateScale(14),
    fontWeight: '600',
    color: '#1A1A1A',
    marginLeft: wp('2%'),
  },

  timeAgo: {
    fontSize: moderateScale(12),
    color: '#999',
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.5%'),
  },

  cardTitle: {
    fontSize: moderateScale(16),
    fontWeight: '700',
    color: '#1A1A1A',
    flexShrink: 1,
  },

  checkmarkCircle: {
    width: wp('5%'),
    height: wp('5%'),
    borderRadius: wp('3%'),
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: wp('2%'),
  },

  checkmark: {
    fontSize: moderateScale(12),
    color: '#fff',
    fontWeight: 'bold',
  },

  cardBody: {
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    color: '#666',
  },

  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: hp('-60%'),
    bottom: hp('0%'),
    left: wp('0%'),
    right: wp('0%'),
  },

  illustrationContainer: {
    width: '100%',
    alignItems: 'center',
  },

  emptyStateImage: {
    width: wp('80%'),
    height: wp('80%'),
  },

  textContentContainer: {
    marginTop: hp('2%'),
    alignItems: 'center',
    width: '100%',
  },

  emptyTitle: {
    fontSize: moderateScale(22),
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },

  emptySubtitle: {
    fontSize: moderateScale(15),
    color: '#999',
    textAlign: 'center',
    lineHeight: moderateScale(20),
  },
});
