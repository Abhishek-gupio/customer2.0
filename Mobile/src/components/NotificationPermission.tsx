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
    Alert,
    Linking,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

let RNAndroidNotificationListener: any = null;
if (Platform.OS === 'android') {
    try {
        RNAndroidNotificationListener =
            (require('react-native-android-notification-listener') as any).default;
    } catch { }
}

// MMKV-based toggle
import { getAutoExpenseEnabled, setAutoExpenseEnabled } from '../services/storage';

type PermissionStatus = 'authorized' | 'denied' | 'unknown';

export default function NotificationPermission() {
    const [status, setStatus] = useState<PermissionStatus>('unknown');
    const [enabled, setEnabled] = useState(true);
    const pendingEnableRef = useRef(false);

    useEffect(() => {
        setEnabled(getAutoExpenseEnabled());
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

    const checkStatus = async (): Promise<PermissionStatus> => {
        if (!RNAndroidNotificationListener) {
            setStatus('unknown');
            return 'unknown';
        }
        try {
            const result = await RNAndroidNotificationListener.getPermissionStatus();
            const nextStatus = result as PermissionStatus;
            setStatus(nextStatus);

            if (pendingEnableRef.current && nextStatus === 'authorized') {
                setEnabled(true);
                setAutoExpenseEnabled(true);
                pendingEnableRef.current = false;
            } else if (nextStatus !== 'authorized') {
                pendingEnableRef.current = false;
            }

            return nextStatus;
        } catch {
            setStatus('unknown');
            pendingEnableRef.current = false;
            return 'unknown';
        }
    };

    const openSettings = () => {
        if (RNAndroidNotificationListener) {
            pendingEnableRef.current = true;
            RNAndroidNotificationListener.requestPermission();
        }
    };

    const openAppDetailsSettings = async () => {
        try {
            await Linking.openSettings();
        } catch {
            // no-op
        }
    };

    const handleToggle = async (val: boolean) => {
        if (!val) {
            pendingEnableRef.current = false;
            setEnabled(false);
            setAutoExpenseEnabled(false);
            return;
        }

        const latestStatus = await checkStatus();

        if (latestStatus !== 'authorized') {
            // On many Android 13/14 devices, sideloaded APKs are blocked by "Restricted settings"
            // for high-risk permissions like Notification Access. We can't bypass it in code,
            // but we can guide the user to allow restricted settings from the app details page.
            Alert.alert(
                'Enable notification access',
                'If you see "Restricted settings / Access denied", open App info → (⋮) → Allow restricted settings, then enable Notification access.\n\nAfter enabling, come back here and toggle again.',
                [
                    { text: 'Open app settings', onPress: openAppDetailsSettings },
                    { text: 'Open notification access', onPress: openSettings },
                    { text: 'Cancel', style: 'cancel' },
                ],
            );
            return;
        }

        pendingEnableRef.current = false;
        setEnabled(true);
        setAutoExpenseEnabled(true);
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
                    value={enabled}
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
            {status !== 'authorized' && enabled && (
                <Text style={styles.activeText}>
                    Notification access is still required in settings.
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
