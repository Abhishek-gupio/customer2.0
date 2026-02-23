/**
 * NotificationPermission – settings component for auto expense extraction.
 *
 * Shows permission status, toggle, and a button to open Android settings.
 * Use this inside a Settings screen or the Expenses tab.
 */
import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Platform,
    Switch,
    AppState,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

let RNAndroidNotificationListener: any = null;
if (Platform.OS === 'android') {
    try {
        RNAndroidNotificationListener =
            require('react-native-android-notification-listener').default;
    } catch { }
}

// MMKV-based toggle
import { getAutoExpenseEnabled, setAutoExpenseEnabled } from '../services/storage';

type PermissionStatus = 'authorized' | 'denied' | 'unknown';

export default function NotificationPermission() {
    const [status, setStatus] = useState<PermissionStatus>('unknown');
    const [enabled, setEnabled] = useState(getAutoExpenseEnabled);
    const pendingEnableRef = useRef(false);

    useEffect(() => {
        checkStatus();

        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkStatus();
            }
        });

        return () => {
            subscription.remove();
        };
    }, []);

    const checkStatus = async () => {
        if (!RNAndroidNotificationListener) {
            setStatus('unknown');
            return;
        }
        try {
            const result = await RNAndroidNotificationListener.getPermissionStatus();
            setStatus((prevStatus) => {
                // If user just came back from settings and permission is granted, enable it
                if (pendingEnableRef.current && result === 'authorized') {
                    setEnabled(true);
                    setAutoExpenseEnabled(true);
                    pendingEnableRef.current = false;
                }
                return result as PermissionStatus;
            });
        } catch {
            setStatus('unknown');
        }
    };

    const openSettings = () => {
        if (RNAndroidNotificationListener) {
            pendingEnableRef.current = true;
            RNAndroidNotificationListener.requestPermission();
        }
    };

    const handleToggle = (val: boolean) => {
        if (val && status !== 'authorized') {
            openSettings();
            return;
        }
        setEnabled(val);
        setAutoExpenseEnabled(val);
    };

    if (Platform.OS !== 'android') {
        return null; // Only available on Android
    }

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <View style={styles.iconWrap}>
                    <Ionicons name="notifications-outline" size={22} color="#4CAF50" />
                </View>
                <View style={styles.info}>
                    <Text style={styles.title}>Auto-detect expenses</Text>
                    <Text style={styles.subtitle}>
                        Automatically read bank & UPI notifications to log expenses
                    </Text>
                </View>
                <Switch
                    value={enabled && status === 'authorized'}
                    onValueChange={handleToggle}
                    trackColor={{ false: '#555', true: '#4CAF50' }}
                    thumbColor="#fff"
                />
            </View>

            {status !== 'authorized' && (
                <TouchableOpacity style={styles.permBtn} onPress={openSettings}>
                    <Ionicons name="settings-outline" size={16} color="#4CAF50" />
                    <Text style={styles.permText}>Grant notification access</Text>
                </TouchableOpacity>
            )}

            {status === 'authorized' && enabled && (
                <Text style={styles.activeText}>
                    ✅ Listening for bank notifications
                </Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(76,175,80,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    info: {
        flex: 1,
        marginRight: 8,
    },
    title: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    subtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    permBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        backgroundColor: 'rgba(76,175,80,0.1)',
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    permText: {
        color: '#4CAF50',
        fontSize: 13,
        fontWeight: '500',
        marginLeft: 6,
    },
    activeText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 10,
    },
});
