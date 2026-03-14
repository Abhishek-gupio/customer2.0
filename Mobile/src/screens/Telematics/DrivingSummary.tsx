import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, ActivityIndicator, Switch, Platform, Alert } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import Tts from 'react-native-tts';
import { telematicsApi } from '../../api/telematics';
import { vehicleService } from '../../services/vehicleService';
import { AssistanceDrawer } from '../../components/common/AssistanceDrawer';
import { getUserId } from '../../services/storage';

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

    useEffect(() => {
        currentSpeedRef.current = currentSpeed;
        currentLocationRef.current = currentLocation;
    }, [currentSpeed, currentLocation]);

    useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                // 1. Get user's primary vehicle
                const res = await vehicleService.getVehicles();
                let vehiclesData: any[] = [];
                if (Array.isArray(res)) vehiclesData = res;
                else if (res && (res as any).data && Array.isArray((res as any).data)) vehiclesData = (res as any).data;

                if (vehiclesData.length === 0) return;
                const primary = vehiclesData.find((v: any) => v.isPrimary) || vehiclesData[0];
                setPrimaryVehicle(primary);

                // 2. Fetch Trips for that vehicle
                if (primary?.id) {
                    const tripsRes = await telematicsApi.getTrips(primary.id);
                    // API returns { success: true, data: { data: trips[], pagination } }
                    const tripsArray = Array.isArray(tripsRes?.data?.data) ? tripsRes.data.data : (Array.isArray(tripsRes?.data) ? tripsRes.data : []);

                    if (tripsArray.length > 0) {
                        const trips = tripsArray;
                        // Aggregate data from all fetched trips
                        const totalDistance = trips.reduce((acc: number, t: any) => acc + (t.distanceKm || 0), 0);
                        const totalDuration = trips.reduce((acc: number, t: any) => acc + (t.durationMin || 0), 0);
                        const avgScore = trips.reduce((acc: number, t: any) => acc + (t.safetyScore || 0), 0) / trips.length;

                        // Count events across all trips
                        let harshBrakingCount = 0;
                        let hardAccelCount = 0;

                        trips.forEach((t: any) => {
                            if (t.events && Array.isArray(t.events)) {
                                t.events.forEach((e: any) => {
                                    if (e.eventType === 'HARSH_BRAKING') harshBrakingCount++;
                                    if (e.eventType === 'HARSH_ACCEL' || e.eventType === 'HARSH_ACCELERATION') hardAccelCount++;
                                });
                            }
                        });

                        const hours = Math.floor(totalDuration / 60);
                        const minutes = Math.floor(totalDuration % 60);

                        setScore(Math.round(avgScore));
                        setMetrics({
                            distance: Math.round(totalDistance).toString(),
                            duration: `${hours}h ${minutes}m`,
                            harshBraking: harshBrakingCount.toString(),
                            hardAccel: hardAccelCount.toString()
                        });
                    } else {
                        setScore(null);
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

    const handleLinkDevice = async () => {
        if (!primaryVehicle?.id) return;
        const userId = getUserId() || 'user';
        setLinkLoading(true);
        try {
            const deviceToken = await telematicsApi.registerUser(userId);
            if (!deviceToken) throw new Error('No DeviceToken from server');
            const instanceId = `app-${userId}-${Date.now()}`;
            await telematicsApi.linkDevice(
                primaryVehicle.id,
                instanceId,
                deviceToken,
                Platform.OS as 'ios' | 'android',
            );
            setLinkDone(true);
            Alert.alert(
                'Device linked',
                'This phone is now linked for driving trips. With the Damoov SDK integrated, your trips will appear here after you drive.',
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
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Icon name="arrow-left" size={wp(5)} color="#fff" />
                </TouchableOpacity>
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

                {/* Insight Grid */}
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
        justifyContent: 'space-between',
        paddingHorizontal: wp(5),
        paddingVertical: hp(2),
    },
    backButton: {
        width: wp(10),
        height: wp(10),
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: wp(5),
        fontWeight: '700',
        color: '#fff',
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
