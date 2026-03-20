import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Platform, Alert, StatusBar, PermissionsAndroid, Modal } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Tts from 'react-native-tts';
import { telematicsApi } from '../../api/telematics';
import { vehicleService } from '../../services/vehicleService';
import { AssistanceDrawer } from '../../components/common/AssistanceDrawer';
import { getUserId, getTelematicsLinked, setTelematicsLinked } from '../../services/storage';
import BackButton from '../../components/BackButton';
import { damoovTelematics } from '../../native/damoovTelematics';

// Damoov admin trip sync expects `Identifiers.InstanceIds[0]` to be GUID-like.
// Until the native SDK provides the true SDK InstanceID to JS, we generate a GUID-like placeholder.
const uuidV4 = (): string =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });

const Geolocation: any = (() => {
    try {
        const geoModule = require('@react-native-community/geolocation') as any;
        return geoModule?.default ?? geoModule;
    } catch {
        const nav = (globalThis as any)?.navigator;
        return nav?.geolocation ?? null;
    }
})();

export default function DrivingSummary({ navigation }: any) {
    const [score, setScore] = useState<number | null>(null);
    const [metrics, setMetrics] = useState({ distance: '0', duration: '0h 0m', harshBraking: '0', hardAccel: '0' });
    const [latestTrip, setLatestTrip] = useState<any | null>(null);
    const [latestPath, setLatestPath] = useState<any[]>([]);
    const [latestPathLoading, setLatestPathLoading] = useState(false);
    const [latestMapReady, setLatestMapReady] = useState(false);
    const [latestMapFullscreen, setLatestMapFullscreen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isCoachActive, setIsCoachActive] = useState(false);
    const [currentSpeed, setCurrentSpeed] = useState<number>(0);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number, lon: number } | null>(null);
    const [isAssistanceDrawerOpen, setIsAssistanceDrawerOpen] = useState(false);
    const [primaryVehicle, setPrimaryVehicle] = useState<{ id: string; registrationNumber?: string } | null>(null);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkDone, setLinkDone] = useState(false);

    const coachIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const locationWatchId = useRef<number | null>(null);
    const currentSpeedRef = useRef(0);
    const currentLocationRef = useRef<{ lat: number, lon: number } | null>(null);
    const latestMapRef = useRef<MapView>(null);

    useEffect(() => {
        currentSpeedRef.current = currentSpeed;
        currentLocationRef.current = currentLocation;
    }, [currentSpeed, currentLocation]);

    useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                // 1. Trigger fresh sync from Damoov
                try {
                    await telematicsApi.syncTrips();
                } catch (e) {
                    console.log('Skipping auto-sync (likely logged out or rate limited)', e);
                }

                // 2. Get user's primary vehicle
                const res = await vehicleService.getVehicles();
                let vehiclesData: any[] = [];
                if (Array.isArray(res)) vehiclesData = res;
                else if (res && (res as any).data && Array.isArray((res as any).data)) vehiclesData = (res as any).data;

                if (vehiclesData.length === 0) return;
                const primary = vehiclesData.find((v: any) => v.isPrimary) || vehiclesData[0];
                setPrimaryVehicle(primary);

                // 2. For this vehicle, check stored link flag and fetch trips
                if (primary?.id) {
                    const storedLinked = getTelematicsLinked(primary.id);
                    if (storedLinked) {
                        setLinkDone(true);
                    }

                    const tripsRes = await telematicsApi.getTrips(primary.id);
                    // API returns { success: true, data: { data: trips[], pagination } }
                    const tripsArray = Array.isArray(tripsRes?.data?.data) ? tripsRes.data.data : (Array.isArray(tripsRes?.data) ? tripsRes.data : []);

                    if (tripsArray.length > 0) {
                        // Show latest trip only on this screen.
                        const latest = tripsArray[0];
                        setLatestTrip(latest);

                        const latestDistanceKm = Number(latest?.distanceKm ?? 0) || 0;
                        const latestDurationMin = Number(latest?.durationMin ?? 0) || 0;
                        const latestScore = latest?.safetyScore != null ? Number(latest.safetyScore) : null;

                        // Accurate Damoov counts from Statistics.
                        const latestStats = latest?.damoovStatistics || {};
                        const harshBrakingCountFromStats =
                            latestStats?.BrakingsCount != null ? Number(latestStats.BrakingsCount) : null;
                        const hardAccelCountFromStats =
                            latestStats?.AccelerationsCount != null ? Number(latestStats.AccelerationsCount) : null;

                        // Fallback: count from stored events if Damoov stats are missing.
                        const latestEvents: any[] = Array.isArray(latest?.events) ? latest.events : [];
                        const harshBrakingCountFromEvents =
                            latestEvents.filter((e: any) => /brak|brake/i.test(String(e?.eventType ?? ""))).length;
                        const hardAccelCountFromEvents =
                            latestEvents.filter((e: any) => /accel|acceleration/i.test(String(e?.eventType ?? ""))).length;

                        const harshBrakingCount =
                            harshBrakingCountFromStats != null ? harshBrakingCountFromStats : harshBrakingCountFromEvents;
                        const hardAccelCount =
                            hardAccelCountFromStats != null ? hardAccelCountFromStats : hardAccelCountFromEvents;

                        const hours = Math.floor(latestDurationMin / 60);
                        const minutes = Math.floor(latestDurationMin % 60);

                        setScore(latestScore != null ? Math.round(latestScore) : null);
                        setMetrics({
                            distance: Math.round(latestDistanceKm).toString(),
                            duration: `${hours}h ${minutes}m`,
                            // Keep for backward compatibility with existing grid styles
                            harshBraking: harshBrakingCount.toString(),
                            hardAccel: hardAccelCount.toString(),
                        });

                        // Mark device as linked if this vehicle already has trips
                        setTelematicsLinked(primary.id, true);
                        setLinkDone(true);
                    } else {
                        setScore(null);
                        setLatestTrip(null);
                        setMetrics({
                            distance: '0',
                            duration: '0h 0m',
                            harshBraking: '0',
                            hardAccel: '0'
                        });
                    }
                }
            } catch (error) {
                console.error("Failed to load telematics:", error);
                setScore(null);
                setMetrics({ distance: '0', duration: '0h 0m', harshBraking: '0', hardAccel: '0' });
            } finally {
                setLoading(false);
            }
        };
        fetchTelemetry();
    }, []);

    // Load GPS path for the latest trip so we can show a map here too.
    useEffect(() => {
        const loadLatestPath = async () => {
            if (!latestTrip?.id) {
                setLatestPath([]);
                return;
            }
            try {
                setLatestPathLoading(true);
                setLatestMapReady(false);
                const path = await telematicsApi.getTripPath(String(latestTrip.id));
                const validPath = Array.isArray(path)
                    ? path.filter((p: any) => p && !isNaN(Number(p.lat)) && !isNaN(Number(p.lon)))
                    : [];
                setLatestPath(validPath);
            } catch (e) {
                console.error('DrivingSummary latestPath error', e);
                setLatestPath([]);
            } finally {
                setLatestPathLoading(false);
            }
        };
        loadLatestPath();
    }, [latestTrip?.id]);

    useEffect(() => {
        if (!latestPathLoading && latestPath.length > 0 && latestMapRef.current && latestMapReady) {
            try {
                const first = latestPath[0];
                latestMapRef.current.animateToRegion(
                    {
                        latitude: Number(first.lat),
                        longitude: Number(first.lon),
                        latitudeDelta: 0.05,
                        longitudeDelta: 0.05,
                    },
                    800,
                );
            } catch {
                // ignore map animate errors
            }
        }
    }, [latestPath, latestMapReady, latestPathLoading]);

    // Initialize TTS
    useEffect(() => {
        Tts.getInitStatus().then(() => {
            Tts.setDefaultRate(0.5);
            Tts.setDefaultPitch(1.0);
        }).catch((err) => {
            if (err.code === 'no_engine') {
                Tts.requestInstallEngine();
            }
        });

        return () => {
            if (coachIntervalRef.current) clearInterval(coachIntervalRef.current);
            Tts.stop();
        };
    }, []);

    // Manage Geolocation when Coach is active
    useEffect(() => {
        if (isCoachActive) {
            if (!Geolocation) {
                Alert.alert(
                    'Location unavailable',
                    'Location module is not available in this build. Rebuild the app with geolocation linked or use a dev client.',
                );
                setIsCoachActive(false);
                setCurrentSpeed(0);
                setCurrentLocation(null);
                return;
            }
            locationWatchId.current = Geolocation.watchPosition(
                (position) => {
                    const speedInMps = position.coords.speed || 0;
                    const speedInKmph = Math.max(0, speedInMps * 3.6);
                    setCurrentSpeed(Math.round(speedInKmph));
                    setCurrentLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
                },
                (error) => console.log('Geolocation error:', error),
                { enableHighAccuracy: true, distanceFilter: 5, interval: 2000, fastestInterval: 1000 }
            );
        } else {
            if (locationWatchId.current !== null) {
                Geolocation?.clearWatch(locationWatchId.current);
                locationWatchId.current = null;
            }
            setCurrentSpeed(0);
            setCurrentLocation(null);
        }
        return () => {
            if (locationWatchId.current !== null) {
                Geolocation?.clearWatch(locationWatchId.current);
            }
        };
    }, [isCoachActive]);

    // Manage Coach Polling
    useEffect(() => {
        const fetchAdvice = async (simulatedEvent: any = null) => {
            try {
                const events = simulatedEvent ? [simulatedEvent] : [];
                // Real context from GPS
                const context = {
                    currentSpeed: simulatedEvent ? simulatedEvent.speed : currentSpeedRef.current,
                    lat: currentLocationRef.current?.lat,
                    lon: currentLocationRef.current?.lon,
                    // Backend weather service uses lat/lon to auto-fetch weather
                };

                const advice = await telematicsApi.getAiCoachAdvice(events, context);
                Tts.stop();
                Tts.speak(advice);
            } catch (err) {
                console.error("Failed to get AI coach advice", err);
            }
        };

        if (isCoachActive) {
            // Fetch baseline encouraging advice on start
            fetchAdvice();
            // Then poll every 30 seconds
            coachIntervalRef.current = setInterval(() => {
                fetchAdvice();
            }, 30000);
        } else {
            if (coachIntervalRef.current) {
                clearInterval(coachIntervalRef.current);
                coachIntervalRef.current = null;
            }
            Tts.stop();
        }

        return () => {
            if (coachIntervalRef.current) clearInterval(coachIntervalRef.current);
        };
    }, [isCoachActive]);

    const handleSimulateHarshBrake = () => {
        if (!isCoachActive) return;
        const simulatedEvent = {
            eventType: "HARSH_BRAKING",
            severity: 8.5,
            speed: currentSpeedRef.current > 0 ? currentSpeedRef.current : 85,
            timestamp: new Date().toISOString()
        };
        // Trigger immediate fetch with event
        const fetchAdvice = async () => {
            const context = {
                currentSpeed: simulatedEvent.speed,
                lat: currentLocationRef.current?.lat,
                lon: currentLocationRef.current?.lon
            };
            const advice = await telematicsApi.getAiCoachAdvice([simulatedEvent], context);
            Tts.stop();
            Tts.speak(advice);
        };
        fetchAdvice();
    };

    const requestTelematicsPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            const perms = [
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ];
            const apiLevel = (Platform as any).Version;
            if (apiLevel >= 29 && PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION) {
                perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
            }
            const result = await PermissionsAndroid.requestMultiple(perms);
            const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
            return fine === PermissionsAndroid.RESULTS.GRANTED;
        } catch {
            return false;
        }
    };

    const handleLinkDevice = async () => {
        if (!primaryVehicle?.id) return;
        const userId = getUserId() || 'user';
        setLinkLoading(true);
        try {
            if (Platform.OS === 'android' && damoovTelematics.isAvailable()) {
                const granted = await requestTelematicsPermissions();
                if (!granted) {
                    Alert.alert('Permissions needed', 'Location permission is required to record trips. Please allow it in Settings and try again.', [{ text: 'OK' }]);
                    return;
                }
            }
            const deviceToken = await telematicsApi.registerUser(userId);
            if (!deviceToken) throw new Error('No DeviceToken from server');
            const instanceId = uuidV4();
            await telematicsApi.linkDevice(
                primaryVehicle.id,
                instanceId,
                deviceToken,
                Platform.OS as 'ios' | 'android',
            );
            if (damoovTelematics.isAvailable()) {
                await damoovTelematics.setDeviceId(deviceToken);
                await damoovTelematics.setEnabled(true);
            }
            setTelematicsLinked(primaryVehicle.id, true);
            setLinkDone(true);
            Alert.alert(
                'Device linked',
                damoovTelematics.isAvailable()
                    ? 'Trip tracking is on. Your drives will be recorded and appear here after sync.'
                    : 'This phone is now linked for driving trips. Your trips will appear here after you drive.',
                [{ text: 'OK' }],
            );
        } catch (e: any) {
            const msg = e?.response?.data?.message || e?.message || 'Link failed';
            Alert.alert('Link failed', msg);
        } finally {
            setLinkLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined} />
            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Driving Behavior</Text>
                <TouchableOpacity
                    style={styles.timelineButton}
                    onPress={() => navigation.navigate('DrivingTimeline')}
                >
                    <Text style={styles.timelineButtonText}>Timeline</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>

                {/* Overall Score */}
                <View style={styles.scoreCard}>
                    <Text style={styles.scoreTitle}>Overall Safety Score</Text>
                    <View style={styles.scoreCircle}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#4ade80" />
                        ) : score !== null ? (
                            <>
                                <Text style={styles.scoreNumber}>{score}</Text>
                                <Text style={styles.scoreUnit}>/ 100</Text>
                            </>
                        ) : (
                            <Text style={styles.scoreNumber}>—</Text>
                        )}
                    </View>
                    <Text style={styles.scoreSubtitle}>
                        {loading ? 'Loading...' : score !== null ? 'Good driving, keep it up!' : 'Complete a trip to see your score'}
                    </Text>
                </View>

                {/* Link this phone for real trip tracking */}
                {primaryVehicle && (
                    <View style={[styles.scoreCard, { marginTop: 0, paddingVertical: hp(1.5) }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: hp(1) }}>
                            <Icon name="mobile-alt" size={wp(5)} color="#4ade80" style={{ marginRight: wp(2) }} />
                            <Text style={{ color: '#fff', fontSize: wp(4), fontWeight: '600' }}>
                                {linkDone ? 'Device linked' : 'Track trips on this phone'}
                            </Text>
                        </View>
                        <Text style={{ color: '#aaa', fontSize: wp(3.2), marginBottom: hp(1.5) }}>
                            {linkDone
                                ? 'Trips will appear here when you drive (with Damoov SDK).'
                                : `Link this phone to "${primaryVehicle.registrationNumber || 'your vehicle'}" so trips are recorded.`}
                        </Text>
                        {!linkDone && (
                            <TouchableOpacity
                                style={[styles.simulateButton, { alignSelf: 'flex-start' }]}
                                onPress={handleLinkDevice}
                                disabled={linkLoading}
                            >
                                {linkLoading ? (
                                    <ActivityIndicator size="small" color="#0a0a0a" />
                                ) : (
                                    <Text style={styles.simulateButtonText}>
                                        <Icon name="link" /> Link this device
                                    </Text>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* AI Coach Toggle */}
                <View style={[styles.scoreCard, { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: hp(2), marginTop: 0 }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Icon name="robot" size={wp(6)} color="#4ade80" style={{ marginRight: wp(3) }} />
                        <View>
                            <Text style={{ color: '#fff', fontSize: wp(4.5), fontWeight: '600' }}>Live AI Coach</Text>
                            <Text style={{ color: '#aaa', fontSize: wp(3.5), marginTop: 2 }}>Real-time voice safety tips</Text>
                        </View>
                    </View>
                    <Switch
                        value={isCoachActive}
                        onValueChange={setIsCoachActive}
                        trackColor={{ false: '#333', true: '#4ade80' }}
                        thumbColor={isCoachActive ? '#fff' : '#888'}
                    />
                </View>

                {/* Live Drive Overlay (Visible when Coach Active) */}
                {isCoachActive && (
                    <View style={styles.liveDriveContainer}>
                        <View style={styles.liveDriveHeader}>
                            <View style={styles.recordingBadge}>
                                <View style={styles.recordingDot} />
                                <Text style={styles.recordingText}>LIVE COACHING</Text>
                            </View>
                        </View>

                        <View style={styles.speedometerContainer}>
                            <Text style={styles.speedText}>{currentSpeed}</Text>
                            <Text style={styles.speedUnit}>km/h</Text>
                        </View>

                        {currentLocation ? (
                            <Text style={styles.locationText}>
                                GPS Active: {currentLocation.lat.toFixed(4)}, {currentLocation.lon.toFixed(4)}
                            </Text>
                        ) : (
                            <Text style={styles.locationText}>Acquiring GPS...</Text>
                        )}

                        <TouchableOpacity
                            style={[styles.simulateButton, { marginTop: hp(2) }]}
                            onPress={handleSimulateHarshBrake}
                        >
                            <Text style={styles.simulateButtonText}>
                                <Icon name="exclamation-triangle" /> Simulate Harsh Brake
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Earlier Summary Grid (harsh breaking, hard accel, distance, drive time) */}
                {!isCoachActive && (
                    <View style={styles.grid}>
                        <View style={styles.gridItem}>
                            <Icon name="tachometer-alt" size={wp(6)} color="#FFBF00" />
                            <Text style={styles.gridValue}>{loading ? '-' : metrics.harshBraking}</Text>
                            <Text style={styles.gridLabel}>Harsh Breaking</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Icon name="bolt" size={wp(6)} color="#FFBF00" />
                            <Text style={styles.gridValue}>{loading ? '-' : metrics.hardAccel}</Text>
                            <Text style={styles.gridLabel}>Hard Acceleration</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Icon name="route" size={wp(6)} color="#4ade80" />
                            <Text style={styles.gridValue}>{loading ? '-' : `${metrics.distance} km`}</Text>
                            <Text style={styles.gridLabel}>Distance</Text>
                        </View>
                        <View style={styles.gridItem}>
                            <Icon name="clock" size={wp(6)} color="#4ade80" />
                            <Text style={styles.gridValue}>{loading ? '-' : metrics.duration}</Text>
                            <Text style={styles.gridLabel}>Drive Time</Text>
                        </View>
                    </View>
                )}

                {/* Latest Trip Details */}
                {!isCoachActive && (
                    <View style={styles.latestCard}>
                        {latestTrip ? (
                            <>
                                <Text style={styles.latestTitle}>Latest trip</Text>

                                <View style={styles.latestMapContainer}>
                                    {latestTrip?.id ? (
                                        <TouchableOpacity
                                            style={styles.latestMapExpandButton}
                                        onPress={() => setLatestMapFullscreen(true)}
                                        >
                                            <Icon name="expand-arrows-alt" size={wp(4)} color="#fff" />
                                            <Text style={styles.latestMapExpandText}>Full screen</Text>
                                        </TouchableOpacity>
                                    ) : null}
                                    {latestPathLoading ? (
                                        <View style={styles.latestMapCenter}>
                                            <ActivityIndicator color="#fff" />
                                            <Text style={styles.latestMapText}>Loading map...</Text>
                                        </View>
                                    ) : latestPath.length > 0 ? (
                                        <MapView
                                            ref={latestMapRef}
                                            style={styles.latestMap}
                                            initialRegion={{
                                                latitude: Number(latestPath[0].lat),
                                                longitude: Number(latestPath[0].lon),
                                                latitudeDelta: 0.05,
                                                longitudeDelta: 0.05,
                                            }}
                                            onMapReady={() => setLatestMapReady(true)}
                                            scrollEnabled={true}
                                            zoomEnabled={true}
                                            rotateEnabled={true}
                                            pitchEnabled={false}
                                        >
                                            <Polyline
                                                coordinates={latestPath.map(p => ({
                                                    latitude: Number(p.lat),
                                                    longitude: Number(p.lon),
                                                }))}
                                                strokeWidth={4}
                                                strokeColor="#ffbf00"
                                            />
                                            {/* Start/End markers (stand out above the rest) */}
                                            {(() => {
                                                const first = latestPath[0];
                                                const last = latestPath[latestPath.length - 1];
                                                const firstLat = Number(first?.lat);
                                                const firstLon = Number(first?.lon);
                                                const lastLat = Number(last?.lat);
                                                const lastLon = Number(last?.lon);
                                                if ([firstLat, firstLon, lastLat, lastLon].some(n => isNaN(n))) return null;
                                                return (
                                                    <>
                                                        <Marker
                                                            coordinate={{ latitude: firstLat, longitude: firstLon }}
                                                            title="Start"
                                                        >
                                                            <View style={styles.startEndStartMarker}>
                                                                <Icon name="map-marker-alt" size={10} color="#fff" />
                                                            </View>
                                                        </Marker>
                                                        <Marker
                                                            coordinate={{ latitude: lastLat, longitude: lastLon }}
                                                            title="End"
                                                        >
                                                            <View style={styles.startEndEndMarker}>
                                                                <Icon name="map-marker-alt" size={10} color="#fff" />
                                                            </View>
                                                        </Marker>
                                                    </>
                                                );
                                            })()}
                                            {latestPath.map((p: any, index: number) => {
                                                const lat = Number(p?.lat);
                                                const lon = Number(p?.lon);
                                                if (isNaN(lat) || isNaN(lon)) return null;

                                                const eventType = p?.eventType ? String(p.eventType) : '';
                                                return (
                                                    <Marker
                                                        key={`latest-marker-${latestTrip?.id ?? 'trip'}-${index}`}
                                                        coordinate={{ latitude: lat, longitude: lon }}
                                                        title={eventType || 'Point'}
                                                    >
                                                        <View
                                                            style={[
                                                                styles.markerDot,
                                                                eventType ? styles.eventMarker : styles.pathMarker,
                                                            ]}
                                                        >
                                                            {eventType ? <Icon name="exclamation" size={8} color="#fff" /> : null}
                                                        </View>
                                                    </Marker>
                                                );
                                            })}
                                        </MapView>
                                    ) : (
                                        <View style={styles.latestMapCenter}>
                                            <Text style={styles.latestMapText}>No GPS points for this trip.</Text>
                                        </View>
                                    )}
                                </View>

                                {(() => {
                                    const scores = latestTrip?.damoovScores || {};
                                    const stats = latestTrip?.damoovStatistics || {};
                                    const startParts = latestTrip?.startLocation?.Parts || {};
                                    const endParts = latestTrip?.endLocation?.Parts || {};
                                    const region = startParts?.State || startParts?.District || null;
                                    const country = startParts?.Country || startParts?.CountryCode || null;
                                    const cityStart = startParts?.City || null;
                                    const cityFinish = endParts?.City || null;
                                    const addressStart = latestTrip?.startLocation?.Full || null;
                                    const addressEnd = latestTrip?.endLocation?.Full || null;
                                    const safe = (v: any) => (v == null || Number.isNaN(Number(v)) ? '—' : String(Math.round(Number(v))));
                                    const safeFloor = (v: any) => (v == null || Number.isNaN(Number(v)) ? '—' : String(Math.floor(Number(v))));
                                    const safeOneDecimal = (v: any) =>
                                        v == null || Number.isNaN(Number(v)) ? '—' : String(Number(v).toFixed(1));

                                    return (
                                        <>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Mileage</Text>
                                                <Text style={styles.latestVal}>{safe(stats?.Mileage ?? latestTrip?.distanceKm)} km</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Time Driven (min)</Text>
                                                <Text style={styles.latestVal}>{safeFloor(stats?.DurationMinutes ?? latestTrip?.durationMin)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Max Speed</Text>
                                                <Text style={styles.latestVal}>{latestTrip?.maxSpeed != null ? `${safeOneDecimal(latestTrip?.maxSpeed)} km/h` : '—'}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Average Speed</Text>
                                                <Text style={styles.latestVal}>{latestTrip?.avgSpeed != null ? `${safeOneDecimal(latestTrip?.avgSpeed)} km/h` : '—'}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Safety Score</Text>
                                                <Text style={styles.latestVal}>{latestTrip?.safetyScore != null ? `${safe(latestTrip.safetyScore)} / 100` : '—'}</Text>
                                            </View>

                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Speeding</Text>
                                                <Text style={styles.latestVal}>{safe(scores.Speeding)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Acceleration Score / Braking Score</Text>
                                                <Text style={styles.latestVal}>{safe(scores.Acceleration)} / {safe(scores.Braking)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Phone Usage Score</Text>
                                                <Text style={styles.latestVal}>{safe(scores.PhoneUsage)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Phone usage (time, distance)</Text>
                                                <Text style={styles.latestVal}>
                                                    {stats?.PhoneUsageDurationMinutes != null || stats?.PhoneUsageMileage != null
                                                        ? `(${safeFloor(stats?.PhoneUsageDurationMinutes)} min, ${safeOneDecimal(stats?.PhoneUsageMileage)} km)`
                                                        : '—'}
                                                </Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Cornering</Text>
                                                <Text style={styles.latestVal}>{safe(scores.Cornering)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Harsh Breaking (count)</Text>
                                                <Text style={styles.latestVal}>{stats?.BrakingsCount != null ? String(stats.BrakingsCount) : '—'}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Hard Acceleration (count)</Text>
                                                <Text style={styles.latestVal}>{stats?.AccelerationsCount != null ? String(stats.AccelerationsCount) : '—'}</Text>
                                            </View>

                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Eco Score</Text>
                                                <Text style={styles.latestVal}>{safe(scores.Eco)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>EcoFuel / EcoTyres / EcoBrakes</Text>
                                                <Text style={styles.latestVal}>{safe(scores.EcoFuel)} / {safe(scores.EcoTyres)} / {safe(scores.EcoBrakes)}</Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Eco Depreciation</Text>
                                                <Text style={styles.latestVal}>{safe(scores.EcoDepreciation)}</Text>
                                            </View>

                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>Region / Country</Text>
                                                <Text style={styles.latestVal}>
                                                    {region ? String(region) : '—'}
                                                    {country ? `, ${country}` : ''}
                                                </Text>
                                            </View>
                                            <View style={styles.latestRow}>
                                                <Text style={styles.latestKey}>City Start → Finish</Text>
                                                <Text style={styles.latestVal}>
                                                    {(cityStart ? String(cityStart) : '—') + ' → ' + (cityFinish ? String(cityFinish) : '—')}
                                                </Text>
                                            </View>
                                            <View style={{ marginTop: hp(1) }}>
                                                <Text style={styles.latestKey}>Address Start</Text>
                                                <Text style={styles.latestVal} numberOfLines={2}>{addressStart || '—'}</Text>
                                                <Text style={[styles.latestKey, { marginTop: hp(0.5) }]}>Address Finish</Text>
                                                <Text style={styles.latestVal} numberOfLines={2}>{addressEnd || '—'}</Text>
                                            </View>
                                        </>
                                    );
                                })()}
                            </>
                        ) : (
                            <Text style={{ color: '#aaa' }}>No trip data yet.</Text>
                        )}
                    </View>
                )}

            </ScrollView>

            {/* Assistance FAB (Only when Live Drive is active) */}
            {isCoachActive && (
                <TouchableOpacity
                    style={styles.assistanceFab}
                    onPress={() => setIsAssistanceDrawerOpen(true)}
                >
                    <Icon name="medkit" size={wp(6)} color="#fff" />
                </TouchableOpacity>
            )}

            {/* Assistance Drawer Modal */}
            <AssistanceDrawer
                isVisible={isAssistanceDrawerOpen}
                onClose={() => setIsAssistanceDrawerOpen(false)}
                currentLat={currentLocation?.lat || null}
                currentLon={currentLocation?.lon || null}
            />

            {/* Full-screen map overlay (map only) */}
            <Modal visible={latestMapFullscreen} animationType="slide" presentationStyle="fullScreen">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
                    <View style={styles.fullscreenHeader}>
                        <TouchableOpacity
                            style={styles.fullscreenCloseButton}
                            onPress={() => setLatestMapFullscreen(false)}
                        >
                            <Icon name="times" size={wp(5)} color="#fff" />
                        </TouchableOpacity>
                        <View style={{ flex: 1 }} />
                    </View>

                    <View style={styles.fullscreenMapContainer}>
                        {latestPathLoading ? (
                            <View style={styles.latestMapCenter}>
                                <ActivityIndicator color="#fff" />
                                <Text style={styles.latestMapText}>Loading map...</Text>
                            </View>
                        ) : latestPath.length > 0 ? (
                            <MapView
                                style={styles.fullscreenMap}
                                initialRegion={{
                                    latitude: Number(latestPath[0].lat),
                                    longitude: Number(latestPath[0].lon),
                                    latitudeDelta: 0.05,
                                    longitudeDelta: 0.05,
                                }}
                                scrollEnabled={true}
                                zoomEnabled={true}
                                rotateEnabled={true}
                                pitchEnabled={false}
                            >
                                <Polyline
                                    coordinates={latestPath.map(p => ({
                                        latitude: Number(p.lat),
                                        longitude: Number(p.lon),
                                    }))}
                                    strokeWidth={4}
                                    strokeColor="#ffbf00"
                                />
                                                {/* Start/End markers (stand out above the rest) */}
                                                {(() => {
                                                    const first = latestPath[0];
                                                    const last = latestPath[latestPath.length - 1];
                                                    const firstLat = Number(first?.lat);
                                                    const firstLon = Number(first?.lon);
                                                    const lastLat = Number(last?.lat);
                                                    const lastLon = Number(last?.lon);
                                                    if ([firstLat, firstLon, lastLat, lastLon].some(n => isNaN(n))) return null;
                                                    return (
                                                        <>
                                                            <Marker
                                                                coordinate={{ latitude: firstLat, longitude: firstLon }}
                                                                title="Start"
                                                            >
                                                                <View style={styles.startEndStartMarker}>
                                                                    <Icon name="map-marker-alt" size={10} color="#fff" />
                                                                </View>
                                                            </Marker>
                                                            <Marker
                                                                coordinate={{ latitude: lastLat, longitude: lastLon }}
                                                                title="End"
                                                            >
                                                                <View style={styles.startEndEndMarker}>
                                                                    <Icon name="map-marker-alt" size={10} color="#fff" />
                                                                </View>
                                                            </Marker>
                                                        </>
                                                    );
                                                })()}
                                {latestPath.map((p: any, index: number) => {
                                    const lat = Number(p?.lat);
                                    const lon = Number(p?.lon);
                                    if (isNaN(lat) || isNaN(lon)) return null;

                                    const eventType = p?.eventType ? String(p.eventType) : '';
                                    return (
                                        <Marker
                                            key={`fs-marker-${latestTrip?.id ?? 'trip'}-${index}`}
                                            coordinate={{ latitude: lat, longitude: lon }}
                                            title={eventType || 'Point'}
                                        >
                                            <View
                                                style={[
                                                    styles.markerDot,
                                                    eventType ? styles.eventMarker : styles.pathMarker,
                                                ]}
                                            >
                                                {eventType ? <Icon name="exclamation" size={8} color="#fff" /> : null}
                                            </View>
                                        </Marker>
                                    );
                                })}
                            </MapView>
                        ) : (
                            <View style={styles.latestMapCenter}>
                                <Text style={styles.latestMapText}>No GPS points for this trip.</Text>
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: wp(5),
        paddingVertical: hp(2),
    },
    backButton: {
        width: wp(10),
        height: wp(10),
        justifyContent: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: wp(5.5),
        fontWeight: '700',
        color: '#fff',
        marginLeft: wp(3),
    },
    timelineButton: {
        paddingHorizontal: wp(3),
        paddingVertical: hp(0.6),
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.06)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    timelineButtonText: {
        color: '#fff',
        fontSize: wp(3),
        fontWeight: '600',
    },
    scrollContent: {
        paddingHorizontal: wp(5),
        paddingBottom: hp(5),
    },
    scoreCard: {
        backgroundColor: '#1a1a1a',
        borderRadius: wp(5),
        padding: wp(6),
        alignItems: 'center',
        marginVertical: hp(3),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    scoreTitle: {
        fontSize: wp(4.5),
        color: '#aaa',
        marginBottom: hp(2),
    },
    scoreCircle: {
        width: wp(35),
        height: wp(35),
        borderRadius: wp(17.5),
        borderWidth: 8,
        borderColor: '#4ade80',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    scoreNumber: {
        fontSize: wp(10),
        fontWeight: '800',
        color: '#fff',
    },
    scoreUnit: {
        fontSize: wp(3.5),
        color: '#aaa',
        marginTop: -5,
    },
    scoreSubtitle: {
        fontSize: wp(4),
        color: '#4ade80',
        fontWeight: '500',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    gridItem: {
        width: '48%',
        backgroundColor: '#1a1a1a',
        borderRadius: wp(4),
        padding: wp(5),
        alignItems: 'center',
        marginBottom: hp(2),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    latestCard: {
        backgroundColor: '#141414',
        borderRadius: wp(5),
        padding: wp(5),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginVertical: hp(2),
    },
    latestTitle: {
        color: '#FFBF00',
        fontSize: wp(4.3),
        fontWeight: '800',
        marginBottom: hp(1.5),
    },
    latestRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginTop: hp(0.8),
        gap: wp(3),
    },
    latestKey: {
        flex: 1,
        color: '#888',
        fontSize: wp(3.1),
    },
    latestVal: {
        flex: 1,
        color: '#fff',
        fontSize: wp(3.1),
        fontWeight: '600',
        textAlign: 'right',
    },
    latestMapContainer: {
        width: '100%',
        height: hp(28),
        borderRadius: wp(4),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        marginBottom: hp(1.5),
        backgroundColor: '#0d0d0d',
    },
    latestMap: {
        width: '100%',
        height: '100%',
    },
    latestMapCenter: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: hp(0.5),
        padding: wp(3),
    },
    latestMapExpandButton: {
        position: 'absolute',
        top: hp(1),
        right: wp(3),
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.45)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        paddingHorizontal: wp(2),
        paddingVertical: hp(0.8),
        borderRadius: wp(6),
        zIndex: 10,
        gap: wp(1.5),
    },
    latestMapExpandText: {
        color: '#fff',
        fontSize: wp(3),
        fontWeight: '700',
    },
    latestMapText: {
        color: '#aaa',
        fontSize: wp(3.2),
        fontWeight: '600',
        textAlign: 'center',
    },
    fullscreenHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: wp(3),
        paddingTop: hp(1),
        paddingBottom: hp(1),
        backgroundColor: '#0a0a0a',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    fullscreenCloseButton: {
        width: wp(10),
        height: wp(10),
        borderRadius: wp(5),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    fullscreenMapContainer: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    fullscreenMap: {
        flex: 1,
        width: '100%',
        height: '100%',
    },
    markerDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pathMarker: { backgroundColor: '#ffbf00' },
    eventMarker: { backgroundColor: '#ef4444', width: 16, height: 16, borderRadius: 8 },
    startEndStartMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#22c55e',
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    startEndEndMarker: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#f43f5e',
        borderWidth: 2,
        borderColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gridValue: {
        fontSize: wp(5),
        fontWeight: '700',
        color: '#fff',
        marginTop: hp(1.5),
        marginBottom: hp(0.5),
    },
    gridLabel: {
        fontSize: wp(3.5),
        color: '#888',
    },
    liveDriveContainer: {
        backgroundColor: '#1a1a1a',
        borderRadius: wp(5),
        padding: wp(6),
        alignItems: 'center',
        marginVertical: hp(1),
        borderWidth: 1,
        borderColor: '#4ade80',
    },
    liveDriveHeader: {
        flexDirection: 'row',
        width: '100%',
        justifyContent: 'flex-start',
        marginBottom: hp(2)
    },
    recordingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(74, 222, 128, 0.2)',
        paddingHorizontal: wp(3),
        paddingVertical: hp(0.5),
        borderRadius: wp(4)
    },
    recordingDot: {
        width: 8, height: 8, borderRadius: 4, backgroundColor: '#4ade80', marginRight: wp(2)
    },
    recordingText: {
        color: '#4ade80', fontSize: wp(3), fontWeight: 'bold'
    },
    speedometerContainer: {
        alignItems: 'center', justifyContent: 'center',
        width: wp(45), height: wp(45),
        borderRadius: wp(22.5),
        borderWidth: 6, borderColor: '#4ade80',
        marginBottom: hp(2)
    },
    speedText: {
        fontSize: wp(14), fontWeight: '900', color: '#fff'
    },
    speedUnit: {
        fontSize: wp(4), color: '#aaa', marginTop: -5
    },
    locationText: {
        color: '#888', fontSize: wp(3.5), marginBottom: hp(1)
    },
    simulateButton: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)', borderWidth: 1, borderColor: '#ef4444',
        padding: wp(4), borderRadius: wp(3), alignItems: 'center', width: '100%'
    },
    simulateButtonText: {
        color: '#ef4444', fontWeight: 'bold', fontSize: wp(4)
    },
    assistanceFab: {
        position: 'absolute',
        bottom: hp(4),
        right: wp(5),
        width: wp(16),
        height: wp(16),
        borderRadius: wp(8),
        backgroundColor: '#ef4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
        elevation: 5,
        zIndex: 1000,
        borderWidth: 2,
        borderColor: '#fff'
    },
});
