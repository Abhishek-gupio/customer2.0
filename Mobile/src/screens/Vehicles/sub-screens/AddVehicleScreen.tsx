import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Dimensions, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform
} from 'react-native';
import { ArrowLeft, Search, CheckCircle, Car, Bike } from 'lucide-react-native';
import { COLORS } from '../../../components/Vehicles/VehicleUI';
import { vehicleService, Vehicle, RTODetails, isValidIndianPlate } from '../../../services/vehicleService';

const { height } = Dimensions.get('window');

type AddVehicleScreenProps = {
    onBack?: () => void;
    onDone: (newVehicle: Vehicle) => void;
    isFirst?: boolean;
};

type Step = 'LOOKUP' | 'CONFIRM';
type VehicleKind = 'CAR' | 'BIKE';

export const AddVehicleScreen = ({ onBack, onDone, isFirst }: AddVehicleScreenProps) => {
    const [step, setStep] = useState<Step>('LOOKUP');
    const [vNo, setVNo] = useState('');
    const [model, setModel] = useState('');
    const [kind, setKind] = useState<VehicleKind>('CAR');
    const [rtoDetails, setRtoDetails] = useState<RTODetails | null>(null);
    const [lookupLoading, setLookupLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [plateError, setPlateError] = useState('');

    // Maps kind → backend image lookup hint + DB vehicleType enum
    const KIND_CONFIG = {
        CAR:  { modelHint: 'sedan car',       vehicleType: 'SEDAN' as const, placeholder: 'e.g. Swift, Verna, City' },
        BIKE: { modelHint: 'bike motorcycle',  vehicleType: 'BIKE'  as const, placeholder: 'e.g. Splendor, Pulsar, Activa' },
    };

    const cfg = KIND_CONFIG[kind];

    // ── STEP 1: Lookup ─────────────────────────────────────────────────────────
    const handleLookup = async () => {
        const cleaned = vNo.toUpperCase().replace(/\s/g, '');
        if (!isValidIndianPlate(cleaned)) {
            setPlateError('Enter a valid plate (e.g. MH04AB1234)');
            return;
        }
        setPlateError('');
        setLookupLoading(true);
        try {
            // Combine user's model text with the kind hint so backend picks the right image
            const modelHint = model
                ? `${model} ${cfg.modelHint}`.trim()
                : cfg.modelHint;

            const rtoData = await vehicleService.fetchVehicleData(cleaned, modelHint);
            setRtoDetails(rtoData ?? null);
            setStep('CONFIRM');
        } catch (e) {
            console.error('[AddVehicleScreen] handleLookup error:', e);
            setRtoDetails(null);
            setStep('CONFIRM');
        } finally {
            setLookupLoading(false);
        }
    };

    // ── STEP 2: Save ──────────────────────────────────────────────────────────
    const handleSave = async () => {
        setSaveLoading(true);
        try {
            // Normalize fuelType to match backend Zod enum
            let normalizedFuel = (rtoDetails?.fuelType || 'PETROL').toUpperCase().trim();
            if (normalizedFuel.includes('PETROL')) normalizedFuel = 'PETROL';
            else if (normalizedFuel.includes('DIESEL')) normalizedFuel = 'DIESEL';
            else if (normalizedFuel.includes('CNG')) normalizedFuel = 'CNG';
            else if (normalizedFuel.includes('EV') || normalizedFuel.includes('ELECTRIC')) normalizedFuel = 'EV';
            else if (normalizedFuel.includes('HYBRID')) normalizedFuel = 'HYBRID';
            else normalizedFuel = 'OTHER';

            const saved = await vehicleService.addVehicle({
                registrationNumber: vNo.toUpperCase().replace(/\s/g, ''),
                make: rtoDetails?.brand || (kind === 'BIKE' ? 'Bike' : 'Car'),
                model: model.trim() || rtoDetails?.brand || (kind === 'BIKE' ? 'Bike' : 'Car'),
                fuelType: normalizedFuel as any,
                vehicleType: cfg.vehicleType,
                chassisNumber: rtoDetails?.chassisNo,
                engineNumber: rtoDetails?.engineNo,
                // Ensure date is in a parseable format or null
                registrationDate: (() => {
                    if (!rtoDetails?.regDate) return undefined;
                    const parsed = new Date(rtoDetails.regDate);
                    return isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
                })(),
            });
            onDone({ ...saved, rtoDetails: rtoDetails ?? undefined });
        } catch (error: any) {
            console.error('[AddVehicleScreen] handleSave error:', error);
            // Show more detailed error if possible
            const errorMsg = error?.response?.data?.error || error?.message || 'Failed to save vehicle.';
            Alert.alert('Error', errorMsg);
        } finally {
            setSaveLoading(false);
        }
    };

    const handleBack = () => {
        if (step === 'CONFIRM') { setStep('LOOKUP'); return; }
        onBack?.();
    };

    // ─── Render ───────────────────────────────────────────────────────────────
    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                {(!isFirst || step === 'CONFIRM') && (
                    <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                )}
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView 
                    style={{ flex: 1 }}
                    contentContainerStyle={[styles.content, { flexGrow: 1 }]} 
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Brand */}
                    <View style={styles.brandRow}>
                        <View style={styles.brandLogo}>
                            <Search size={26} color="black" />
                        </View>
                        <Text style={styles.brandText}>
                            GUPIO <Text style={{ color: COLORS.primary }}>GARAGE</Text>
                        </Text>
                    </View>

                    {step === 'LOOKUP' ? (
                        <>
                            <Text style={styles.title}>Add your vehicle</Text>
                            <Text style={styles.sub}>
                                Choose Car or Bike, then enter your plate number.
                            </Text>

                            {/* ── Car / Bike Toggle ── */}
                            <View style={styles.kindToggleRow}>
                                <TouchableOpacity
                                    style={[styles.kindBtn, kind === 'CAR' && styles.kindBtnActive]}
                                    onPress={() => setKind('CAR')}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.kindIconWrap, kind === 'CAR' && styles.kindIconWrapActive]}>
                                        <Car
                                            size={36}
                                            color={kind === 'CAR' ? '#000' : '#555'}
                                            strokeWidth={kind === 'CAR' ? 2.5 : 1.5}
                                        />
                                    </View>
                                    <Text style={[styles.kindLabel, kind === 'CAR' && styles.kindLabelActive]}>
                                        CAR
                                    </Text>
                                    {kind === 'CAR' && <View style={styles.activePip} />}
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.kindBtn, kind === 'BIKE' && styles.kindBtnActive]}
                                    onPress={() => setKind('BIKE')}
                                    activeOpacity={0.85}
                                >
                                    <View style={[styles.kindIconWrap, kind === 'BIKE' && styles.kindIconWrapActive]}>
                                        <Bike
                                            size={36}
                                            color={kind === 'BIKE' ? '#000' : '#555'}
                                            strokeWidth={kind === 'BIKE' ? 2.5 : 1.5}
                                        />
                                    </View>
                                    <Text style={[styles.kindLabel, kind === 'BIKE' && styles.kindLabelActive]}>
                                        BIKE
                                    </Text>
                                    {kind === 'BIKE' && <View style={styles.activePip} />}
                                </TouchableOpacity>
                            </View>

                            {/* ── Decorative graphic ── */}
                            <View style={styles.graphic}>
                                <View style={styles.glow} />
                                {kind === 'BIKE' ? (
                                    <Bike size={96} color={COLORS.primary} strokeWidth={1} />
                                ) : (
                                    <View style={styles.carSilhouette}>
                                        <View style={[styles.carBody, { width: 190, height: 80 }]} />
                                        <View style={[styles.carRoof, { width: 110, height: 54 }]} />
                                    </View>
                                )}
                            </View>
                        </>
                    ) : (
                        /* ── CONFIRM step ── */
                        <>
                            <Text style={styles.title}>Confirm Details</Text>
                            <Text style={styles.sub}>
                                {rtoDetails
                                    ? 'RTO data fetched. Review & save.'
                                    : 'Could not fetch RTO data. You can still save.'}
                            </Text>

                            {/* Kind badge */}
                            <View style={styles.kindBadge}>
                                {kind === 'CAR'
                                    ? <Car size={14} color={COLORS.primary} />
                                    : <Bike size={14} color={COLORS.primary} />}
                                <Text style={styles.kindBadgeText}>{kind}</Text>
                            </View>

                            <View style={styles.confirmCard}>
                                <ConfirmRow label="PLATE" value={vNo.toUpperCase()} />
                                {rtoDetails && (
                                    <>
                                        <Divider />
                                        <ConfirmRow label="OWNER"            value={rtoDetails.ownerName    || '—'} />
                                        <Divider />
                                        <ConfirmRow label="FUEL"             value={rtoDetails.fuelType     || '—'} />
                                        <Divider />
                                        <ConfirmRow label="INSURANCE UPTO"  value={rtoDetails.insuranceUpto || '—'} accent />
                                        <Divider />
                                        <ConfirmRow label="RC STATUS"        value={rtoDetails.rcStatus     || '—'} accent />
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* ── Bottom input card ── */}
                <View style={styles.bottomCard}>
                    {step === 'LOOKUP' ? (
                        <>
                            {/* Plate number */}
                            <View style={{ marginBottom: 14 }}>
                                <Text style={styles.inputLabel}>Vehicle Number</Text>
                                <View style={[styles.plateRow, plateError ? { borderColor: COLORS.error } : {}]}>
                                    <View style={styles.indStrip}>
                                        <View style={styles.indDot} />
                                        <Text style={styles.indText}>IND</Text>
                                    </View>
                                    <TextInput
                                        style={styles.plateInput}
                                        placeholder="MH04AB1234"
                                        placeholderTextColor="#555"
                                        value={vNo}
                                        onChangeText={t => { setVNo(t); setPlateError(''); }}
                                        autoCapitalize="characters"
                                        maxLength={12}
                                        returnKeyType="search"
                                        onSubmitEditing={handleLookup}
                                        blurOnSubmit={false}
                                    />
                                </View>
                                {plateError ? <Text style={styles.errorText}>{plateError}</Text> : null}
                            </View>

                            {/* Model */}
                            <View style={{ marginBottom: 20 }}>
                                <Text style={styles.inputLabel}>Model (Optional)</Text>
                                <TextInput
                                    style={styles.modelInput}
                                    placeholder={cfg.placeholder}
                                    placeholderTextColor="#555"
                                    value={model}
                                    onChangeText={setModel}
                                    returnKeyType="done"
                                    onSubmitEditing={handleLookup}
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.primaryBtn, (!vNo || lookupLoading) && styles.primaryBtnOff]}
                                onPress={handleLookup}
                                disabled={lookupLoading || !vNo}
                            >
                                {lookupLoading
                                    ? <><ActivityIndicator color="#000" style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>FETCHING RTO DATA...</Text></>
                                    : <Text style={[styles.primaryBtnText, !vNo && { color: '#666' }]}>LOOKUP PLATE</Text>
                                }
                            </TouchableOpacity>
                        </>
                    ) : (
                        <TouchableOpacity
                            style={[styles.primaryBtn, saveLoading && styles.primaryBtnOff]}
                            onPress={handleSave}
                            disabled={saveLoading}
                        >
                            {saveLoading
                                ? <><ActivityIndicator color="#000" style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>SAVING...</Text></>
                                : <><CheckCircle size={20} color="#000" style={{ marginRight: 8 }} /><Text style={styles.primaryBtnText}>SAVE VEHICLE</Text></>
                            }
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </View>
    );
};

// ── Small helpers ─────────────────────────────────────────────────────────────
const Divider = () => <View style={{ height: 1, backgroundColor: COLORS.border }} />;

const ConfirmRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}>
        <Text style={{ color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>{label}</Text>
        <Text style={{ color: accent ? COLORS.success : '#FFF', fontSize: 14, fontWeight: '900', textTransform: 'uppercase' }}>{value}</Text>
    </View>
);

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    screen:        { flex: 1, backgroundColor: COLORS.background },
    header:        { padding: 24, paddingTop: 48, minHeight: 80 },
    backBtn:       { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
    content:       { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
    brandRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 },
    brandLogo:     { width: 48, height: 48, backgroundColor: COLORS.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    brandText:     { fontSize: 24, fontWeight: '900', color: '#FFF', fontStyle: 'italic' },
    title:         { fontSize: 22, fontWeight: 'bold', color: '#FFF', textAlign: 'center' },
    sub:           { color: '#888', fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 280 },

    // Car / Bike toggle
    kindToggleRow: { flexDirection: 'row', gap: 16, marginTop: 28, width: '100%' },
    kindBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 20,
        backgroundColor: '#111', borderRadius: 24,
        borderWidth: 1.5, borderColor: '#222',
        position: 'relative',
    },
    kindBtnActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(255,215,0,0.05)' },
    kindIconWrap: {
        width: 64, height: 64, borderRadius: 20,
        backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center',
        marginBottom: 10,
    },
    kindIconWrapActive: { backgroundColor: COLORS.primary },
    kindLabel:       { color: '#555', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
    kindLabelActive: { color: COLORS.primary },
    activePip:       { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

    // Graphic
    graphic:       { height: 140, marginTop: 28, alignItems: 'center', justifyContent: 'center', width: '100%' },
    glow:          { position: 'absolute', width: 200, height: 100, backgroundColor: 'rgba(255,215,0,0.12)', borderRadius: 100 },
    carSilhouette: { alignItems: 'center' },
    carBody:       { backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#2C2C2E' },
    carRoof:       { backgroundColor: '#1A1A1A', borderTopLeftRadius: 50, borderTopRightRadius: 50, borderWidth: 1, borderColor: '#2C2C2E', marginTop: -8 },

    // Confirm step
    kindBadge:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, backgroundColor: 'rgba(255,215,0,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,215,0,0.2)' },
    kindBadgeText: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    confirmCard:   { width: '100%', backgroundColor: COLORS.surface, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: COLORS.border, marginTop: 16 },

    // Bottom card
    bottomCard:    { backgroundColor: COLORS.surface, padding: 28, paddingBottom: height > 800 ? 44 : 28, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderTopWidth: 1, borderTopColor: COLORS.border },
    inputLabel:    { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 12, paddingHorizontal: 4 },
    plateRow:      { backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
    indStrip:      { backgroundColor: '#003399', padding: 6, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
    indDot:        { width: 4, height: 4, backgroundColor: '#8BC34A', borderRadius: 2, marginBottom: 2 },
    indText:       { color: '#FFF', fontSize: 6, fontWeight: '900' },
    plateInput:    { flex: 1, color: '#FFF', fontSize: 24, fontWeight: '900', letterSpacing: 2, paddingVertical: 10, minHeight: 60 },
    modelInput:    { backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, color: '#FFF', fontSize: 16, minHeight: 56 },
    errorText:     { color: COLORS.error, fontSize: 12, fontWeight: 'bold', marginTop: 8, paddingHorizontal: 4 },
    primaryBtn:    { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
    primaryBtnOff: { backgroundColor: '#2A2A2A' },
    primaryBtnText:{ color: '#000', fontSize: 16, fontWeight: '900', fontStyle: 'italic' },
});
