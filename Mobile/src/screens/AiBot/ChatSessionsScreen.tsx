import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { chatService, type ChatSession } from '../../services/chatService';
import BackButton from '../../components/BackButton';

export default function ChatSessionsScreen() {
    const navigation = useNavigation();
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(true);

    const loadSessions = useCallback(async () => {
        try {
            setLoading(true);
            const data = await chatService.listSessions();
            setSessions(data);
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const openSession = (session: ChatSession) => {
        (navigation as any).navigate('Main', {
            screen: 'AIAssistant',
            params: {
                userMessage: '',
                sessionId: session.id,
            },
        });
    };

    const startNewChat = () => {
        (navigation as any).navigate('Main', {
            screen: 'AIAssistant',
            params: {
                userMessage: '',
            },
        });
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const renderSession = ({ item }: { item: ChatSession }) => (
        <Pressable
            style={({ pressed }) => [styles.sessionCard, pressed && styles.sessionCardPressed]}
            onPress={() => openSession(item)}
        >
            <View style={styles.sessionIcon}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color="#9fb3ff" />
            </View>
            <View style={styles.sessionContent}>
                <Text style={styles.sessionTitle} numberOfLines={1}>
                    {item.title || 'New conversation'}
                </Text>
                <Text style={styles.sessionDate}>{formatDate(item.updatedAt)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#4a5568" />
        </Pressable>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Chat History</Text>
                <Pressable onPress={startNewChat} hitSlop={12}>
                    <Ionicons name="create-outline" size={22} color="#9fb3ff" />
                </Pressable>
            </View>

            {loading ? (
                <View style={styles.centerContainer}>
                    <ActivityIndicator color="#9fb3ff" size="large" />
                </View>
            ) : sessions.length === 0 ? (
                <View style={styles.centerContainer}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#1c2640" />
                    <Text style={styles.emptyTitle}>No conversations yet</Text>
                    <Text style={styles.emptyText}>Start a new chat with Gupio AI</Text>
                    <Pressable style={styles.newChatBtn} onPress={startNewChat}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.newChatBtnText}>New Chat</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.id}
                    renderItem={renderSession}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#050b17',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#111b2e',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    listContent: {
        padding: 16,
    },
    sessionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        backgroundColor: '#0d1a30',
        borderWidth: 1,
        borderColor: '#1c2640',
    },
    sessionCardPressed: {
        backgroundColor: '#111f38',
    },
    sessionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(159,179,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    sessionContent: {
        flex: 1,
    },
    sessionTitle: {
        color: '#e8edf5',
        fontSize: 15,
        fontWeight: '600',
    },
    sessionDate: {
        color: '#4a5568',
        fontSize: 12,
        marginTop: 3,
    },
    separator: {
        height: 8,
    },
    centerContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        color: '#7a8599',
        fontSize: 18,
        fontWeight: '700',
        marginTop: 16,
    },
    emptyText: {
        color: '#4a5568',
        fontSize: 14,
        marginTop: 6,
    },
    newChatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#3b6dd4',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24,
        marginTop: 24,
    },
    newChatBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
});
