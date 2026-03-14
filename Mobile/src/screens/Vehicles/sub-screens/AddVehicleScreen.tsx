import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    StyleSheet, Dimensions, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import { 
    ArrowLeft, Car, Bike, Check, Calendar, Hash, Type, 
    Bookmark
} from 'lucide-react-native';
import { COLORS } from '../../../components/Vehicles/VehicleUI';
import { vehicleService, Vehicle } from '../../../services/vehicleService';

const { width } = Dimensions.get('window');

type AddVehicleScreenProps = {
    onBack?: () => void;
    onDone: (newVehicle: Vehicle) => void;
    isFirst?: boolean;
};



const FUEL_TYPES = ['PETROL', 'DIESEL', 'CNG', 'EV', 'HYBRID', 'OTHER'];
const VEHICLE_TYPES = ['SEDAN', 'SUV', 'LUV', 'HATCHBACK', 'BIKE', 'TRUCK'];

export const AddVehicleScreen = ({ onBack, onDone, isFirst }: AddVehicleScreenProps) => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        registrationNumber: '',
        make: '',
        model: '',
        variant: '',
        year: '',
        fuelType: 'PETROL' as const,
        vehicleType: 'SEDAN' as 'SEDAN' | 'BIKE' | 'SUV' | 'LUV' | 'HATCHBACK' | 'TRUCK',
        registrationDate: '',
        chassisNumber: '',
        engineNumber: '',
    });

    const updateForm = (key: string, value: any) => {
        setForm(prev => ({ ...prev, [key]: value }));
    };

    const handleProceedToSave = () => {
        if (!form.registrationNumber || !form.make || !form.model) {
            Alert.alert("Required Fields", "Please fill Registration Number, Brand, and Model.");
            return;
        }
        handleSave();
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const payload = {
                ...form,
                registrationNumber: form.registrationNumber.toUpperCase().replace(/\s/g, ''),
                year: form.year ? parseInt(form.year) : undefined,
                registrationDate: form.registrationDate ? new Date(form.registrationDate).toISOString() : undefined
            };


            const saved = await vehicleService.addVehicle(payload as any);
            
            onDone(saved);
        } catch (error: any) {
            console.error('[AddVehicleScreen] handleSave error:', error);
            Alert.alert('Error', error?.message || 'Failed to save vehicle.');
        } finally {
            setLoading(false);
        }
    };

    const handleBackPress = () => {
        onBack?.();
    };

    return (
        <View style={styles.screen}>
            {/* Header */}
            <View style={styles.header}>
                {!isFirst ? (
                    <TouchableOpacity onPress={handleBackPress} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                ) : <View style={{ width: 44 }} />}
                
                <Text style={styles.headerTitle}>Add Vehicle</Text>
                <View style={{ width: 44 }} />
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
                    <Text style={styles.sectionTitle}>Vehicle Identification</Text>
                            
                            {/* Plate Input */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>REGISTRATION NUMBER</Text>
                                <View style={styles.plateInputContainer}>
                                    <View style={styles.indStrip}>
                                        <View style={styles.indDot} />
                                        <Text style={styles.indText}>IND</Text>
                                    </View>
                                    <TextInput
                                        style={styles.plateInput}
                                        placeholder="MH12AB1234"
                                        placeholderTextColor="#444"
                                        value={form.registrationNumber}
                                        onChangeText={t => updateForm('registrationNumber', t.toUpperCase())}
                                        autoCapitalize="characters"
                                        maxLength={15}
                                    />
                                </View>
                            </View>

                            {/* Type Toggle */}
                            <View style={styles.typeToggleContainer}>
                                <TouchableOpacity 
                                    style={[styles.typeOption, form.vehicleType !== 'BIKE' && styles.typeOptionActive]}
                                    onPress={() => updateForm('vehicleType', 'SEDAN')}
                                >
                                    <Car size={24} color={form.vehicleType !== 'BIKE' ? '#000' : '#FFF'} />
                                    <Text style={[styles.typeLabel, form.vehicleType !== 'BIKE' && styles.typeLabelActive]}>Car</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.typeOption, form.vehicleType === 'BIKE' && styles.typeOptionActive]}
                                    onPress={() => updateForm('vehicleType', 'BIKE')}
                                >
                                    <Bike size={24} color={form.vehicleType === 'BIKE' ? '#000' : '#FFF'} />
                                    <Text style={[styles.typeLabel, form.vehicleType === 'BIKE' && styles.typeLabelActive]}>Bike</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={styles.sectionTitle}>Basic Details</Text>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>BRAND</Text>
                                    <View style={styles.inputWrap}>
                                        <Type size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Tata"
                                            placeholderTextColor="#555"
                                            value={form.make}
                                            onChangeText={t => updateForm('make', t)}
                                        />
                                    </View>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>MODEL</Text>
                                    <View style={styles.inputWrap}>
                                        <Car size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. Nexon"
                                            placeholderTextColor="#555"
                                            value={form.model}
                                            onChangeText={t => updateForm('model', t)}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>VARIANT</Text>
                                    <View style={styles.inputWrap}>
                                        <Bookmark size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="e.g. XZ+"
                                            placeholderTextColor="#555"
                                            value={form.variant}
                                            onChangeText={t => updateForm('variant', t)}
                                        />
                                    </View>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>YEAR</Text>
                                    <View style={styles.inputWrap}>
                                        <Calendar size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="2024"
                                            placeholderTextColor="#555"
                                            value={form.year}
                                            onChangeText={t => updateForm('year', t)}
                                            keyboardType="numeric"
                                            maxLength={4}
                                        />
                                    </View>
                                </View>
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>FUEL TYPE</Text>
                                <View style={styles.fuelContainer}>
                                    {FUEL_TYPES.map(fuel => (
                                        <TouchableOpacity 
                                            key={fuel}
                                            style={[styles.fuelChip, form.fuelType === fuel && styles.fuelChipActive]}
                                            onPress={() => updateForm('fuelType', fuel)}
                                        >
                                            <Text style={[styles.fuelText, form.fuelType === fuel && styles.fuelTextActive]}>{fuel}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <Text style={styles.sectionTitle}>RC Information (Optional)</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>REGISTRATION DATE (OPTIONAL)</Text>
                                <View style={styles.inputWrap}>
                                    <Calendar size={18} color={COLORS.primary} style={styles.inputIcon} />
                                    <TextInput
                                        style={styles.input}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor="#555"
                                        value={form.registrationDate}
                                        onChangeText={t => updateForm('registrationDate', t)}
                                    />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                                    <Text style={styles.label}>CHASSIS NO. (OPTIONAL)</Text>
                                    <View style={styles.inputWrap}>
                                        <Hash size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Chassis Number"
                                            placeholderTextColor="#555"
                                            value={form.chassisNumber}
                                            onChangeText={t => updateForm('chassisNumber', t.toUpperCase())}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                </View>
                                <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                                    <Text style={styles.label}>ENGINE NO. (OPTIONAL)</Text>
                                    <View style={styles.inputWrap}>
                                        <Hash size={18} color={COLORS.primary} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Engine Number"
                                            placeholderTextColor="#555"
                                            value={form.engineNumber}
                                            onChangeText={t => updateForm('engineNumber', t.toUpperCase())}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                </View>
                            </View>


                            <TouchableOpacity 
                                style={[styles.primaryBtn, loading && styles.saveBtnLoading]}
                                onPress={handleProceedToSave}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <>
                                        <Text style={styles.primaryBtnText}>SAVE VEHICLE</Text>
                                        <Check size={20} color="#000" style={{ marginLeft: 8 }} />
                                    </>
                                )}
                            </TouchableOpacity>

                    <View style={{ height: 40 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
};



const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    header: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        padding: 24, 
        paddingTop: 48, 
        minHeight: 80 
    },
    backBtn: { 
        width: 44, height: 44, borderRadius: 22, 
        backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: COLORS.border
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
    content: { paddingHorizontal: 24 },
    sectionTitle: { 
        fontSize: 12, fontWeight: '900', color: COLORS.primary, 
        letterSpacing: 2, marginTop: 24, marginBottom: 16,
        textTransform: 'uppercase'
    },
    inputGroup: { marginBottom: 20 },
    label: { color: COLORS.textMuted, fontSize: 10, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
    
    // Plate Input
    plateInputContainer: { 
        backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', 
        flexDirection: 'row', alignItems: 'center', height: 60,
        elevation: 10, shadowColor: '#FFF', shadowOpacity: 0.1, shadowRadius: 10
    },
    indStrip: { backgroundColor: '#003399', width: 32, height: '100%', alignItems: 'center', justifyContent: 'center' },
    indDot: { width: 4, height: 4, backgroundColor: '#8BC34A', borderRadius: 2, marginBottom: 2 },
    indText: { color: '#FFF', fontSize: 6, fontWeight: '900' },
    plateInput: { flex: 1, paddingHorizontal: 16, fontSize: 22, fontWeight: '900', color: '#000', letterSpacing: 2 },

    // Type Toggle
    typeToggleContainer: { flexDirection: 'row', gap: 16, marginTop: 8 },
    typeOption: { 
        flex: 1, height: 100, borderRadius: 24, backgroundColor: COLORS.surface,
        borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center'
    },
    typeOptionActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    typeLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginTop: 8 },
    typeLabelActive: { color: '#000' },

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

    primaryBtn: { 
        backgroundColor: COLORS.primary, height: 64, borderRadius: 32,
        alignItems: 'center', justifyContent: 'center', marginTop: 40,
        flexDirection: 'row'
    },
    primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '900', fontStyle: 'italic' },

    saveBtnLoading: { backgroundColor: '#333' }
});
