import React, { useEffect, useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import {
    Trash2, FileText, Wrench, AlertCircle, User, Settings,
    ShieldCheck, Droplets, Cpu, CheckCircle2, Star, Tag, Gauge,
    Clock, FileCheck, Activity, IdCard, Weight, Building, Plus, Type,
    Calendar, Bookmark
} from 'lucide-react-native';
import BackButton from '../../components/BackButton';
import { COLORS, FALLBACK_IMAGE, InfoCard, INDPlate } from '../../components/Vehicles/VehicleUI';
import { Vehicle } from '../../services/vehicleService';
import { api } from '../../services/api';
import ShareScreen from './Share';
import { getProfile } from '../../services/profileService';

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
    const heroSrc = (!heroError && (activeVehicle.imageUrl || activeVehicle.rtoDetails?.imageUrl))
        ? { uri: activeVehicle.imageUrl || activeVehicle.rtoDetails?.imageUrl }
        : { uri: FALLBACK_IMAGE };

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

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                {/* ── Hero ── */}
                <View style={styles.detailHero}>
                    <View style={styles.heroImgBox}>
                        <View style={styles.heroGlow} />
                        <Image
                            source={heroSrc}
                            style={styles.heroFallbackImage}
                            resizeMode="cover"
                            onError={() => setHeroError(true)}
                        />
                    </View>

                    <Text style={styles.detailModel}>
                        {activeVehicle.model || activeVehicle.make || 'Vehicle'}
                    </Text>
                    <View style={{ marginTop: 16, alignItems: 'center' }}>
                        <INDPlate number={activeVehicle.registrationNumber} />
                        {activeVehicle.isPrimary && (
                            <View style={styles.primaryBadge}>
                                <Star size={10} color="#000" fill="#000" />
                                <Text style={styles.primaryBadgeText}>PRIMARY VEHICLE</Text>
                            </View>
                        )}
                    </View>

                    {/* ── Vehicle switcher strip ── */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.horizVehicleList}
                    >
                        <TouchableOpacity onPress={onAddNew} style={styles.addMiniBtn}>
                            <Plus size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        {vehicles
                            .filter(v => !v.__optimistic)   // don't show pending vehicles in switcher
                            .map((v: Vehicle) => (
                                <TouchableOpacity
                                    key={v.id}
                                    onPress={() => setActiveVehicle(v)}
                                    style={[
                                        styles.miniAvatarWrap,
                                        activeVehicle.id === v.id && styles.miniAvatarActive
                                    ]}
                                >
                                    <View style={styles.miniAvatar}>
                                        <Image
                                            source={{ uri: v.imageUrl || v.rtoDetails?.imageUrl || FALLBACK_IMAGE }}
                                            style={StyleSheet.absoluteFill}
                                            resizeMode="cover"
                                            onError={(_e) => { /* silent — FALLBACK_IMAGE is already the src */ }}
                                        />
                                    </View>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </View>

                <View style={styles.contentPad}>
                    {/* ═══════════════════════════════════════════════════════
                        ALERTS TAB — uses real rtoDetails data
                    ═══════════════════════════════════════════════════════ */}
                    {mainTab === 'Alerts' ? (
                        <View style={{ gap: 16 }}>
                            <InfoCard icon={FileText} label="CHALLAN" value="0" />
                            <View style={styles.rowGrid}>
                                <View style={{ flex: 1 }}>
                                    <InfoCard
                                        icon={ShieldCheck}
                                        label="INSURANCE"
                                        value={rto?.insuranceUpto ? `${getInsuranceStatus()}\n${rto.insuranceUpto}` : 'UNKNOWN'}
                                        style={{ padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}
                                    />
                                </View>
                                <View style={{ width: 16 }} />
                                <View style={{ flex: 1 }}>
                                    <InfoCard
                                        icon={AlertCircle}
                                        label="PUC"
                                        value={rto?.pollutionUpto ? `${getPucStatus()}\n${rto.pollutionUpto}` : 'UNKNOWN'}
                                        style={{ padding: 16, flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}
                                    />
                                </View>
                            </View>

                            {/* ── Feedback card ── */}
                            <View style={styles.feedbackCard}>
                                {submittedFeedback ? (
                                    <View style={{ alignItems: 'center', paddingVertical: 24 }}>
                                        <View style={styles.successIconBox}>
                                            <CheckCircle2 size={32} color={COLORS.primary} />
                                        </View>
                                        <Text style={styles.feedbackTitle}>Thank you!</Text>
                                        <Text style={styles.feedbackSub}>Your feedback helps us improve.</Text>
                                        <TouchableOpacity onPress={() => setSubmittedFeedback(null)}>
                                            <Text style={styles.resetFeedback}>GIVE ANOTHER FEEDBACK</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <>
                                        <Text style={styles.feedbackTitle}>Help us improve Gupio</Text>
                                        <View style={styles.starRow}>
                                            {[1, 2, 3, 4, 5].map(s => (
                                                <TouchableOpacity key={s} onPress={() => setRating(s)}>
                                                    <Star
                                                        size={36}
                                                        color={s <= rating ? COLORS.primary : '#333'}
                                                        fill={s <= rating ? COLORS.primary : 'transparent'}
                                                    />
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <TextInput
                                            style={styles.feedbackInput}
                                            placeholder="Share your thoughts here..."
                                            placeholderTextColor="#555"
                                            multiline
                                            value={feedback}
                                            onChangeText={setFeedback}
                                        />
                                        <TouchableOpacity
                                            onPress={handleFeedbackSubmit}
                                            disabled={!rating || isSubmitting}
                                            style={[
                                                styles.primaryBtn,
                                                (!rating || isSubmitting) && { backgroundColor: '#333' },
                                                { marginTop: 24 }
                                            ]}
                                        >
                                            {isSubmitting
                                                ? <ActivityIndicator color="#000" />
                                                : <Text style={[styles.primaryBtnText, (!rating || isSubmitting) && { color: '#666' }]}>SUBMIT FEEDBACK</Text>
                                            }
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>

                    ) : (
                        /* ═══════════════════════════════════════════════════════
                           DETAILS TAB — uses real rtoDetails + DB vehicle fields
                        ═══════════════════════════════════════════════════════ */
                        <View>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.subTabRow}
                            >
                                {(['Owner', 'Vehicle', 'Specs', 'Dates', 'More'] as SubTab[]).map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        onPress={() => setSubTab(t)}
                                        style={[styles.subTab, subTab === t && styles.subTabActive]}
                                    >
                                        <Text style={[styles.subTabText, subTab === t && { color: COLORS.primary }]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={{ gap: 16 }}>
                                {subTab === 'Owner' && (
                                    <>
                                        <InfoCard icon={User} label="Owner Name" value={'Self'} />
                                        <InfoCard icon={Building} label="RTO Office" value={'Auto Detected'} />
                                    </>
                                )}

                                {subTab === 'Vehicle' && (
                                    <>
                                        <TouchableOpacity 
                                            style={[styles.premiumStatusCard, activeVehicle.isPrimary && styles.premiumStatusActive]}
                                            onPress={() => !activeVehicle.isPrimary && onSetPrimary(activeVehicle.id)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={styles.statusGlow} />
                                            <View style={styles.statusContent}>
                                                <View style={styles.statusIconBox}>
                                                    <ShieldCheck size={20} color={activeVehicle.isPrimary ? COLORS.primary : '#444'} />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.statusTitle}>Garage Priority</Text>
                                                    <Text style={styles.statusDesc}>
                                                        {activeVehicle.isPrimary 
                                                            ? 'This vehicle is set as your primary choice.' 
                                                            : 'Set as primary for quick home-screen access.'}
                                                    </Text>
                                                </View>
                                                {!activeVehicle.isPrimary && (
                                                    <View style={styles.setPriorityBtn}>
                                                        <Text style={styles.setPriorityText}>SET</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </TouchableOpacity>

                                        <InfoCard icon={Wrench} label="Model" value={activeVehicle.model || 'Unknown'} />
                                        <InfoCard icon={Bookmark} label="Variant" value={activeVehicle.variant || 'N/A'} />
                                        <InfoCard icon={Type} label="Brand" value={activeVehicle.make || 'Unknown'} />
                                        <InfoCard icon={Cpu} label="Chassis No." value={activeVehicle.chassisNumber || 'N/A'} />
                                        <InfoCard icon={Droplets} label="Fuel Type" value={activeVehicle.fuelType || 'PETROL'} />
                                    </>
                                )}

                                {subTab === 'Specs' && (
                                    <>
                                        <InfoCard icon={Gauge} label="Current Odometer" value={activeVehicle.currentOdometer ? `${activeVehicle.currentOdometer} KM` : 'N/A'} />
                                        <InfoCard icon={Tag} label="Price Range" value={rto?.priceRange || 'N/A'} />
                                        <InfoCard icon={Star} label="Rating" value={rto?.rating ? `${rto.rating} / 5` : 'N/A'} />
                                        <InfoCard icon={Settings} label="Trans." value={rto?.transmission || 'N/A'} />
                                    </>
                                )}

                                {subTab === 'Dates' && (
                                    <>
                                        <InfoCard icon={Calendar} label="Reg. Year" value={activeVehicle.year || 'N/A'} />
                                        <InfoCard icon={Clock} label="Reg. Date" value={
                                            activeVehicle.registrationDate
                                                ? new Date(activeVehicle.registrationDate).toLocaleDateString()
                                                : rto?.regDate || 'N/A'
                                        } />
                                        <InfoCard icon={FileCheck} label="Fitness Upto" value={rto?.fitnessUpto || 'N/A'} />
                                        <InfoCard icon={Activity} label="Insurance" value={rto?.insuranceUpto || 'N/A'} />
                                    </>
                                )}

                                {subTab === 'More' && (
                                    <>
                                        <InfoCard icon={IdCard} label="Reg Number" value={activeVehicle.registrationNumber} />
                                        <InfoCard icon={Weight} label="Weight" value={rto?.unloadedWeight || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="RC Status" value={rto?.rcStatus || (activeVehicle.isActive ? 'ACTIVE' : 'INACTIVE')} />
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
    screen: { flex: 1, backgroundColor: COLORS.background },
    header: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 20, minHeight: 80 },
    topRoundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    tabPillContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 30, padding: 4, borderWidth: 1, borderColor: COLORS.border, width: 220 },
    tabPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 30 },
    tabPillActive: { backgroundColor: COLORS.primary },
    tabPillText: { fontSize: 12, fontFamily: 'Outfit-Black', color: '#888' },
    detailHero: { alignItems: 'center', paddingHorizontal: 24, marginTop: 20 },
    heroImgBox: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    heroFallbackImage: { width: 280, height: 160, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    heroGlow: { position: 'absolute', width: 250, height: 150, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: 150 },
    detailModel: { fontSize: 32, fontFamily: 'Outfit-Black', color: '#FFF', textAlign: 'center' },
    horizVehicleList: { paddingHorizontal: 24, paddingVertical: 24, gap: 16, alignItems: 'center' },
    addMiniBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255, 215, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', alignItems: 'center', justifyContent: 'center' },
    miniAvatarWrap: { width: 68, height: 68, borderRadius: 34, padding: 4, borderWidth: 2, borderColor: 'transparent', backgroundColor: COLORS.surface },
    miniAvatarActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(255, 215, 0, 0.1)' },
    miniAvatar: { flex: 1, borderRadius: 34, backgroundColor: '#000', overflow: 'hidden' },
    primaryBadge: { 
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, 
        paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 12, gap: 4 
    },
    primaryBadgeText: { color: '#000', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    contentPad: { paddingHorizontal: 24 },
    feedbackCard: { backgroundColor: COLORS.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: COLORS.border, marginTop: 32, alignItems: 'center' },
    feedbackTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', fontStyle: 'italic', marginBottom: 8 },
    feedbackSub: { fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 },
    starRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
    feedbackInput: { width: '100%', backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, height: 120, padding: 20, color: '#FFF', textAlignVertical: 'top' },
    successIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    resetFeedback: { fontSize: 10, fontWeight: '900', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 1, borderBottomColor: COLORS.primary },
    subTabRow: { marginBottom: 32, borderBottomWidth: 1, borderBottomColor: '#333' },
    subTab: { paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    subTabActive: { borderBottomColor: COLORS.primary },
    subTabText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
    rowGrid: { flexDirection: 'row', alignItems: 'stretch' },
    rowGridMulti: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    primaryBtn: { backgroundColor: COLORS.primary, height: 62, borderRadius: 18, alignItems: 'center', justifyContent: 'center', width: '100%' },
    primaryBtnText: { color: '#000', fontSize: 16, fontFamily: 'Outfit-Black' },
    premiumStatusCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        overflow: 'hidden'
    },
    premiumStatusActive: {
        borderColor: COLORS.primary + '60',
        backgroundColor: COLORS.primary + '10'
    },
    statusGlow: {
        position: 'absolute',
        top: -20,
        right: -20,
        width: 100,
        height: 100,
        backgroundColor: COLORS.primary + '10',
        borderRadius: 50
    },
    statusContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16
    },
    statusIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border
    },
    statusTitle: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
    },
    statusDesc: {
        color: '#888',
        fontSize: 11,
        fontFamily: 'Outfit-Regular',
        marginTop: 2
    },
    setPriorityBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12
    },
    setPriorityText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900'
    }
});
