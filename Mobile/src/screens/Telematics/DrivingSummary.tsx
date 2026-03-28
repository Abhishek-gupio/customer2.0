import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Platform, 
  Alert, 
  StatusBar, 
  PermissionsAndroid, 
  Modal 
} from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import { telematicsApi } from '../../api/telematics';
import { vehicleService } from '../../services/vehicleService';
import { AssistanceDrawer } from '../../components/common/AssistanceDrawer';
import { getUserId, getTelematicsLinked, setTelematicsLinked } from '../../services/storage';
import BackButton from '../../components/BackButton';
import { damoovTelematics } from '../../native/damoovTelematics';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';

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
    const [metrics, setMetrics] = useState({ 
        distance: '0', 
        duration: '0h 0m', 
        harshBraking: '0', 
        hardAccel: '0',
        phoneUsage: '0',
        nightDist: '0 km'
    });
    const [latestTrip, setLatestTrip] = useState<any | null>(null);
    const [latestPath, setLatestPath] = useState<any[]>([]);
    const [latestPathLoading, setLatestPathLoading] = useState(false);
    const [latestMapReady, setLatestMapReady] = useState(false);
    const [latestMapFullscreen, setLatestMapFullscreen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isAssistanceDrawerOpen, setIsAssistanceDrawerOpen] = useState(false);
    const [primaryVehicle, setPrimaryVehicle] = useState<{ id: string; registrationNumber?: string } | null>(null);
    const [linkLoading, setLinkLoading] = useState(false);
    const [linkDone, setLinkDone] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);

    const latestMapRef = useRef<MapView>(null);

    const fetchTelemetry = async () => {
        try {
            setLoading(true);
            try {
                await telematicsApi.syncTrips();
            } catch (e) {
                console.log('Skipping auto-sync', e);
            }

            const res = await vehicleService.getVehicles();
            let vehiclesData: any[] = [];
            if (Array.isArray(res)) vehiclesData = res;
            else if (res && (res as any).data && Array.isArray((res as any).data)) vehiclesData = (res as any).data;

            if (vehiclesData.length === 0) return;
            const primary = vehiclesData.find((v: any) => v.isPrimary) || vehiclesData[0];
            setPrimaryVehicle(primary);

            if (primary?.id) {
                const storedLinked = getTelematicsLinked(primary.id);
                const backendLinked = !!(primary.telematicsDevice && primary.telematicsDevice.isActive);

                if (storedLinked || backendLinked) {
                    setLinkDone(true);
                    if (backendLinked && !storedLinked) {
                        setTelematicsLinked(primary.id, true);
                    }
                } else {
                    // For safety, if we have trips, it must be linked
                    const tripsRes = await telematicsApi.getTrips(primary.id);
                    const tripsArray = Array.isArray(tripsRes?.data?.data) ? tripsRes.data.data : (Array.isArray(tripsRes?.data) ? tripsRes.data : []);
                    if (tripsArray.length > 0) {
                        setLinkDone(true);
                        setTelematicsLinked(primary.id, true);
                    }
                }

                const tripsRes = await telematicsApi.getTrips(primary.id);
                const tripsArray = Array.isArray(tripsRes?.data?.data) ? tripsRes.data.data : (Array.isArray(tripsRes?.data) ? tripsRes.data : []);

                if (tripsArray.length > 0) {
                    const latest = tripsArray[0];
                    setLatestTrip(latest);

                    const latestScore = latest?.safetyScore != null ? Number(latest.safetyScore) : null;
                    setScore(latestScore != null ? Math.round(latestScore) : null);
                    
                    // Comprehensive metric parsing
                    const distKm = Number(latest?.distanceKm ?? 0) || 0;
                    const durMin = Number(latest?.durationMin ?? 0) || 0;
                    
                    const latestStats = latest?.damoovStatistics || latest?.statistics || {};
                    const hbCount = latestStats?.BrakingsCount ?? 0;
                    const haCount = latestStats?.AccelerationsCount ?? 0;

                    const hours = Math.floor(durMin / 60);
                    const minutes = Math.floor(durMin % 60);

                    setMetrics({
                        distance: distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`,
                        duration: `${hours}h ${minutes}m`,
                        harshBraking: hbCount.toString(),
                        hardAccel: haCount.toString(),
                        phoneUsage: (latestStats?.PhoneUsageDurationMinutes || 0).toString(),
                        nightDist: (latestStats?.NightMileage || 0).toFixed(1) + ' km',
                    });

                    setTelematicsLinked(primary.id, true);
                    setLinkDone(true);
                } else {
                    setScore(null);
                    setLatestTrip(null);
                    setMetrics({ distance: '0', duration: '0h 0m', harshBraking: '0', hardAccel: '0', phoneUsage: '0', nightDist: '0 km' });
                }
            }
        } catch (error) {
            console.error("Failed to load telematics:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTelemetry();

        // Get current location for SOS drawer
        if (Geolocation) {
            Geolocation.getCurrentPosition(
                (pos: any) => {
                    setCurrentLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
                },
                (err: any) => console.log('Summary GPS Error', err),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
            );
        }
    }, []);

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
                latestMapRef.current.animateToRegion({
                    latitude: Number(first.lat),
                    longitude: Number(first.lon),
                    latitudeDelta: 0.05,
                    longitudeDelta: 0.05,
                }, 800);
            } catch {}
        }
    }, [latestPath, latestMapReady, latestPathLoading]);


    const requestTelematicsPermissions = async (): Promise<boolean> => {
        if (Platform.OS !== 'android') return true;
        try {
            const apiLevel = (Platform as any).Version;
            const perms = [
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ];
            
            if (apiLevel >= 29) {
                if (PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION) {
                    perms.push(PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION);
                }
                if (PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION) {
                    perms.push(PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION);
                }
            }

            const result = await PermissionsAndroid.requestMultiple(perms);
            
            const fineGranted = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED;
            const activityGranted = apiLevel >= 29 
                ? result[PermissionsAndroid.PERMISSIONS.ACTIVITY_RECOGNITION] === PermissionsAndroid.RESULTS.GRANTED
                : true;

            return fineGranted && activityGranted;
        } catch { return false; }
    };

    const handleLinkDevice = async () => {
        if (!primaryVehicle?.id) return;
        const userId = getUserId() || 'user';
        setLinkLoading(true);
        try {
            if (Platform.OS === 'android' && damoovTelematics.isAvailable()) {
                const granted = await requestTelematicsPermissions();
                if (!granted) {
                    Alert.alert('Permissions needed', 'Location and Physical Activity permissions are required for driving recognition. Please allow these in Settings to link your device.');
                    return;
                }
            }
            const deviceToken = await telematicsApi.registerUser(userId);
            if (!deviceToken) throw new Error('No DeviceToken');
            const instanceId = uuidV4();
            await telematicsApi.linkDevice(primaryVehicle.id, instanceId, deviceToken, Platform.OS as 'ios' | 'android');
            if (damoovTelematics.isAvailable()) {
                await damoovTelematics.setDeviceId(deviceToken);
                await damoovTelematics.setEnabled(true);
            }
            setTelematicsLinked(primaryVehicle.id, true);
            setLinkDone(true);
            Alert.alert('Linked', 'Driving history is now being tracked.');
        } catch (e: any) {
            Alert.alert('Link failed', e?.message || 'Error linking device');
        } finally {
            setLinkLoading(false);
        }
    };

    const getScoreColor = (val: number | null) => {
        if (val === null) return '#444';
        if (val >= 85) return '#10B981';
        if (val >= 70) return '#FFBF00';
        return '#EF4444';
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Driving Behavior</Text>
                <TouchableOpacity style={styles.timelineTab} onPress={() => navigation.navigate('DrivingTimeline')}>
                  <MaterialIcon name="history" size={wp(5)} color="#fff" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                
                {/* HERO BANNER */}
                <View style={styles.heroBanner}>
                    <FastImage
                      source={{ uri: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&q=80&w=1200' }}
                      style={styles.heroImage}
                    />
                    <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.heroOverlay}>
                       <Text style={styles.heroTitle}>Smart Insights</Text>
                       <Text style={styles.heroSub}>Detailed telemetry for safer driving</Text>
                    </LinearGradient>
                </View>

                {/* OVERALL SCORE CARD - PREMIUM HUD STYLE */}
                <View style={styles.mainScoreSection}>
                    <LinearGradient 
                        colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']} 
                        style={styles.premiumGlassCard}
                    >
                        <View style={styles.scoreHeader}>
                            <View style={styles.titleRow}>
                                <MaterialIcon name="shield-check-outline" size={wp(5)} color={getScoreColor(score)} />
                                <Text style={styles.sectionLabelPremium}>SAFETY PERFORMANCE</Text>
                            </View>
                            <TouchableOpacity onPress={() => fetchTelemetry()} activeOpacity={0.7} style={styles.refreshBadge}>
                                <Icon name="sync-alt" size={wp(3)} color="#FFBF00" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.gaugeContainerPremium}>
                            <View style={styles.gaugeWrapper}>
                                {/* OUTER GLOW RING */}
                                <View style={[styles.gaugeGlow, { borderColor: getScoreColor(score) + '10' }]} />
                                
                                {/* BASE TRACK */}
                                <View style={[styles.gaugeBase, { borderColor: getScoreColor(score) + '10' }]} />
                                
                                {/* SHADOW TRACK */}
                                <View style={[styles.gaugeBase, { borderColor: 'rgba(255,255,255,0.02)', transform: [{ scale: 0.9 }] }]} />

                                {/* DYNAMIC ARC FILL */}
                                <View style={[styles.gaugeFill, { 
                                    borderColor: getScoreColor(score),
                                    borderRightColor: 'transparent',
                                    borderBottomColor: 'transparent',
                                    transform: [{ rotate: `${(score || 0) * 1.8}deg` }]
                                }]} />
                                
                                {/* HUB CONTENT */}
                                <View style={styles.gaugeContent}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#FFBF00" />
                                    ) : (
                                        <View style={styles.scoreHub}>
                                            <Text style={[styles.scoreBigPremium, { color: getScoreColor(score), textShadowColor: getScoreColor(score) + '40', textShadowRadius: 10 }]}>
                                                {score ?? '--'}
                                            </Text>
                                            <View style={styles.scoreUnitWrap}>
                                                <View style={[styles.scoreUnitLine, { backgroundColor: getScoreColor(score) }]} />
                                                <Text style={styles.scoreUnitPremium}>HUD-DRIVE</Text>
                                                <View style={[styles.scoreUnitLine, { backgroundColor: getScoreColor(score) }]} />
                                            </View>
                                        </View>
                                    )}
                                </View>

                                {/* QUADRANT MARKERS */}
                                <View style={[styles.quadMarker, { top: -2, backgroundColor: getScoreColor(score) }]} />
                                <View style={[styles.quadMarker, { bottom: -2, backgroundColor: 'rgba(255,255,255,0.1)' }]} />
                                <View style={[styles.quadMarker, { left: -2, backgroundColor: 'rgba(255,255,255,0.1)', transform: [{rotate: '90deg'}] }]} />
                                <View style={[styles.quadMarker, { right: -2, backgroundColor: 'rgba(255,255,255,0.1)', transform: [{rotate: '90deg'}] }]} />
                            </View>

                            <View style={styles.feedbackColPremium}>
                                <View style={styles.statusBadge}>
                                    <View style={[styles.statusDot, { backgroundColor: getScoreColor(score) }]} />
                                    <Text style={[styles.statusText, { color: getScoreColor(score) }]}>
                                        {score && score >= 85 ? 'ELITE DRIVER' : score && score >= 70 ? 'SECURE' : 'AT RISK'}
                                    </Text>
                                </View>
                                <Text style={styles.feedbackTitlePremium}>
                                    {score && score >= 85 ? 'Precision Handling' : score && score >= 70 ? 'Balanced Drive' : 'Erratic Patterns'}
                                </Text>
                                <Text style={styles.feedbackDescPremium}>
                                    Based on your last drive intensity and braking precision.
                                </Text>
                            </View>
                        </View>

                        {/* MINI PROGRESS STRIPS */}
                        <View style={styles.miniStatsRow}>
                            <View style={styles.miniStatItem}>
                                <Text style={styles.miniStatLab}>STABILITY</Text>
                                <View style={styles.miniBarBase}><View style={[styles.miniBarFill, { width: '92%', backgroundColor: '#4ade80' }]} /></View>
                            </View>
                            <View style={styles.miniStatItem}>
                                <Text style={styles.miniStatLab}>SMOOTHNESS</Text>
                                <View style={styles.miniBarBase}><View style={[styles.miniBarFill, { width: `${score || 0}%`, backgroundColor: getScoreColor(score) }]} /></View>
                            </View>
                        </View>
                    </LinearGradient>
                </View>

                {/* STATS GRID */}
                <View style={styles.gridContainer}>
                    <View style={styles.gridRow}>
                        <View style={styles.gridCard}>
                            <Icon name="road" size={wp(5)} color="#FFBF00" />
                            <Text style={styles.gridVal}>{metrics.distance} km</Text>
                            <Text style={styles.gridLab}>Distance</Text>
                        </View>
                        <View style={styles.gridSubtitleCard}>
                            <Icon name="clock" size={wp(5)} color="#FFBF00" />
                            <Text style={styles.gridVal}>{metrics.duration}</Text>
                            <Text style={styles.gridLab}>Duration</Text>
                        </View>
                    </View>
                    <View style={[styles.gridRow, { marginTop: wp(3) }]}>
                        <View style={[styles.gridCard, { borderLeftColor: '#EF4444', borderLeftWidth: 3 }]}>
                            <MaterialIcon name="car-brake-alert" size={wp(6)} color="#EF4444" />
                            <Text style={styles.gridVal}>{metrics.harshBraking}</Text>
                            <Text style={styles.gridLab}>Harsh Braking</Text>
                        </View>
                        <View style={[styles.gridCard, { borderLeftColor: '#F59E0B', borderLeftWidth: 3 }]}>
                            <MaterialIcon name="speedometer" size={wp(6)} color="#F59E0B" />
                            <Text style={styles.gridVal}>{metrics.hardAccel}</Text>
                            <Text style={styles.gridLab}>Hard Accel</Text>
                        </View>
                    </View>
                </View>

                {/* DEVICE LINKING CARD */}
                {!linkDone && primaryVehicle && (
                    <TouchableOpacity style={styles.linkCard} onPress={handleLinkDevice} disabled={linkLoading}>
                        <LinearGradient colors={['#FFBF00', '#F59E0B']} style={styles.linkGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
                            <View style={styles.linkInfo}>
                                <Text style={styles.linkTitle}>Link Your Device</Text>
                                <Text style={styles.linkDesc}>Enable real-time trip recording for {primaryVehicle.registrationNumber}</Text>
                            </View>
                            {linkLoading ? <ActivityIndicator color="#000" /> : <Icon name="link" size={wp(5)} color="#000" />}
                        </LinearGradient>
                    </TouchableOpacity>
                )}
                {/* LAST TRIP INSIGHTS (NEW SUMMARY SECTION) */}
                {latestTrip && (
                    <View style={styles.tripSummaryCard}>
                        <View style={styles.tripSummaryHeader}>
                            <Text style={styles.tripSummaryTitle}>Last Trip Insight</Text>
                            <View style={styles.tripDateRow}>
                                <MaterialIcon name="calendar-today" size={wp(3)} color="#666" />
                                <Text style={styles.tripDateText}>
                                    {latestTrip.startTime ? format(new Date(latestTrip.startTime), 'MMM dd, HH:mm') : '--'}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.summaryStatsRow}>
                            <View style={styles.summaryStatItem}>
                                <Text style={styles.summaryStatVal}>{metrics.distance}</Text>
                                <Text style={styles.summaryStatLab}>Distance</Text>
                            </View>
                            <View style={styles.summaryStatDivider} />
                            <View style={styles.summaryStatItem}>
                                <Text style={styles.summaryStatVal}>{metrics.duration}</Text>
                                <Text style={styles.summaryStatLab}>Duration</Text>
                            </View>
                            <View style={styles.summaryStatDivider} />
                            <View style={styles.summaryStatItem}>
                                <Text style={[styles.summaryStatVal, { color: getScoreColor(score) }]}>{score ?? '--'}</Text>
                                <Text style={styles.summaryStatLab}>Score</Text>
                            </View>
                        </View>

                        {/* TRIP INTEGRITY & RISK (NEW SECTION) */}
                        <View style={styles.integritySection}>
                            <View style={styles.integrityItem}>
                                <MaterialIcon name="moon-waning-crescent" size={wp(4)} color={Number(metrics.nightDist) > 0 ? '#818CF8' : '#666'} />
                                <Text style={styles.integrityLabel}>Night: {metrics.nightDist}</Text>
                            </View>
                            <View style={styles.integrityItem}>
                                <MaterialIcon name="phone-off" size={wp(4)} color={Number(metrics.phoneUsage) > 0 ? '#FB7185' : '#10B981'} />
                                <Text style={styles.integrityLabel}>Phone: {metrics.phoneUsage}m</Text>
                            </View>
                            <View style={styles.integrityItem}>
                                <MaterialIcon name="leaf" size={wp(4)} color="#34D399" />
                                <Text style={styles.integrityLabel}>Eco: {latestTrip.damoovScores?.Eco || '100'}%</Text>
                            </View>
                        </View>

                        {/* Eco Indicators - Small circular icons */}
                        <View style={styles.ecoRow}>
                             <View style={styles.ecoIconCircle}>
                                 <MaterialIcon name="gas-station" size={wp(3)} color="#666" />
                                 <Text style={styles.ecoValue}>{latestTrip.damoovScores?.EcoFuel || '90'}</Text>
                             </View>
                             <View style={styles.ecoIconCircle}>
                                 <MaterialIcon name="car-tire-alert" size={wp(3)} color="#666" />
                                 <Text style={styles.ecoValue}>{latestTrip.damoovScores?.EcoTyres || '95'}</Text>
                             </View>
                             <View style={styles.ecoIconCircle}>
                                 <MaterialIcon name="car-brake-fade" size={wp(3)} color="#666" />
                                 <Text style={styles.ecoValue}>{latestTrip.damoovScores?.EcoBrakes || '95'}</Text>
                             </View>
                        </View>

                        {/* Tips from backend enrichment */}
                        <View style={styles.tipsSection}>
                            {latestTrip.moneyTip && (
                                <View style={styles.insightBox}>
                                    <View style={[styles.insightIconWrap, { backgroundColor: 'rgba(255,191,0,0.1)' }]}>
                                        <Icon name="rupee-sign" size={wp(3)} color="#FFBF00" />
                                    </View>
                                    <Text style={styles.insightText} numberOfLines={2}>{latestTrip.moneyTip}</Text>
                                </View>
                            )}
                            {latestTrip.safetyTip && (
                                <View style={[styles.insightBox, { marginTop: hp(1) }]}>
                                    <View style={[styles.insightIconWrap, { backgroundColor: 'rgba(74,222,128,0.1)' }]}>
                                        <Icon name="shield-alt" size={wp(3)} color="#4ade80" />
                                    </View>
                                    <Text style={styles.insightText} numberOfLines={2}>{latestTrip.safetyTip}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* LATEST TRIP MAP */}
                {latestTrip && (
                    <View style={styles.mapSection}>
                        <View style={styles.mapHeaderRow}>
                            <Text style={styles.sectionHeading}>Last Drive Track</Text>
                            <View style={styles.cityBadge}>
                                <Text style={styles.cityText}>
                                    {(latestTrip.startLocation?.Parts?.City || 'Start')} → {(latestTrip.endLocation?.Parts?.City || 'End')}
                                </Text>
                            </View>
                        </View>
                        
                        <View style={styles.mapWrapper}>
                            {latestPathLoading ? (
                                <View style={styles.mapLoader}><ActivityIndicator color="#FFBF00" /></View>
                            ) : (
                                <MapView
                                    ref={latestMapRef}
                                    style={styles.map}
                                    onMapReady={() => setLatestMapReady(true)}
                                    scrollEnabled={true}
                                    zoomEnabled={true}
                                    pitchEnabled={false}
                                    rotateEnabled={false}
                                >
                                    {latestPath.length > 0 && (
                                        <>
                                            <Polyline 
                                                coordinates={latestPath.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lon) }))} 
                                                strokeWidth={4} 
                                                strokeColor="#FFBF00" 
                                            />
                                            <Marker coordinate={{ latitude: Number(latestPath[0].lat), longitude: Number(latestPath[0].lon) }}>
                                                <View style={styles.markerContainer}>
                                                    <View style={styles.labelPill}><Text style={styles.labelText}>START</Text></View>
                                                    <View style={styles.pinStart} />
                                                </View>
                                            </Marker>
                                            <Marker coordinate={{ latitude: Number(latestPath[latestPath.length-1].lat), longitude: Number(latestPath[latestPath.length-1].lon) }}>
                                                <View style={styles.markerContainer}>
                                                    <View style={[styles.labelPill, {backgroundColor: '#EF4444'}]}><Text style={styles.labelText}>FINISH</Text></View>
                                                    <View style={styles.pinEnd} />
                                                </View>
                                            </Marker>
                                            
                                            {/* Show key events on map */}
                                            {latestPath.filter(p => p.eventType).map((p, i) => {
                                                const eventType = p.eventType?.toLowerCase() || '';
                                                let icon = 'exclamation-triangle';
                                                let color = '#EF4444';
                                                let label = 'EVENT';

                                                if (eventType.includes('speed')) { 
                                                    icon = 'tachometer-alt'; color = '#F59E0B'; label = 'SPEEDING'; 
                                                } else if (eventType.includes('braking')) { 
                                                    icon = 'car-brake-alert'; color = '#EF4444'; label = 'BRAKING'; 
                                                } else if (eventType.includes('acceleration')) { 
                                                    icon = 'bolt'; color = '#FFBF00'; label = 'ACCEL'; 
                                                } else if (eventType.includes('cornering')) {
                                                    icon = 'vector-square'; color = '#818CF8'; label = 'CORNER';
                                                } else if (eventType.includes('phone')) {
                                                    icon = 'mobile-alt'; color = '#A78BFA'; label = 'PHONE';
                                                }

                                                return (
                                                    <Marker 
                                                        key={`event-${i}`}
                                                        coordinate={{ latitude: Number(p.lat), longitude: Number(p.lon) }}
                                                        title={label}
                                                        anchor={{ x: 0.5, y: 0.5 }}
                                                    >
                                                        <View style={[styles.eventMarkerWrap, { backgroundColor: color + '20' }]}>
                                                            <View style={[styles.eventMarkerInner, { backgroundColor: color }]}>
                                                                <Icon name={icon} size={wp(2)} color="#fff" />
                                                            </View>
                                                            <View style={[styles.eventTriangle, { borderTopColor: color }]} />
                                                        </View>
                                                    </Marker>
                                                );
                                            })}
                                        </>
                                    )}
                                </MapView>
                            )}
                            <TouchableOpacity style={styles.expandBtn} onPress={() => setLatestMapFullscreen(true)}>
                                <Icon name="expand" size={wp(3.5)} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        <View style={styles.addressFooter}>
                            <MaterialIcon name="place" size={wp(3.5)} color="#FFBF00" />
                            <Text style={styles.addressText} numberOfLines={1}>
                                {latestTrip.startLocation?.Full || 'Recording details...'}
                            </Text>
                        </View>
                    </View>
                )}

                <View style={{ height: hp(6) }} />
            </ScrollView>

            <Modal visible={latestMapFullscreen} animationType="slide">
                <SafeAreaView style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
                    <View style={styles.fullMapHeader}>
                        <TouchableOpacity onPress={() => setLatestMapFullscreen(false)} style={styles.closeBtn}>
                          <Icon name="times" size={wp(4)} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.fullMapTitle}>Detailed Route</Text>
                    </View>
                    <MapView 
                        style={{ flex: 1 }}
                        provider={Platform.OS === 'android' ? 'google' : undefined}
                        showsUserLocation={true}
                        showsMyLocationButton={true}
                        zoomEnabled={true}
                        scrollEnabled={true}
                        zoomControlEnabled={true}
                        onMapReady={() => setLatestMapReady(true)}
                        initialRegion={latestPath.length > 0 ? {
                            latitude: Number(latestPath[0].lat),
                            longitude: Number(latestPath[0].lon),
                            latitudeDelta: 0.05,
                            longitudeDelta: 0.05
                        } : undefined}
                    >
                         {latestPath.length > 0 && (
                            <>
                                <Polyline 
                                    coordinates={latestPath.map(p => ({ latitude: Number(p.lat), longitude: Number(p.lon) }))} 
                                    strokeWidth={5} 
                                    strokeColor="#FFBF00" 
                                />
                                <Marker coordinate={{ latitude: Number(latestPath[0].lat), longitude: Number(latestPath[0].lon) }}>
                                    <View style={styles.markerContainer}>
                                        <View style={styles.labelPill}><Text style={styles.labelText}>START</Text></View>
                                        <View style={styles.pinStart} />
                                    </View>
                                </Marker>
                                <Marker coordinate={{ latitude: Number(latestPath[latestPath.length-1].lat), longitude: Number(latestPath[latestPath.length-1].lon) }}>
                                    <View style={styles.markerContainer}>
                                        <View style={[styles.labelPill, {backgroundColor: '#EF4444'}]}><Text style={styles.labelText}>FINISH</Text></View>
                                        <View style={styles.pinEnd} />
                                    </View>
                                </Marker>
                                {latestPath.filter(p => p.eventType).map((p, i) => {
                                    const eventType = p.eventType?.toLowerCase() || '';
                                    let icon = 'exclamation-triangle';
                                    let color = '#EF4444';
                                    let label = 'EVENT';

                                    if (eventType.includes('speed')) { 
                                        icon = 'tachometer-alt'; color = '#F59E0B'; label = 'SPEEDING'; 
                                    } else if (eventType.includes('braking')) { 
                                        icon = 'car-brake-alert'; color = '#EF4444'; label = 'BRAKING'; 
                                    } else if (eventType.includes('acceleration')) { 
                                        icon = 'bolt'; color = '#FFBF00'; label = 'ACCEL'; 
                                    } else if (eventType.includes('cornering')) {
                                        icon = 'vector-square'; color = '#818CF8'; label = 'CORNER';
                                    } else if (eventType.includes('phone')) {
                                        icon = 'mobile-alt'; color = '#A78BFA'; label = 'PHONE';
                                    }

                                    return (
                                        <Marker 
                                            key={`full-event-${i}`}
                                            coordinate={{ latitude: Number(p.lat), longitude: Number(p.lon) }}
                                            title={label}
                                            anchor={{ x: 0.5, y: 0.5 }}
                                        >
                                            <View style={[styles.eventMarkerWrap, { backgroundColor: color + '20' }]}>
                                                <View style={[styles.eventMarkerInner, { backgroundColor: color }]}>
                                                    <Icon name={icon} size={wp(2.5)} color="#fff" />
                                                </View>
                                                <View style={[styles.eventTriangle, { borderTopColor: color }]} />
                                            </View>
                                        </Marker>
                                    );
                                })}
                            </>
                         )}
                    </MapView>
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
    headerTitle: {
        fontSize: wp(5.5),
        fontFamily: 'Outfit-Bold',
        color: '#fff',
        marginLeft: wp(3),
        flex: 1,
    },
    timelineTab: {
      width: wp(10),
      height: wp(10),
      borderRadius: 12,
      backgroundColor: 'rgba(255,255,255,0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
    },
    scrollContent: {
        paddingBottom: hp(2),
    },
    heroBanner: {
        height: hp(20),
        marginHorizontal: wp(5),
        borderRadius: 24,
        overflow: 'hidden',
        position: 'relative',
        marginBottom: hp(3),
    },
    heroImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: wp(5),
        justifyContent: 'flex-end',
    },
    heroTitle: {
        fontFamily: 'Outfit-Black',
        fontSize: wp(6),
        color: '#fff',
    },
    heroSub: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3.2),
        color: 'rgba(255,255,255,0.6)',
    },
    mainScoreSection: {
        paddingHorizontal: wp(5),
        marginBottom: hp(3),
    },
    premiumGlassCard: {
        borderRadius: 32,
        padding: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        overflow: 'hidden',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionLabelPremium: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(3.2),
        color: '#888',
        letterSpacing: 2,
        marginLeft: wp(2),
    },
    refreshBadge: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,191,0,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    gaugeContainerPremium: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: hp(2.5),
    },
    gaugeWrapper: {
        width: wp(34),
        height: wp(34),
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: wp(6),
    },
    gaugeGlow: {
        position: 'absolute',
        width: wp(38),
        height: wp(38),
        borderRadius: wp(19),
        borderWidth: 1,
    },
    gaugeBase: {
        position: 'absolute',
        width: wp(34),
        height: wp(34),
        borderRadius: wp(17),
        borderWidth: 5,
    },
    gaugeFill: {
        position: 'absolute',
        width: wp(34),
        height: wp(34),
        borderRadius: wp(17),
        borderWidth: 5,
        borderTopColor: 'transparent',
    },
    gaugeContent: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreBigPremium: {
        fontFamily: 'Outfit-Black',
        fontSize: wp(12),
        color: '#fff',
    },
    scoreHub: {
        alignItems: 'center',
    },
    scoreUnitWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: -hp(0.5),
    },
    scoreUnitLine: {
        width: 10,
        height: 1.5,
        opacity: 0.5,
    },
    scoreUnitPremium: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(2.2),
        color: '#666',
        marginHorizontal: wp(1),
        letterSpacing: 1,
    },
    quadMarker: {
        position: 'absolute',
        width: 2,
        height: 8,
        borderRadius: 1,
    },
    feedbackColPremium: {
        flex: 1,
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: wp(3),
        paddingVertical: hp(0.5),
        borderRadius: 20,
        alignSelf: 'flex-start',
        marginBottom: hp(1),
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: wp(2),
    },
    statusText: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(2.8),
        letterSpacing: 0.5,
    },
    feedbackTitlePremium: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4.5),
        color: '#fff',
        marginBottom: hp(0.5),
    },
    feedbackDescPremium: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3.2),
        color: '#666',
        lineHeight: hp(2),
    },
    miniStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: hp(2.5),
        paddingTop: hp(2.5),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    miniStatItem: {
        width: '46%',
    },
    miniStatLab: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(2.5),
        color: '#555',
        marginBottom: hp(0.8),
        letterSpacing: 1,
    },
    miniBarBase: {
        height: 4,
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 2,
        overflow: 'hidden',
    },
    miniBarFill: {
        height: '100%',
        borderRadius: 2,
    },
    glassCard: {
        backgroundColor: '#111',
        borderRadius: 24,
        padding: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    scoreHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    sectionLabel: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(3.5),
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    gaugeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    gaugeCircle: {
        width: wp(28),
        height: wp(28),
        borderRadius: wp(14),
        borderWidth: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: wp(5),
    },
    scoreBig: {
        fontFamily: 'Outfit-Black',
        fontSize: wp(10),
        color: '#fff',
    },
    scoreLabelSmall: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(2.5),
        color: '#666',
        marginTop: -hp(0.5),
    },
    scoreFeedback: {
        flex: 1,
    },
    feedbackTitle: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4.5),
        color: '#fff',
        marginBottom: 4,
    },
    feedbackDesc: {
        fontFamily: 'Outfit-Regular',
        fontSize: wp(3.2),
        color: '#888',
        lineHeight: 18,
    },
    gridContainer: {
        paddingHorizontal: wp(5),
        marginBottom: hp(3),
    },
    gridRow: {
        flexDirection: 'row',
        gap: wp(3),
    },
    gridCard: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 20,
        padding: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    gridSubtitleCard: {
        flex: 1,
        backgroundColor: '#111',
        borderRadius: 20,
        padding: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    gridVal: {
        fontFamily: 'Outfit-Black',
        fontSize: wp(4.8),
        color: '#fff',
        marginTop: hp(1),
    },
    gridLab: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3),
        color: '#666',
    },
    linkCard: {
        marginHorizontal: wp(5),
        marginBottom: hp(3),
    },
    linkGrad: {
        borderRadius: 20,
        padding: wp(5),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    linkInfo: {
        flex: 1,
    },
    linkTitle: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4),
        color: '#000',
    },
    linkDesc: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3.2),
        color: '#111',
        opacity: 0.8,
    },
    mapSection: {
        paddingHorizontal: wp(5),
    },
    sectionHeading: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4.2),
        color: '#fff',
        marginBottom: hp(2),
    },
    mapWrapper: {
        height: hp(22),
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#0d0d0d',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    map: {
        flex: 1,
    },
    mapLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expandBtn: {
        position: 'absolute',
        top: 15,
        right: 15,
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    tripSummaryCard: {
        marginHorizontal: wp(5),
        marginBottom: hp(3),
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 24,
        padding: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    tripSummaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    tripSummaryTitle: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4),
        color: '#fff',
    },
    tripDateRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    tripDateText: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3),
        color: '#888',
        marginLeft: wp(1),
    },
    summaryStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: hp(1.5),
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 16,
    },
    summaryStatItem: {
        flex: 1,
        alignItems: 'center',
    },
    summaryStatVal: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4.2),
        color: '#fff',
    },
    summaryStatLab: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(2.8),
        color: '#666',
        marginTop: 2,
    },
    summaryStatDivider: {
        width: 1,
        height: hp(3),
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    tipsSection: {
        marginTop: hp(2),
    },
    insightBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: wp(3),
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
    },
    insightIconWrap: {
        width: wp(8),
        height: wp(8),
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: wp(3),
    },
    insightText: {
        flex: 1,
        fontFamily: 'Outfit-Regular',
        fontSize: wp(3.4),
        color: '#ccc',
        lineHeight: hp(2),
    },
    mapHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    cityBadge: {
        backgroundColor: 'rgba(255,191,0,0.1)',
        paddingHorizontal: wp(3),
        paddingVertical: hp(0.5),
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,191,0,0.2)',
    },
    cityText: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(3),
        color: '#FFBF00',
    },
    addressFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: hp(1.5),
        paddingHorizontal: wp(2),
    },
    addressText: {
        fontFamily: 'Outfit-Medium',
        fontSize: wp(3.2),
        color: '#888',
        marginLeft: wp(2),
        flex: 1,
    },
    eventDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
        borderWidth: 1,
        borderColor: '#fff',
    },
    fullMapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: wp(4),
        backgroundColor: '#111',
    },
    closeBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#222',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fullMapTitle: {
        fontFamily: 'Outfit-Bold',
        fontSize: wp(4.5),
        color: '#fff',
        marginLeft: wp(4),
    },
    markerContainer: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    labelPill: {
        backgroundColor: '#10B981',
        paddingHorizontal: wp(2),
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 2,
    },
    labelText: {
        color: '#fff',
        fontSize: wp(2),
        fontFamily: 'Outfit-Bold',
    },
    pinStart: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#10B981',
        borderWidth: 2,
        borderColor: '#fff',
    },
    pinEnd: {
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#EF4444',
        borderWidth: 2,
        borderColor: '#fff',
    },
    sosFab: {
        position: 'absolute',
        bottom: hp(4),
        right: wp(6),
        width: wp(18),
        height: wp(18),
        borderRadius: wp(9),
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 6,
        borderWidth: 2,
        borderColor: '#fff',
    },
    integritySection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: hp(2),
        paddingVertical: hp(1),
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    integrityItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    integrityLabel: {
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Medium',
        color: '#888',
        marginLeft: wp(1.5),
    },
    ecoRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginTop: hp(1.5),
    },
    ecoIconCircle: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: wp(2.5),
        paddingVertical: hp(0.5),
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.02)',
    },
    ecoValue: {
        fontSize: wp(3),
        fontFamily: 'Outfit-Bold',
        color: '#666',
        marginLeft: wp(1.5),
    },
    eventMarkerWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
        borderRadius: 20,
    },
    eventMarkerInner: {
        width: wp(5),
        height: wp(5),
        borderRadius: wp(2.5),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: '#fff',
    },
    eventTriangle: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 4,
        borderRightWidth: 4,
        borderTopWidth: 6,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginTop: -1,
    },
});
