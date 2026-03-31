import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Dimensions, Alert,
    KeyboardAvoidingView, Platform
} from 'react-native';
import {
    ArrowLeft, ArrowRight, Car, Bike, Check, Calendar, Hash, Type,
    ShieldCheck, ClipboardCheck, Info, Gauge, Bookmark
} from 'lucide-react-native';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import LoaderButton from '../../components/Button';

const { width } = Dimensions.get('window');

type AddVehicleScreenProps = {
    onBack?: () => void;
    onDone: (newVehicle: Vehicle) => void;
    isFirst?: boolean;
    initialRegistrationNumber?: string;
};

type Step = 'INPUT' | 'CONFIRM';

const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'EV', 'HYBRID', 'OTHER'];
const VEHICLE_TYPES = ['CAR', 'BIKE'];

export const AddVehicleScreen = ({ onBack, onDone, isFirst, initialRegistrationNumber }: AddVehicleScreenProps) => {
    const [step, setStep] = useState<Step>('INPUT');
    const [verifyLoading, setVerifyLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [form, setForm] = useState({
        registrationNumber: '',
        make: '',
        model: '',
        variant: '',
        year: '',
        fuelType: 'PETROL' as const,
        vehicleType: 'CAR' as 'CAR' | 'BIKE',
        registrationDate: '',
        chassisNumber: '',
        engineNumber: '',
        currentOdometer: '',
        rtoDetails: null as any,
    });

    React.useEffect(() => {
        if (initialRegistrationNumber) {
            updateForm('registrationNumber', initialRegistrationNumber);
            autoVerify(initialRegistrationNumber);
        }
    }, [initialRegistrationNumber]);

    const autoVerify = async (plate: string) => {
        setVerifyLoading(true);
        try {
            const rtoData = await vehicleService.verifyVehicle(plate);
            setForm(prev => ({
                ...prev,
                registrationNumber: plate,
                make: rtoData.make || rtoData.brand || '',
                model: rtoData.model || '',
                vehicleType: (rtoData.vehicleType as any) || prev.vehicleType,
                fuelType: (rtoData.fuelType as any) || prev.fuelType,
                chassisNumber: rtoData.chassisNo || rtoData.chassisNumber || '',
                engineNumber: rtoData.engineNo || rtoData.engineNumber || '',
                registrationDate: rtoData.regDate || rtoData.registrationDate || '',
                year: rtoData.year ? String(rtoData.year) : prev.year,
                rtoDetails: rtoData,
            }));
            setStep('CONFIRM');
        } catch (error: any) {
            console.warn('[AddVehicleScreen] autoVerify failed:', error);
            // Fallback to manual input stage if auto-verify fails, but pre-fill plate
        } finally {
            setVerifyLoading(false);
        }
    };

    const updateForm = (key: string, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleProceedToConfirm = () => {
        if (!form.registrationNumber || !form.make || !form.model) {
            Alert.alert("Required Fields", "Please fill Registration Number, Brand, and Model.");
            return;
        }
        setStep('CONFIRM');
    };

    const handleVerifyVehicle = async () => {
        if (form.registrationNumber.length < 7 || verifyLoading || saveLoading) {
            return;
        }

        setVerifyLoading(true);
        try {
            const rtoData = await vehicleService.verifyVehicle(form.registrationNumber);
            setForm(prev => ({
                ...prev,
                make: rtoData.make || rtoData.brand || '',
                model: rtoData.model || '',
                vehicleType: (rtoData.vehicleType as any) || prev.vehicleType,
                fuelType: (rtoData.fuelType as any) || prev.fuelType,
                chassisNumber: rtoData.chassisNo || rtoData.chassisNumber || '',
                engineNumber: rtoData.engineNo || rtoData.engineNumber || '',
                registrationDate: rtoData.regDate || rtoData.registrationDate || '',
                year: rtoData.year ? String(rtoData.year) : prev.year,
                rtoDetails: rtoData,
            }));
            setStep('CONFIRM');
        } catch (error: any) {
            Alert.alert("Verification Failed", error?.message || "Could not verify vehicle details.");
        } finally {
            setVerifyLoading(false);
        }
    };

    const handleSave = async () => {
        if (saveLoading || verifyLoading) {
            return;
        }

        setSaveLoading(true);
        try {
            const vehicleData = {
                registrationNumber: form.registrationNumber.toUpperCase().replace(/\s/g, ''),
                make: form.make,
                model: form.model,
                variant: form.variant,
                year: form.year ? Number(form.year) : undefined,
                fuelType: form.fuelType,
                vehicleType: form.vehicleType,
                currentOdometer: form.currentOdometer ? Number(form.currentOdometer) : undefined,
                registrationDate: form.registrationDate ? new Date(form.registrationDate).toISOString() : undefined,
                chassisNumber: form.chassisNumber,
                engineNumber: form.engineNumber,
                ...form.rtoDetails, // Spread additional RTO details
            };

            const result = await vehicleService.addVehicle(vehicleData as any);

            onDone(result);
        } catch (error: any) {
            console.error('[AddVehicleScreen] handleSave error:', error);
            Alert.alert('Error', error?.message || 'Failed to save vehicle.');
        } finally {
            setSaveLoading(false);
        }
    };

    const handleBackStep = () => {
        if (step === 'CONFIRM') {
            setStep('INPUT');
        } else {
            onBack?.();
        }
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeftContainer}>
                    <TouchableOpacity onPress={handleBackStep} style={styles.backBtn}>
                        <ArrowLeft size={28} color="#FFF" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { marginLeft: 8 }]}>
                        {step === 'INPUT' ? 'Add Vehicle' : 'Confirm Details'}
                    </Text>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {step === 'INPUT' ? (
                        <>
                            <Text style={styles.sectionTitle}>Vehicle Identification</Text>

                                {/* Plate Input */}
                                <View style={styles.inputGroup}>
                                    <View style={styles.plateInputContainer}>
                                        <View style={styles.indStrip}>
                                            <Text style={styles.flagEmoji}>🇮🇳</Text>
                                            <Text style={styles.indText}>IND</Text>
                                        </View>
                                        <TextInput
                                            style={styles.plateInput}
                                            placeholder="MH12AB1234"
                                            placeholderTextColor="#333"
                                            value={form.registrationNumber}
                                            onChangeText={t => updateForm('registrationNumber', t.toUpperCase())}
                                            autoCapitalize="characters"
                                            maxLength={15}
                                            editable={!verifyLoading && !saveLoading}
                                        />
                                    </View>
                                    
                                    {/* Inline Proceed Button */}
                                    <LoaderButton
                                        title="Verify Vehicle"
                                        loading={verifyLoading}
                                        loadingTitle="Verifying..."
                                        titleStyle={[
                                            styles.inlineProceedText,
                                            (form.registrationNumber.length < 7 || verifyLoading || saveLoading) && styles.inlineProceedTextDisabled,
                                        ]}
                                        loadingTitleStyle={styles.inlineProceedText}
                                        style={[
                                            styles.inlineProceedBtn, 
                                            (form.registrationNumber.length < 7 || verifyLoading || saveLoading) && styles.inlineProceedBtnDisabled
                                        ]}
                                        onPress={handleVerifyVehicle}
                                        disabled={form.registrationNumber.length < 7 || saveLoading}
                                    />
                                </View>
                        </>
                    ) : (
                        /* ── CONFIRM STEP ── */
                        <>
                            <View style={styles.confirmHeader}>
                                <View style={styles.typeBadge}>
                                    {form.vehicleType === 'BIKE' ? <Bike size={14} color="#000" /> : <Car size={14} color="#000" />}
                                    <Text style={styles.typeBadgeText}>{form.vehicleType}</Text>
                                </View>
                                <Text style={styles.confirmTitle}>Review Vehicle Info</Text>
                                <Text style={styles.confirmSub}>Please verify the details before saving to your garage.</Text>
                            </View>

                            <View style={styles.confirmCard}>
                                <ConfirmRow label="REGISTRATION PLATE" value={form.registrationNumber || '—'} accent />
                                <Divider />
                                <ConfirmRow label="BRAND & MODEL" value={`${form.make} ${form.model}` || '—'} />
                                <Divider />
                                <ConfirmRow label="VARIANT" value={form.variant || '—'} />
                                <Divider />
                                <ConfirmRow label="YEAR" value={form.year || '—'} />
                                <Divider />
                                <ConfirmRow label="FUEL TYPE" value={form.fuelType || '—'} />
                                <Divider />
                                <ConfirmRow label="CURRENT ODOMETER" value={form.currentOdometer ? `${form.currentOdometer} KM` : '—'} />
                                <Divider />
                                <ConfirmRow label="REGISTRATION DATE" value={form.registrationDate || 'NOT PROVIDED'} />
                                <Divider />
                                <ConfirmRow label="CHASSIS NUMBER" value={form.chassisNumber || 'NOT PROVIDED'} />
                                <Divider />
                                <ConfirmRow label="ENGINE NUMBER" value={form.engineNumber || 'NOT PROVIDED'} />
                            </View>

                            <View style={styles.infoBox}>
                                <Info size={16} color={COLORS.primary} />
                                <Text style={styles.infoText}>
                                    Vehicle images will be automatically assigned based on your model type.
                                </Text>
                            </View>

                            <LoaderButton
                                title="CONFIRM & SAVE VEHICLE"
                                loading={saveLoading}
                                loadingTitle="Saving..."
                                style={[styles.saveBtn, saveLoading && styles.saveBtnLoading]}
                                onPress={handleSave}
                                disabled={verifyLoading}
                            />

                            <TouchableOpacity
                                style={styles.editBtn}
                                onPress={() => setStep('INPUT')}
                                disabled={saveLoading || verifyLoading}
                            >
                                <Text style={styles.editBtnText}>EDIT DETAILS</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};

// ── Helpers ──
const Divider = () => <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 2 }} />;

const ConfirmRow = ({ label, value, accent }: { label: string; value: string; accent?: boolean }) => (
    <View style={styles.confirmRow}>
        <Text style={styles.confirmLabel}>{label}</Text>
        <Text style={[styles.confirmValue, accent && { color: COLORS.primary, fontSize: 16 }]}>{value}</Text>
    </View>
);

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 50,
        paddingBottom: 20
    },
    backBtn: {
        width: 44, height: 44,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: -10, // Pull slightly left to align with padding
    },
    headerLeftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFF' },
    content: { paddingHorizontal: 24 },
    sectionTitle: {
        fontSize: 12, fontWeight: '900', color: COLORS.primary,
        letterSpacing: 2, marginTop: 24, marginBottom: 16,
        textTransform: 'uppercase'
    },
    inputGroup: { marginBottom: 20 },
    label: { color: COLORS.textMuted, fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },

    // Plate Input (Production Black)
    plateInputContainer: {
        backgroundColor: '#050505', borderRadius: 12, overflow: 'hidden',
        flexDirection: 'row', alignItems: 'center', height: 68,
        borderWidth: 1, borderColor: '#333'
    },
    indStrip: { backgroundColor: '#003399', width: 44, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
    flagEmoji: { fontSize: 14, lineHeight: 18 },
    indText: { color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
    plateInput: { flex: 1, paddingHorizontal: 16, fontSize: 26, fontWeight: '900', color: '#FFF', letterSpacing: 2 },

    // Inline Proceed
    inlineProceedBtn: {
        backgroundColor: '#FFF',
        height: 54,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    inlineProceedBtnDisabled: {
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#333',
    },
    inlineProceedText: {
        color: '#000',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 1,
    },
    inlineProceedTextDisabled: {
        color: '#555',
    },

    // Divider
    orSeparatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    orLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    orText: {
        color: COLORS.textMuted,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1.5,
        paddingHorizontal: 16,
    },

    // Type Chips
    typeContainer: { flexDirection: 'row', gap: 10, paddingBottom: 4 },
    typeChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border
    },
    typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typeChipText: { color: '#888', fontSize: 11, fontWeight: 'bold' },
    typeChipTextActive: { color: '#000' },

    // Standard Input
    inputWrap: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface,
        borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, height: 56
    },
    inputIcon: { marginLeft: 16 },
    input: { flex: 1, color: '#FFF', paddingHorizontal: 12, fontSize: 15, fontWeight: '600' },
    row: { flexDirection: 'row' },

    // Fuel Chips
    fuelContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    fuelChip: {
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30,
        backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border
    },
    fuelChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    fuelText: { color: '#888', fontSize: 11, fontWeight: 'bold' },
    fuelTextActive: { color: '#000' },

    // Primary Toggle
    primaryToggleCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.surface, padding: 20, borderRadius: 24,
        marginTop: 20, borderWidth: 1, borderColor: COLORS.border
    },
    primaryTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
    primarySub: { color: '#666', fontSize: 11, marginTop: 2 },

    // Confirm Step Styles
    confirmHeader: { alignItems: 'center', marginTop: 20, marginBottom: 32 },
    typeBadge: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
    typeBadgeText: { color: '#000', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    confirmTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic' },
    confirmSub: { color: '#888', fontSize: 12, textAlign: 'center', marginTop: 8, maxWidth: '80%' },
    confirmCard: { backgroundColor: COLORS.surface, borderRadius: 32, padding: 24, borderWidth: 1, borderColor: COLORS.border },
    confirmRow: { paddingVertical: 14 },
    confirmLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    confirmValue: { color: '#FFF', fontSize: 14, fontWeight: '900', fontStyle: 'italic' },
    infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,215,0,0.05)', padding: 16, borderRadius: 16, marginTop: 24, gap: 12, borderWidth: 1, borderColor: 'rgba(255,215,0,0.1)' },
    infoText: { color: '#888', fontSize: 11, flex: 1, fontWeight: '500' },
    saveBtn: {
        backgroundColor: COLORS.primary, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center', marginTop: 32,
        elevation: 5
    },
    saveBtnLoading: { backgroundColor: '#333' },
    editBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 8 },
    editBtnText: { color: '#888', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 }
});
