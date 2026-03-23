import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { io, Socket } from 'socket.io-client';
import { api } from '../../services/api';

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

export const NotificationsScreen = () => {
    const { user } = useSelector((state: RootState) => state.auth);
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user?.id) return;

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
            }
        } catch (error) {
            console.error("Failed to fetch notifications:", error);
        } finally {
            setLoading(false);
        }
    };

    const markAsRead = async (id: string) => {
        try {
            await api.patch(`/v1/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (error) {
            console.error("Failed to mark as read:", error);
        }
    };

    const renderItem = ({ item }: { item: AppNotification }) => (
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
    );

    if (!user?.id) {
        return (
            <View style={styles.center}>
                <Text>Please log in to view notifications.</Text>
            </View>
        );
    }

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#007bff" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContainer}
                ListEmptyComponent={<Text style={styles.emptyText}>No notifications yet.</Text>}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f1f5f9' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    listContainer: { padding: 16 },
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
