import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, ToastAndroid, Platform, Alert } from 'react-native';
import { useRoute, useNavigation } from '../../lib/react-navigation-native';
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

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    const handleAddDone = useCallback(async (newVehicle: Vehicle) => {
        setVehicles(prev => [...prev, newVehicle]);
        setActiveVehicle(newVehicle);
        setScreen('DETAILS');

        if (Platform.OS === 'android') {
            ToastAndroid.show('Vehicle Added Successfully!', ToastAndroid.SHORT);
        }
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        try {
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
            Alert.alert('Error', 'Failed to delete vehicle.');
        }
    }, [vehicles]);

    const handleSetPrimary = useCallback(async (id: string) => {
        try {
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
            Alert.alert('Error', 'Failed to set primary vehicle.');
        }
    }, []);

    // 2. Early Return (Must be after all Hooks)
    if (initialLoading) {
        return (
            <View style={[styles.screen, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // 3. Render
    switch (screen) {
        case 'ADD':
            return (
                <AddVehicleScreen
                    isFirst={vehicles.length === 0}
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

        case 'DETAILS':
            return (
                <DetailsScreen
                    vehicles={vehicles}
                    activeVehicle={activeVehicle}
                    setActiveVehicle={setActiveVehicle}
                    onBack={() => {
                        navigation.goBack();
                    }}
                    onAddNew={() => setScreen('ADD')}
                    onDelete={handleDelete}
                    onSetPrimary={handleSetPrimary}
                />
            );

        default:
            return null;
    }
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
});
