import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');
import {
    Trash2, FileText, Wrench, AlertCircle, User, Settings,
    ShieldCheck, Droplets, Cpu, CheckCircle2, Star, Tag, Gauge,
    Clock, FileCheck, Activity, IdCard, Weight, Building, Plus, Type,
    Calendar, Bookmark, Upload
} from 'lucide-react-native';
import BackButton from '../../components/BackButton';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { COLORS, FALLBACK_IMAGE, InfoCard, INDPlate, GloveboxItem, StatusCard } from '../../components/Vehicles/VehicleUI';
import { Vehicle } from '../../services/vehicleService';
import { api } from '../../services/api';
import ShareScreen from './Share';
import { getProfile } from '../../services/profileService';

const CarImage = require('../../assets/images/car_vehicle_demo.png') as any;
const BikeImage = require('../../assets/images/bike.png') as any;

type DetailsScreenProps = {
    vehicles: Vehicle[];
    activeVehicle: Vehicle | null;
    setActiveVehicle: (v: Vehicle) => void;
    onBack: () => void;
    onAddNew: () => void;
    onDelete: (id: string) => void;
    onSetPrimary: (id: string) => void;
};

type MainTab = 'Alerts' | 'Details';
type SubTab = 'Owner' | 'Vehicle' | 'Specs' | 'Dates' | 'More';

export const DetailsScreen = ({
    vehicles, activeVehicle, setActiveVehicle, onBack, onAddNew, onDelete, onSetPrimary
}: DetailsScreenProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [mainTab, setMainTab] = useState<MainTab>('Alerts');
    const [subTab, setSubTab] = useState<SubTab>('Vehicle');   // fixed: was 'Vehicle' but docs said 'Alerts'
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedFeedback, setSubmittedFeedback] = useState<any>(null);
    const [shareVisible, setShareVisible] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareAccessList, setShareAccessList] = useState<any[]>([]);
    const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const profile = await getProfile();
                if (mounted) setCurrentCustomerId(profile.id);
            } catch {
                if (mounted) setCurrentCustomerId(null);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    // Hero image error state must be defined BEFORE any early returns
    const [heroError, setHeroError] = useState(false);

    if (!activeVehicle) return null;

    // rtoDetails comes from the Gemini lookup, merged into the vehicle object
    // by AddVehicleScreen → onDone → GupioGarageApp state.
    const rto = activeVehicle.rtoDetails;

    // Hero image source
    const heroSrc = activeVehicle.vehicleType === 'BIKE' ? BikeImage : CarImage;

    const handleFeedbackSubmit = () => {
        if (!rating) return;
        setIsSubmitting(true);
        setTimeout(() => {
            setSubmittedFeedback({ rating, text: feedback });
            setIsSubmitting(false);
            setRating(0);
            setFeedback('');
        }, 1500);
    };

    const handleDeletePress = () => {
        Alert.alert(
            'Remove Vehicle',
            `Remove ${activeVehicle.registrationNumber} from your garage?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete(activeVehicle.id) },
            ]
        );
    };

    const openShare = async () => {
        if (!activeVehicle) return;
        setShareVisible(true);
        try {
            const res: any = await api.get(`/v1/sharing/vehicle/${activeVehicle.id}/access`);
            const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            const mapped = raw.map((row: any, idx: number) => ({
                id: idx + 1,
                name: row.customer?.fullName || 'User',
                role:
                    row.role === 'OWNER'
                        ? 'Owner'
                        : row.role === 'EDITOR'
                            ? 'Editor'
                            : row.role === 'DRIVER'
                                ? 'Driver'
                                : 'Viewer',
                phone: row.customer?.phoneNumber ? `+91 ${row.customer.phoneNumber}` : '',
                status: 'active' as const,
            }));
            setShareAccessList(mapped);
        } catch {
            setShareAccessList([]);
        }
    };

    const handleInvite = async (phone: string, role: 'Editor' | 'Viewer' | 'Driver') => {
        if (!activeVehicle) return;
        setShareLoading(true);
        try {
            await api.post('/v1/sharing/share', {
                vehicleId: activeVehicle.id,
                phoneNumber: phone,
                role: role.toUpperCase(),
            });
        } finally {
            setShareLoading(false);
        }
    };

    const handleRevoke = async (_userId: number) => {
        // TODO: wire revoke once we expose specific access IDs in the mobile payload
        return;
    };

    // ── Helper: alert status badge ───────────────────────────────────────────
    const getInsuranceStatus = (): string => {
        if (!rto?.insuranceUpto) return 'UNKNOWN';
        const expiry = new Date(rto.insuranceUpto);
        return expiry > new Date() ? 'VALID' : 'EXPIRED';
    };

    const getPucStatus = (): string => {
        if (!rto?.pollutionUpto) return 'UNKNOWN';
        const expiry = new Date(rto.pollutionUpto);
        return expiry > new Date() ? 'VALID' : 'EXPIRED';
    };

    return (
        <View style={styles.screen}>
            {/* ── Header ── */}
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <BackButton onPress={onBack} />

                <View style={styles.tabPillContainer}>
                    {(['Alerts', 'Details'] as MainTab[]).map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setMainTab(t)}
                            style={[styles.tabPill, mainTab === t && styles.tabPillActive]}
                        >
                            <Text style={[styles.tabPillText, mainTab === t && { color: '#000' }]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {currentCustomerId && activeVehicle.customerId === currentCustomerId && (
                        <TouchableOpacity onPress={openShare} style={styles.topRoundBtn}>
                            <User size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleDeletePress} style={styles.topRoundBtn}>
                        <Trash2 size={22} color="#FF453A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* ── Hero section as per mockup ── */}
                <View style={styles.heroSection}>
                    <Image
                        source={heroSrc}
                        style={styles.heroImage}
                        resizeMode="contain"
                        onError={() => setHeroError(true)}
                    />
                    
                    <Text style={styles.brandName}>{activeVehicle.make?.toUpperCase() || 'VEHICLE'}</Text>
                    <Text style={styles.modelName}>{activeVehicle.model?.toUpperCase() || 'MODEL'}</Text>
                    
                    <View style={styles.heroPlateBox}>
                        <INDPlate number={activeVehicle.registrationNumber} />
                    </View>

                    {/* ── Vehicle switcher circle icons ── */}
                    <View style={styles.switcherRow}>
                        <TouchableOpacity onPress={onAddNew} style={styles.addCircleBtn}>
                            <Plus size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        {vehicles
                            .filter(v => !v.__optimistic)
                            .map((v: Vehicle) => (
                                <TouchableOpacity
                                    key={v.id}
                                    onPress={() => setActiveVehicle(v)}
                                    style={[
                                        styles.miniCircleWrap,
                                        activeVehicle.id === v.id && styles.miniCircleActive
                                    ]}
                                >
                                    <View style={[styles.miniCircleInner, activeVehicle.id === v.id && { borderColor: COLORS.primary }]}>
                                        <Image
                                            source={v.vehicleType === 'BIKE' ? BikeImage : CarImage}
                                            style={StyleSheet.absoluteFill}
                                            resizeMode="cover"
                                        />
                                    </View>
                                    {activeVehicle.id === v.id && (
                                        <Text style={styles.activeMiniLabel} numberOfLines={1}>
                                            {v.registrationNumber}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            ))}
                    </View>
                </View>

                {/* ── Tab Content ── */}
                <View style={styles.sectionPad}>
                    {mainTab === 'Alerts' ? (
                        <>
                            {/* ── Status Grid (Challans & PUCC) ── */}
                            <View style={styles.statusGrid}>
                                <StatusCard 
                                    icon={FileText} 
                                    label="challans" 
                                    value="CHECK NOW" 
                                />
                                <StatusCard 
                                    icon={ShieldCheck} 
                                    label="PUCC" 
                                    value="ACTIVE" 
                                />
                            </View>

                            {/* ── Your Glovebox ── */}
                            <View style={{ marginTop: 32 }}>
                                <Text style={styles.sectionHeading}>YOUR GLOVEBOX</Text>
                                <View style={styles.gloveboxGrid}>
                                    <GloveboxItem label="reg certificate" icon={Upload} onPress={() => {}} />
                                    <GloveboxItem label="driver's licence" icon={Upload} onPress={() => {}} />
                                    <GloveboxItem label="insurance policy" icon={Upload} onPress={() => {}} />
                                    <GloveboxItem label="puc certificate" icon={Upload} onPress={() => {}} />
                                </View>
                                
                                <TouchableOpacity 
                                    style={styles.viewAllDocsBtn}
                                    onPress={() => navigation.navigate('DocumentList')}
                                >
                                    <Text style={styles.viewAllDocsText}>View all documents</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        /* ── Details Tab (Sub-Tab Navigation) ── */
                        <View>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false} 
                                contentContainerStyle={styles.subTabNav}
                            >
                                {(['Owner', 'Vehicle', 'Specs', 'Dates', 'More'] as SubTab[]).map(st => (
                                    <TouchableOpacity 
                                        key={st} 
                                        onPress={() => setSubTab(st)}
                                        style={[styles.subTabItem, subTab === st && styles.subTabItemActive]}
                                    >
                                        <Text style={[styles.subTabText, subTab === st && styles.subTabTextActive]}>
                                            {st}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={styles.detailsSpecsContainer}>
                                {subTab === 'Owner' && (
                                    <>
                                        <InfoCard icon={User} label="Owner Name" value={rto?.ownerName || 'Unknown'} />
                                        <InfoCard icon={Building} label="RTO Office" value={rto?.rto || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="RC Status" value={rto?.rcStatus || 'ACTIVE'} />
                                    </>
                                )}
                                {subTab === 'Vehicle' && (
                                    <>
                                        <InfoCard icon={Tag} label="Brand" value={activeVehicle.make || 'Unknown'} />
                                        <InfoCard icon={Star} label="Model" value={activeVehicle.model || 'Unknown'} />
                                        <InfoCard icon={Type} label="Variant" value={activeVehicle.variant || 'N/A'} />
                                        <InfoCard icon={Droplets} label="Fuel Type" value={activeVehicle.fuelType || 'Petrol'} />
                                        <InfoCard icon={Gauge} label="Fuel Norms" value={rto?.fuelNorms || 'BS VI'} />
                                    </>
                                )}
                                {subTab === 'Specs' && (
                                    <>
                                        <InfoCard icon={Cpu} label="Engine No." value={rto?.engineNo || 'N/A'} />
                                        <InfoCard icon={Activity} label="Chassis No." value={activeVehicle.chassisNumber || 'N/A'} />
                                        <InfoCard icon={Weight} label="Unloaded Weight" value={rto?.unloadedWeight || 'N/A'} />
                                        <InfoCard icon={Type} label="Transmission" value={rto?.transmission || 'N/A'} />
                                    </>
                                )}
                                {subTab === 'Dates' && (
                                    <>
                                        <InfoCard icon={Calendar} label="Reg. Date" value={rto?.regDate || 'N/A'} />
                                        <InfoCard icon={Clock} label="Reg. Year" value={activeVehicle.year?.toString() || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="Insurance Upto" value={rto?.insuranceUpto || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="Pollution Upto" value={rto?.pollutionUpto || 'N/A'} />
                                        <InfoCard icon={Calendar} label="Fitness Upto" value={rto?.fitnessUpto || 'N/A'} />
                                    </>
                                )}
                                {subTab === 'More' && (
                                    <>
                                        <InfoCard icon={Gauge} label="Mileage" value={rto?.mileage || 'N/A'} />
                                        <InfoCard icon={Tag} label="Price Range" value={rto?.priceRange || 'N/A'} />
                                        <InfoCard icon={User} label="Registration Authority" value={rto?.rto || 'N/A'} />
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            <ShareScreen
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                vehicle={{
                    vehicleNumber: activeVehicle.registrationNumber,
                    model: activeVehicle.model || activeVehicle.make || 'Vehicle',
                    brand: activeVehicle.make,
                }}
                accessList={shareAccessList}
                onInvite={handleInvite}
                onRevoke={handleRevoke}
                isLoading={shareLoading}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    header: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 20, minHeight: 80 },
    topRoundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    tabPillContainer: { 
        flexDirection: 'row', 
        backgroundColor: COLORS.surface, 
        borderRadius: 30, 
        padding: 4, 
        borderWidth: 1, 
        borderColor: COLORS.border, 
        width: 180,
        marginHorizontal: 16
    },
    tabPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 30 },
    tabPillActive: { backgroundColor: COLORS.primary },
    tabPillText: { fontSize: 12, fontFamily: 'Outfit-Black', color: '#888' },
    
    // Hero Section
    heroSection: { alignItems: 'center', paddingBottom: 16 },
    heroImage: { width: width * 0.8, height: 160, marginBottom: -10 },
    brandName: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 4, textTransform: 'uppercase' },
    modelName: { fontSize: 32, fontWeight: '900', color: '#FFF', marginTop: -5 },
    heroPlateBox: { marginTop: 12 },

    // Switcher Row
    switcherRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 40, paddingHorizontal: 24 },
    addCircleBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 215, 0, 0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
    miniCircleWrap: { alignItems: 'center', gap: 4 },
    miniCircleInner: { width: 64, height: 64, borderRadius: 32, padding: 4, borderWidth: 2, borderColor: '#333', backgroundColor: '#1A1A1A', overflow: 'hidden' },
    miniCircleActive: { transform: [{ scale: 1.1 }] },
    activeMiniLabel: { fontSize: 9, fontFamily: 'Outfit-Black', color: COLORS.primary, position: 'absolute', bottom: -18, textAlign: 'center', width: 80 },

    sectionPad: { paddingHorizontal: 24, paddingTop: 20 },
    sectionHeading: { fontSize: 10, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 1.5, marginBottom: 16 },

    // Status Boxes
    statusGrid: { flexDirection: 'row', gap: 12 },
    statusBox: { 
        flex: 1, backgroundColor: '#0A0A0A', padding: 24, borderRadius: 24, 
        flexDirection: 'column', alignItems: 'center', gap: 16, 
        borderWidth: 1, borderColor: '#1F1F1F'
    },



    // Glovebox
    gloveboxGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    viewAllDocsBtn: { marginTop: 24, borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#1A1A1A' },
    viewAllDocsText: { color: COLORS.primary, fontSize: 13, fontFamily: 'Outfit-Black', textTransform: 'uppercase', letterSpacing: 1.5 },

    // Details Sub-Tabs
    subTabNav: { paddingBottom: 16, gap: 12 },
    subTabItem: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
    subTabItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    subTabText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#888' },
    subTabTextActive: { color: '#000' },

    detailsSpecsContainer: { gap: 16, marginTop: 10 }
});
