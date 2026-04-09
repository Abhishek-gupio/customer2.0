import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { io, Socket } from 'socket.io-client';
import { api } from '../../services/api';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { clearCachedValue, getCachedValue, getStaleCachedValue, setCachedValue } from '../../services/cache';

interface AppNotification {
    id: string;
    title: string;
    body: string;
    type: string;
    isRead: boolean;
    createdAt: string;
}

import { SOCKET_BASE_URL } from '../../config';

const SOCKET_URL = SOCKET_BASE_URL;
const NOTIFICATIONS_CACHE_KEY = 'cache:notifications:list';
const NOTIFICATIONS_CACHE_TTL_MS = 3 * 60 * 1000;

export const NotificationsScreen = () => {
    const { user } = useSelector((state: RootState) => state.auth);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);
    const sortedNotifications = useMemo(
        () => [...notifications].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        [notifications]
    );

    useEffect(() => {
        if (!user?.id) return;
        const cached = getStaleCachedValue<AppNotification[]>(NOTIFICATIONS_CACHE_KEY);
        if (cached) setNotifications(cached);

        // 1. Fetch historical inbox correctly mapped from Postgres REST API
        fetchNotifications();

        // 2. Connect to custom WebSocket for real-time Postgres inserts
        const socket: Socket = io(SOCKET_URL, {
            // Allow fallback to long-polling if websocket transport fails.
            // This avoids "reconnecting..." loops caused by websocket-only connectivity issues.
            transports: ['websocket', 'polling'],
            reconnectionAttempts: 10,
            reconnectionDelay: 2000,
            timeout: 20000,
        });

        socket.on('connect', () => {
            console.log("Connected to Real-time Notifications Socket");
            socket.emit('join', user.id);
        });

        socket.on('connect_error', (err: any) => {
            console.warn("Notifications socket connect_error:", err?.message || err);
        });

        socket.on('new_notification', (newNotif: AppNotification) => {
            setNotifications(prev => [newNotif, ...prev]);
        });

        return () => {
            socket.disconnect();
        };
    }, [user?.id]);

    const fetchNotifications = async () => {
        try {
            const response = await api.get<{ data: AppNotification[] }>('/v1/notifications');
            if (response?.data) {
                setNotifications(response.data);
                setCachedValue(NOTIFICATIONS_CACHE_KEY, response.data, NOTIFICATIONS_CACHE_TTL_MS);
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
            const cached = getCachedValue<AppNotification[]>(NOTIFICATIONS_CACHE_KEY) || getStaleCachedValue<AppNotification[]>(NOTIFICATIONS_CACHE_KEY);
            if (cached) setNotifications(cached);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = useCallback(async (id: string) => {
        try {
            await api.patch(`/v1/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
            clearCachedValue(NOTIFICATIONS_CACHE_KEY);
            setCachedValue(
              NOTIFICATIONS_CACHE_KEY,
              notifications.map(n => n.id === id ? { ...n, isRead: true } : n),
              NOTIFICATIONS_CACHE_TTL_MS,
            );
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    }, [notifications]);

    const renderItem = useCallback(({ item }: { item: AppNotification }) => (
        <TouchableOpacity
            style={[styles.notificationCard, !item.isRead && styles.unreadCard]}
            onPress={() => !item.isRead && markAsRead(item.id)}
            activeOpacity={0.8}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.title}>{item.title}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.body}>{item.body}</Text>
        </TouchableOpacity>
    ), [markAsRead]);

    if (!user?.id) {
        return (
            <View style={styles.center}>
                <Text>Please log in to view notifications.</Text>
            </View>
        );
    }

    if (loading && notifications.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#007bff" />
                    <Text style={styles.loadingText}>Loading notifications...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlashListAny
                data={sortedNotifications}
                keyExtractor={(item: any) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                estimatedItemSize={96}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={loading ? null : <Text style={styles.emptyText}>No notifications yet.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 16 },
    loadingText: { fontSize: 13, color: '#64748b', marginTop: 8 },
    notificationCard: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#3b82f6',
        backgroundColor: '#eff6ff'
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
        alignItems: 'center'
    },
    title: { fontWeight: '700', fontSize: 16, color: '#1e293b', flex: 1 },
    date: { fontSize: 12, color: '#64748b' },
    body: { fontSize: 14, color: '#475569', lineHeight: 20 },
    emptyText: { textAlign: 'center', color: '#64748b', marginTop: 40, fontSize: 16 }
});

export default NotificationsScreen;
