import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useSelector } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Ionicons from 'react-native-vector-icons/Ionicons';
import NotificationCard from '../../components/NotificationItem';
import { colors, COLORS } from '../../theme/colors';
import { fontSizes as FS, fontWeights as FW } from '../../theme/Fontsize';
import { api } from '../../services/api';
import { RootState } from '../../store';
import type { NotificationItem, NotificationType } from '../Main/notifiData';

/** Backend returns { success: true, data: AppNotification[] }. Unwrap safely. */
function parseNotificationsResponse(response: unknown): AppNotification[] {
  if (!response || typeof response !== 'object') return [];
  const r = response as Record<string, unknown>;
  const raw = r.data ?? r.notifications ?? r;
  if (Array.isArray(raw)) return raw as AppNotification[];
  if (raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>).data)) {
    return ((raw as Record<string, unknown>).data as AppNotification[]);
  }
  return [];
}

interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const NOTIFICATION_TYPES: NotificationType[] = [
  'insurance',
  'service',
  'expense',
  'fuel',
  'alert',
  'maintenance',
  'parking',
  'odometer',
];

function formatTimeAgo(createdAt: string): string {
  const date = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function mapApiToNotificationItem(n: AppNotification): NotificationItem {
  const type: NotificationType = NOTIFICATION_TYPES.includes(n.type as NotificationType)
    ? (n.type as NotificationType)
    : 'alert';
  return {
    id: n.id,
    type,
    title: n.title,
    description: n.body,
    time: formatTimeAgo(n.createdAt),
    unread: !n.isRead,
  };
}

export default function Alerts() {
  const { user } = useSelector((state: RootState) => state.auth);
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (!isRefresh) setLoading(true);
    setFetchError(null);
    try {
      const response = await api.get<{ success?: boolean; data?: AppNotification[] }>('/v1/notifications');
      const rawList = parseNotificationsResponse(response);
      setNotificationsList(rawList.map(mapApiToNotificationItem));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load notifications';
      console.error('Failed to fetch notifications:', error);
      setFetchError(message);
      setNotificationsList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchNotifications();
  }, [user?.id, fetchNotifications]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications(true);
  }, [fetchNotifications]);

  const filteredNotifications = notificationsList.filter(
    (item) =>
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  );

  const removeNotification = async (id: string) => {
    try {
      await api.patch(`/v1/notifications/${id}/read`);
      setNotificationsList((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  if (!user?.id) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emptyText}>Please log in to view notifications.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notification</Text>
        <Text style={styles.subtitle}>Stay updated with alerts</Text>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={22} color="white" />
          <TextInput
            placeholder="Search notifications..."
            placeholderTextColor={colors.Secondary}
            value={search}
            onChangeText={setSearch}
            style={styles.searchBarText}
          />
        </View>
      </View>
      <View style={styles.listWrapper}>
        {loading && !refreshing ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.Primary} />
          </View>
        ) : fetchError ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>{fetchError}</Text>
            <Text style={[styles.emptyText, { marginTop: hp(1), fontSize: 12 }]}>
              Notifications are shown only for the logged-in user. Check that DB rows have customerId matching your account.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => fetchNotifications(false)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={filteredNotifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <NotificationCard item={item} onRemove={removeNotification} />
            )}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.Primary}
              />
            }
            ListEmptyComponent={
              <Text style={styles.emptyText}>No notifications yet.</Text>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.Background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    justifyContent: 'space-between',
    gap: hp(1),
    paddingHorizontal: wp(4.5),
  },
  title: {
    fontSize: FS.header,
    fontFamily: 'Outfit-Bold',
    color: colors.Primary,
  },
  subtitle: {
    fontSize: FS.subHeader,
    fontFamily: 'Outfit-Medium',
    color: colors.Secondary,
  },
  searchBar: {
    flexDirection: 'row',
    borderColor: colors.Border,
    borderRadius: wp(5),
    borderWidth: wp(0.1),
    paddingHorizontal: wp(5),
    paddingVertical: hp(0.8),
    alignItems: 'center',
    gap: wp(2),
  },
  searchBarText: {
    fontSize: wp(4.5),
    color: colors.Primary,
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: wp(4.5),
  },
  emptyText: {
    textAlign: 'center',
    color: colors.Secondary,
    marginTop: hp(4),
    fontSize: FS.subHeader,
    paddingHorizontal: wp(4),
  },
  retryButton: {
    marginTop: hp(2),
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(6),
    backgroundColor: colors.Primary,
    borderRadius: wp(3),
  },
  retryButtonText: {
    color: colors.Background,
    fontSize: FS.subHeader,
    fontFamily: 'Outfit-Bold',
  },
});
