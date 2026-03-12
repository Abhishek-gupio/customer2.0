import React, { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet, ToastAndroid, Platform, Alert } from 'react-native';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import { AddVehicleScreen } from './sub-screens/AddVehicleScreen';
import { GarageListScreen } from './sub-screens/GarageListScreen';
import { DetailsScreen } from './sub-screens/DetailsScreen';

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = 'GARAGE' | 'ADD' | 'DETAILS';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Cross-platform toast utility.
 * Android has a native Toast; on iOS we fall back to a non-blocking Alert.
 */
const showToast = (message: string) => {
    if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
        Alert.alert('Notice', message);
    }
};

/**
 * Builds a lightweight optimistic Vehicle object so the UI can render
 * immediately while the real network request is in flight.
 * The `__optimistic` flag lets us identify and replace/remove it later.
 */
const buildOptimisticVehicle = (v: Vehicle): Vehicle => ({
    ...v,
    id: v.id ?? `optimistic_${Date.now()}`,   // temporary ID until backend responds
    __optimistic: true,                         // custom flag — see note below
});

// NOTE: If your Vehicle type doesn't include __optimistic, add it as an
// optional field:  __optimistic?: boolean;
// This keeps TypeScript happy without touching the backend contract.

// ─── Component ────────────────────────────────────────────────────────────────

export default function GupioGarageApp() {
    const [screen, setScreen] = useState<Screen>('GARAGE');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    // ── Boot: load vehicles from the backend once on mount ──────────────────
    useEffect(() => {
        fetchVehicles();
    }, []);

    /**
     * fetchVehicles — single source of truth for pulling the real list.
     * Only called on boot and after a successful delete confirmation.
     * NOT called after add (we use optimistic updates there).
     */
    const fetchVehicles = useCallback(async () => {
        try {
            const data = await vehicleService.getVehicles();
            setVehicles(data);

            // Preserve the active vehicle selection if it still exists in the
            // fresh list; otherwise default to the first item.
            setActiveVehicle(prev => {
                if (!prev) return data[0] ?? null;
                return data.find(v => v.id === prev.id) ?? data[0] ?? null;
            });
        } catch (error) {
            console.error('[GupioGarageApp] fetchVehicles error:', error);
            showToast('Could not load vehicles. Please try again.');
        } finally {
            setInitialLoading(false);
        }
    }, []);

    // ── ADD VEHICLE ──────────────────────────────────────────────────────────
    /**
     * handleAdd is called by AddVehicleScreen with the *already-saved* Vehicle
     * object returned by the backend (or a partially constructed object if the
     * screen handles its own save logic).
     *
     * Flow:
     *  1. Build an optimistic copy and inject it into state immediately → UI
     *     updates without any spinner.
     *  2. In the background, confirm the save succeeded (the vehicle object
     *     from AddVehicleScreen should already come from the backend response,
     *     so no extra network call is needed here).
     *  3. Replace the optimistic entry with the real one (which has the real
     *     DB id, timestamps, etc.).
     *  4. If anything goes wrong, roll back by removing the optimistic entry
     *     and showing an error toast.
     *
     * WHERE GEMINI FITS:
     *  Gemini (RTO plate lookup) must be called INSIDE AddVehicleScreen, right
     *  after the user types the plate number and taps "Lookup" — before the
     *  form is submitted. GupioGarageApp never calls Gemini directly; it only
     *  receives the enriched Vehicle payload that AddVehicleScreen has already
     *  assembled (plate + Gemini data merged together).
     *
     *  This keeps concerns separated:
     *    AddVehicleScreen  → owns "what data do we collect?" (including Gemini)
     *    GupioGarageApp    → owns "how do we show that data in state?"
     */
    const handleAdd = useCallback(async (incomingVehicle: Vehicle) => {
        const optimistic = buildOptimisticVehicle(incomingVehicle);

        // ── Step 1: Optimistic inject ──────────────────────────────────────
        setVehicles(prev => [...prev, optimistic]);
        setActiveVehicle(optimistic);
        setScreen('GARAGE');

        // ── Step 2 & 3: Reconcile with the real saved record ──────────────
        // If AddVehicleScreen already returned the confirmed backend vehicle
        // (recommended pattern), just replace the optimistic entry with it.
        try {
            // The real vehicle should have a proper backend-generated id.
            // If incomingVehicle.id is already a real id (not optimistic),
            // this swap is instant and invisible to the user.
            const confirmedVehicle: Vehicle = incomingVehicle.id && !incomingVehicle.__optimistic
                ? incomingVehicle
                : await vehicleService.addVehicle(incomingVehicle as any); // fallback save

            setVehicles(prev =>
                prev.map(v => v.id === optimistic.id ? confirmedVehicle : v)
            );
            setActiveVehicle(confirmedVehicle);

        } catch (error) {
            // ── Step 4: Rollback ───────────────────────────────────────────
            console.error('[GupioGarageApp] handleAdd confirmation failed:', error);

            setVehicles(prev => prev.filter(v => v.id !== optimistic.id));

            // Restore previous active vehicle if the rollback emptied the list
            setActiveVehicle(prev =>
                prev?.id === optimistic.id ? null : prev
            );

            showToast('Failed to save vehicle. Please try again.');

            // Navigate back to ADD so the user can retry without losing their input
            setScreen('ADD');
        }
    }, []);

    // ── DELETE VEHICLE ───────────────────────────────────────────────────────
    /**
     * handleDelete uses an optimistic-remove pattern:
     *  1. Remove from local state immediately.
     *  2. Call the backend.
     *  3. On failure, re-insert the vehicle and show a toast.
     *
     * We do NOT call fetchVehicles() after delete — that would cause a flash
     * and an unnecessary network round-trip for data we already have locally.
     */
    const handleDelete = useCallback(async (id: string) => {
        // ── Step 1: Snapshot + optimistic remove ──────────────────────────
        const snapshot = vehicles;                          // capture for rollback
        const removedVehicle = vehicles.find(v => v.id === id);

        setVehicles(prev => prev.filter(v => v.id !== id));

        if (activeVehicle?.id === id) {
            const remaining = vehicles.filter(v => v.id !== id);
            setActiveVehicle(remaining[0] ?? null);
            setScreen('GARAGE');
        }

        // ── Step 2: Backend call ───────────────────────────────────────────
        try {
            await vehicleService.deleteVehicle(id);
        } catch (error) {
            // ── Step 3: Rollback ───────────────────────────────────────────
            console.error('[GupioGarageApp] handleDelete failed:', error);
            setVehicles(snapshot);                          // restore full list
            if (removedVehicle) setActiveVehicle(removedVehicle);
            showToast('Could not delete vehicle. Please try again.');
        }
    }, [vehicles, activeVehicle]);

    // ── RENDER ───────────────────────────────────────────────────────────────

    if (initialLoading) {
        return (
            <View style={[styles.screen, styles.centered]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // First-time user: no vehicles yet → show onboarding
    if (vehicles.length === 0 && screen === 'GARAGE') {
        return <AddVehicleScreen isFirst={true} onDone={handleAdd} />;
    }

    switch (screen) {
        case 'GARAGE':
            return (
                <GarageListScreen
                    vehicles={vehicles}
                    onAdd={() => setScreen('ADD')}
                    onSelect={(v: Vehicle) => {
                        setActiveVehicle(v);
                        setScreen('DETAILS');
                    }}
                    onDelete={handleDelete}
                />
            );

        case 'ADD':
            return (
                <AddVehicleScreen
                    onBack={() => setScreen('GARAGE')}
                    onDone={handleAdd}
                // AddVehicleScreen owns the Gemini lookup internally.
                // It should call vehicleService.fetchVehicleData(plate)
                // when the user taps "Lookup", then pass the enriched
                // Vehicle object to onDone() after the user confirms.
                />
            );

        case 'DETAILS':
            return (
                <DetailsScreen
                    vehicles={vehicles}
                    activeVehicle={activeVehicle}
                    setActiveVehicle={setActiveVehicle}
                    onBack={() => setScreen('GARAGE')}
                    onAddNew={() => setScreen('ADD')}
                    onDelete={handleDelete}
                />
            );

        default:
            return null;
    }
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
