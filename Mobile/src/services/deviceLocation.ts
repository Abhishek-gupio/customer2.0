import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { googleMapsService } from './googleMapsService';

/**
 * Ensures location permission BEFORE any timed fix attempt.
 *
 * This has to happen up front because the OS permission dialog is not covered by the native
 * provider timeout — that only starts once permission is granted — so the dialog's duration is
 * charged entirely to our JS guard timer. A first-run user taking a few seconds to read and tap
 * "Allow" would blow the 6.5s guard, get a null fix, and fall through to the coarse and then
 * IP-based legs: exactly the imprecise emergency location this module exists to avoid.
 *
 * Returns false when permission is denied, so callers can fail loudly instead of silently
 * reporting a carrier-egress location as the user's position.
 */
async function ensureLocationPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
        const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const already = await PermissionsAndroid.check(fine);
        if (already) return true;
        const result = await PermissionsAndroid.request(fine);
        return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
        return false;
    }
}

/**
 * Where a fix came from, in descending order of trustworthiness. Callers that act on a location
 * (emergency alerts above all) should surface this rather than treating every fix as equal:
 * `network` is an IP-derived guess that can be tens of kilometres out on a mobile carrier.
 */
export type LocationSource = 'gps' | 'gps-coarse' | 'network';

export interface DeviceLocation {
    latitude: number;
    longitude: number;
    /** Radius in metres, when the provider reports one. */
    accuracy?: number;
    source: LocationSource;
}

/** A fix good enough to dispatch help to. Coarse/network fixes are explicitly not. */
export function isPreciseFix(fix: DeviceLocation | null): boolean {
    return !!fix && fix.source === 'gps' && (fix.accuracy == null || fix.accuracy <= 200);
}

function positionOnce(
    source: Extract<LocationSource, 'gps' | 'gps-coarse'>,
    options: { enableHighAccuracy: boolean; timeout: number; maximumAge: number },
): Promise<DeviceLocation | null> {
    return new Promise((resolve) => {
        let settled = false;
        const done = (value: DeviceLocation | null) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };
        // Belt-and-braces against a provider that neither succeeds nor errors: the native
        // `timeout` option is not honoured on every platform/provider combination, and this
        // sits on the SOS path where a hang is the worst possible outcome.
        const guard = setTimeout(() => done(null), options.timeout + 500);
        Geolocation.getCurrentPosition(
            (position: any) => {
                clearTimeout(guard);
                done({
                    latitude: position?.coords?.latitude,
                    longitude: position?.coords?.longitude,
                    accuracy: position?.coords?.accuracy,
                    source,
                });
            },
            () => {
                clearTimeout(guard);
                done(null);
            },
            options,
        );
    });
}

/**
 * Best available device location, degrading deliberately rather than hanging.
 *
 * Tries real GPS first (this is the whole point — the previous implementation called Google's
 * IP-geolocation endpoint with an empty body, which returns the carrier's egress location, not
 * the device's), then a coarse network-provider fix, then the IP lookup as a labelled last
 * resort. Every leg is time-bounded, so the total wait is capped and a caller on a
 * latency-sensitive path can never be blocked indefinitely.
 *
 * Returns `null` when nothing at all could be resolved — callers must handle that rather than
 * assume a fix is always available.
 */
export async function getDeviceLocation(opts?: {
    /** Skip the slower legs when the caller would rather have nothing than wait. */
    preciseOnly?: boolean;
}): Promise<DeviceLocation | null> {
    // Resolve permission first so the dialog's duration is never charged to the fix timers below.
    const permitted = await ensureLocationPermission();

    if (permitted) {
        const precise = await positionOnce('gps', {
            enableHighAccuracy: true,
            timeout: 6000,
            maximumAge: 15000,
        });
        if (precise?.latitude != null && precise?.longitude != null) return precise;

        const coarse = await positionOnce('gps-coarse', {
            enableHighAccuracy: false,
            timeout: 4000,
            maximumAge: 60000,
        });
        if (coarse?.latitude != null && coarse?.longitude != null) return coarse;
    }

    if (opts?.preciseOnly) return null;

    // Last resort. Raced against a deadline because the underlying axios call has no timeout.
    try {
        const network = await Promise.race([
            googleMapsService.getCurrentLocation(),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (network && (network as any).latitude != null) {
            return {
                latitude: (network as any).latitude,
                longitude: (network as any).longitude,
                accuracy: (network as any).accuracy,
                source: 'network',
            };
        }
    } catch {
        // fall through — no location available
    }
    return null;
}
