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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import NotificationCard from '../../components/NotificationItem';
import { colors, COLORS } from '../../theme/colors';
import { fontSizes as FS, fontWeights as FW } from '../../theme/Fontsize';
import { api } from '../../services/api';
import { RootState } from '../../store';
import type { NotificationItem, NotificationType } from '../Main/notifiData';
import Modal from 'react-native-modal';
import { useNavigation } from '../../lib/react-navigation-native';
import { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import { RootStackParamList } from '../../navigation/types';

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
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [search, setSearch] = useState('');
  const [notificationsList, setNotificationsList] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLongPressModalVisible, setIsLongPressModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<NotificationItem | null>(null);


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

  const handleNotificationPress = (item: NotificationItem) => {
    // 1. Mark as read on backend
    api.patch(`/v1/notifications/${item.id}/read`).catch(() => {});
    
    // 2. Remove dot locally immediately
    setNotificationsList(prev => prev.map(n => n.id === item.id ? { ...n, unread: false } : n));

    // 3. Specialized Navigation
    const titleLower = item.title.toLowerCase();
    const descLower = item.description.toLowerCase();

    if (item.type === 'odometer' || titleLower.includes('odometer')) {
      navigation.navigate('Odometer');
    } else if (item.type === 'maintenance' || item.type === 'service' || descLower.includes('overdue')) {
      navigation.navigate('WarrantyStatus');
    } else if (item.type === 'expense' || titleLower.includes('spending') || titleLower.includes('expense')) {
      navigation.navigate('Expenses');
    }
  };

  const handleLongPress = (item: NotificationItem) => {
    setSelectedItem(item);
    setIsLongPressModalVisible(true);
  };

  const markAsUnread = (id: string) => {
    setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, unread: true } : n));
    setIsLongPressModalVisible(false);
  };

  const markAsRead = (id: string) => {
    api.patch(`/v1/notifications/${id}/read`).catch(() => {});
    setNotificationsList(prev => prev.map(n => n.id === id ? { ...n, unread: false } : n));
    setIsLongPressModalVisible(false);
  };

  const pinNotification = (id: string) => {
    // Simplified pin logic: move to top
    setNotificationsList(prev => {
      const item = prev.find(n => n.id === id);
      if (!item) return prev;
      return [item, ...prev.filter(n => n.id !== id)];
    });
    setIsLongPressModalVisible(false);
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
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Notifications</Text>
          <TouchableOpacity onPress={() => setIsMenuVisible(true)} style={styles.menuButton}>
            <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtitle}>Stay updated with your vehicle alerts</Text>
        
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.4)" />
          <TextInput
            placeholder="Search notification..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={search}
            onChangeText={setSearch}
            style={styles.searchBarText}
          />
        </View>
      </View>

      {/* Options Menu Modal */}
      <Modal
        isVisible={isMenuVisible}
        onBackdropPress={() => setIsMenuVisible(false)}
        onBackButtonPress={() => setIsMenuVisible(false)}
        backdropOpacity={0.5}
        animationIn="fadeInUp"
        animationOut="fadeOutDown"
        style={styles.modal}
      >
        <View style={styles.menuContent}>
          <TouchableOpacity style={styles.menuItem} onPress={() => setIsMenuVisible(false)}>
            <MaterialCommunityIcons name="checkbox-multiple-marked-outline" size={22} color="#fff" />
            <Text style={styles.menuItemText}>Select messages</Text>
          </TouchableOpacity>
          <View style={styles.menuDivider} />
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => setIsMenuVisible(false)}>
            <Ionicons name="trash-outline" size={22} color="#ff4444" />
            <Text style={[styles.menuItemText, { color: '#ff4444' }]}>Delete all</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Long Press Options Modal */}
      <Modal
        isVisible={isLongPressModalVisible}
        onBackdropPress={() => setIsLongPressModalVisible(false)}
        onBackButtonPress={() => setIsLongPressModalVisible(false)}
        backdropOpacity={0.5}
        animationIn="fadeInUp"
        animationOut="fadeOutDown"
        style={styles.modal}
      >
        <View style={styles.menuContent}>
          <Text style={styles.modalHeaderTitle}>{selectedItem?.title}</Text>
          <View style={[styles.menuDivider, { marginBottom: hp(1) }]} />
          
          <TouchableOpacity style={styles.menuItem} onPress={() => selectedItem && pinNotification(selectedItem.id)}>
            <Ionicons name="pin-outline" size={22} color="#fff" />
            <Text style={styles.menuItemText}>Pin to top</Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity 
            style={styles.menuItem} 
            onPress={() => selectedItem && (selectedItem.unread ? markAsRead(selectedItem.id) : markAsUnread(selectedItem.id))}
          >
            <MaterialCommunityIcons 
              name={selectedItem?.unread ? "email-open-outline" : "email-mark-as-unread"} 
              size={22} 
              color="#fff" 
            />
            <Text style={styles.menuItemText}>
              {selectedItem?.unread ? "Mark as read" : "Mark as unread"}
            </Text>
          </TouchableOpacity>
          
          <View style={styles.menuDivider} />
          
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={() => selectedItem && removeNotification(selectedItem.id).then(() => setIsLongPressModalVisible(false))}>
            <Ionicons name="trash-outline" size={22} color="#ff4444" />
            <Text style={[styles.menuItemText, { color: '#ff4444' }]}>Delete notification</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
              <NotificationCard 
                item={item} 
                onRemove={removeNotification} 
                onPress={() => handleNotificationPress(item)}
                onLongPress={() => handleLongPress(item)}
                onSwipeDelete={() => removeNotification(item.id)}
              />
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
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
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: wp(6),
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.5),
  },
  title: {
    fontSize: wp(7.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  menuButton: {
    padding: wp(2),
  },
  subtitle: {
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: hp(2.5),
  },
  searchBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: wp(3),
  },
  searchBarText: {
    fontSize: wp(3.8),
    color: '#fff',
    flex: 1,
    padding: 0,
    fontFamily: 'Outfit-Regular',
  },
  listWrapper: {
    flex: 1,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: wp(6),
  },
  emptyText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    marginTop: hp(4),
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
  },
  modal: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  menuContent: {
    backgroundColor: '#111',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: wp(6),
    paddingBottom: hp(4),
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2),
    gap: wp(4),
  },
  menuItemText: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-SemiBold',
    color: '#fff',
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  modalHeaderTitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
    marginBottom: hp(1.5),
    textAlign: 'center',
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
