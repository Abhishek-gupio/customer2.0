import React, { useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, ToastAndroid, Platform, Alert, Text } from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import { AddVehicleScreen } from './AddVehicleScreen';
import { DetailsScreen } from './DetailsScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'ADD' | 'DETAILS';

// ─── Component ────────────────────────────────────────────────────────────────

export default function GupioGarageApp() {
    // 1. Hooks (Must always be at top, never conditional)
    const route = useRoute();
    const navigation = useNavigation();

    const [screen, setScreen] = useState<Screen>('ADD');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [deletingVehicleId, setDeletingVehicleId] = useState<string | null>(null);
    const [settingPrimaryId, setSettingPrimaryId] = useState<string | null>(null);

    const fetchVehicles = useCallback(async () => {
        try {
            const data = await vehicleService.getVehicles();
            setVehicles(data);

            const primary = data.find(v => v.isPrimary) || data[0] || null;
            setActiveVehicle(primary);

            const routeName = route?.name;
            if (routeName === 'VehicleDetails' || (data.length > 0 && routeName !== 'AddVehicle')) {
                setScreen('DETAILS');
            } else {
                setScreen('ADD');
            }
        } catch (error) {
            console.error('[GupioGarageApp] fetchVehicles error:', error);
        } finally {
            setInitialLoading(false);
        }
    }, [route?.name]);

    useFocusEffect(
        useCallback(() => {
            fetchVehicles();
        }, [fetchVehicles])
    );

    const handleAddDone = useCallback(async (newVehicle: Vehicle) => {
        setVehicles(prev => [...prev, newVehicle]);
        setActiveVehicle(newVehicle);
        setScreen('DETAILS');

        if (Platform.OS === 'android') {
            ToastAndroid.show('Vehicle Added Successfully!', ToastAndroid.SHORT);
        }
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        if (deletingVehicleId || settingPrimaryId) return;
        try {
            setDeletingVehicleId(id);
            await vehicleService.deleteVehicle(id);
            const remaining = vehicles.filter(v => v.id !== id);
            setVehicles(remaining);

            if (remaining.length === 0) {
                setActiveVehicle(null);
                setScreen('ADD');
            } else {
                setActiveVehicle(remaining[0]);
                setScreen('DETAILS');
            }
        } catch (error) {
            console.error('[GupioGarageApp] deleteVehicle error:', error);
            Alert.alert('Error', 'Failed to delete vehicle.');
        } finally {
            setDeletingVehicleId(null);
        }
    }, [deletingVehicleId, settingPrimaryId, vehicles]);

    const handleSetPrimary = useCallback(async (id: string) => {
        if (settingPrimaryId || deletingVehicleId) return;
        try {
            setSettingPrimaryId(id);
            const updated = await vehicleService.setPrimaryVehicle(id);
            setVehicles(prev => prev.map(v => ({
                ...v,
                isPrimary: v.id === id
            })));
            setActiveVehicle(updated);
            if (Platform.OS === 'android') {
                ToastAndroid.show('Primary Vehicle Updated!', ToastAndroid.SHORT);
            }
        } catch (error) {
            console.error('[GupioGarageApp] setPrimaryVehicle error:', error);
            Alert.alert('Error', 'Failed to set primary vehicle.');
        } finally {
            setSettingPrimaryId(null);
        }
    }, [deletingVehicleId, settingPrimaryId]);

    // 2. Render
    let content: React.ReactNode = null;
    switch (screen) {
        case 'ADD':
            content = (
                <AddVehicleScreen
                    isFirst={vehicles.length === 0}
                    initialRegistrationNumber={(route.params as any)?.registrationNumber}
                    onBack={() => {
                        if (vehicles.length > 0) {
                            setScreen('DETAILS');
                        } else {
                            navigation.goBack();
                        }
                    }}
                    onDone={handleAddDone}
                />
            );
            break;

        case 'DETAILS':
            content = (
                <DetailsScreen
                    vehicles={vehicles}
                    activeVehicle={activeVehicle}
                    setActiveVehicle={setActiveVehicle}
                    initialTab={(route.params as any)?.initialTab}
                    onBack={() => {
                        navigation.goBack();
                    }}
                    onAddNew={() => setScreen('ADD')}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                    deletingVehicleId={deletingVehicleId}
                    settingPrimaryId={settingPrimaryId}
                />
            );
            break;

        default:
            content = null;
            break;
    }

    return (
        <View style={styles.screen}>
            {initialLoading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                    <Text style={styles.loadingText}>Syncing your garage...</Text>
                </View>
            ) : null}
            {content ?? (
                <View style={[styles.centered, styles.placeholder]}>
                    <Text style={styles.placeholderText}>Preparing your garage...</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    centered: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingContainer: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.background,
        zIndex: 10,
    },
    loadingText: {
        color: '#b5b5b5',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 8,
    },
    placeholder: {
        flex: 1,
    },
    placeholderText: {
        color: '#888',
        fontSize: 13,
    },
});
