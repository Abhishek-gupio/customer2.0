import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, Dimensions, ActivityIndicator, Alert
} from 'react-native';
import {
    ArrowLeft, Plus, Trash2, FileText, Wrench, AlertCircle,
    ChevronRight, Car, User, Settings, ShieldCheck, Droplets, Gavel, Cpu,
    Search, CheckCircle2, Star, Tag, Gauge, Clock, FileCheck, Activity,
    IdCard, Weight, Building
} from 'lucide-react-native';
import { vehicleService, Vehicle } from '../../services/vehicleService';

const { width } = Dimensions.get('window');

/**
 * GUPIO BRAND THEME CONSTANTS
 */
const COLORS = {
    background: '#000000',
    surface: '#1C1C1E',
    border: '#2C2C2E',
    primary: '#FFD700', // Gupio Yellow
    textMain: '#FFFFFF',
    textMuted: '#8E8E93',
    success: '#32D74B',
    error: '#FF453A'
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';

// --- SHARED UI COMPONENTS ---
const INDPlate = ({ number }: { number: string }) => (
    <View style={styles.plate}>
        <View style={styles.indStrip}>
            <View style={styles.dot} />
            <Text style={styles.indText}>IND</Text>
        </View>
        <Text style={styles.plateNo}>{number}</Text>
    </View>
);

const InfoCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
    <View style={styles.card}>
        <View style={styles.iconBox}>
            {Icon && <Icon size={20} color={COLORS.primary} />}
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </View>
    </View>
);

// --- SCREENS ---

const AddVehicleScreen = ({ onBack, onDone, isFirst }: any) => {
    const [loading, setLoading] = useState(false);
    const [vNo, setVNo] = useState('');
    const [model, setModel] = useState('');

    const handleAdd = async () => {
        if (!vNo) return;
        setLoading(true);
        try {
            const newVehicle = await vehicleService.addVehicle({
                registrationNumber: vNo.toUpperCase(),
                model: model || "Vehicle",
                vehicleType: 'SEDAN',
                fuelType: 'PETROL'
            });
            onDone(newVehicle);
        } catch (error: any) {
            console.error(error);
            Alert.alert("Error", error?.message || "Failed to add vehicle.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.screen}>
            <View style={styles.header}>
                {!isFirst && (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <ArrowLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.addContent}>
                <View style={styles.brandRow}>
                    <View style={styles.brandLogo}>
                        <Search size={26} color="black" />
                    </View>
                    <Text style={styles.brandText}>
                        GUPIO <Text style={{ color: COLORS.primary }}>GARAGE</Text>
                    </Text>
                </View>

                <Text style={styles.addTitle}>Add your first vehicle</Text>
                <Text style={styles.addSub}>Manage every action and track health at one place.</Text>

                <View style={styles.graphicContainer}>
                    <View style={styles.glow} />
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
                        <View style={[styles.carShape, { width: 190, height: 96 }]} />
                        <View style={[styles.carShape, { width: 80, height: 64, borderTopLeftRadius: 30, borderTopRightRadius: 30 }]} />
                    </View>
                </View>
            </ScrollView>

            <View style={styles.addBottomCard}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.inputLabel}>Enter Vehicle Number</Text>
                    <View style={styles.plateInputContainer}>
                        <View style={[styles.indStrip, { borderRadius: 4 }]}>
                            <View style={styles.dot} />
                            <Text style={styles.indText}>IND</Text>
                        </View>
                        <TextInput
                            style={styles.plateInput}
                            placeholder="MH04AXXXXX"
                            placeholderTextColor="#333"
                            value={vNo}
                            onChangeText={setVNo}
                            autoCapitalize="characters"
                        />
                    </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.inputLabel}>Model (Optional)</Text>
                    <TextInput
                        style={styles.normalInput}
                        placeholder="e.g. Swift"
                        placeholderTextColor="#666"
                        value={model}
                        onChangeText={setModel}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.primaryBtn, (!vNo || loading) && { backgroundColor: '#333' }]}
                    onPress={handleAdd}
                    disabled={loading || !vNo}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={[styles.primaryBtnText, (!vNo || loading) && { color: '#666' }]}>CONTINUE</Text>
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const GarageScreen = ({ vehicles, onAdd, onSelect, onDelete }: any) => {
    // Calculate average health from vehicle health scores
    const avgHealth = Math.round(
        vehicles.reduce((acc: number, v: Vehicle) => acc + (v.healthScore?.overallScore || 0), 0) / (vehicles.length || 1)
    ) || 0;

    return (
        <View style={styles.screen}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={styles.headerIcon}>
                        <Car size={20} color="#FFF" />
                    </View>
                    <View>
                        <Text style={styles.headerTitle}>My Vehicles</Text>
                        <Text style={styles.headerSub}>{vehicles.length} vehicle(s) registered</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onAdd} style={styles.roundActionBtn}>
                    <Plus size={24} color="#000" />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}>
                <View style={styles.statsCard}>
                    <View style={[styles.statBox, { borderRightWidth: 1, borderRightColor: COLORS.border }]}>
                        <Text style={styles.statVal}>{vehicles.length}</Text>
                        <Text style={styles.statLabel}>TOTAL</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statVal, { color: COLORS.success }]}>{avgHealth}%</Text>
                        <Text style={styles.statLabel}>AVG HEALTH</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>YOUR VEHICLES</Text>

                <View style={{ gap: 16 }}>
                    {vehicles.map((v: Vehicle) => (
                        <TouchableOpacity
                            key={v.id}
                            style={styles.vehicleListCard}
                            onPress={() => onSelect(v)}
                        >
                            <View style={styles.listImgBox}>
                                <Image source={{ uri: FALLBACK_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.listTitle}>{v.registrationNumber}</Text>
                                <Text style={styles.listSub} numberOfLines={1}>{v.model || v.make || "Unknown Model"}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => onDelete(v.id)}
                                style={styles.delBtn}
                            >
                                <Trash2 size={20} color="#FF453A" />
                            </TouchableOpacity>
                            <ChevronRight size={20} color="#666" />
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity onPress={onAdd} style={styles.addNewCard}>
                        <View style={styles.addNewIcon}>
                            <Plus size={32} color={COLORS.primary} />
                        </View>
                        <View>
                            <Text style={styles.addNewTitle}>ADD NEW</Text>
                            <Text style={styles.addNewSub}>Register another</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
};

const DetailsScreen = ({ vehicles, activeVehicle, setActiveVehicle, onBack, onAddNew, onDelete }: any) => {
    const [mainTab, setMainTab] = useState('Alerts');
    const [subTab, setSubTab] = useState('Vehicle');
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedFeedback, setSubmittedFeedback] = useState<any>(null);

    const details: Vehicle = activeVehicle;

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

    return (
        <View style={styles.screen}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <TouchableOpacity onPress={onBack} style={styles.topRoundBtn}>
                    <ArrowLeft size={22} color="#FFF" />
                </TouchableOpacity>
                <View style={styles.tabPillContainer}>
                    <TouchableOpacity
                        onPress={() => setMainTab('Alerts')}
                        style={[styles.tabPill, mainTab === 'Alerts' && styles.tabPillActive]}
                    >
                        <Text style={[styles.tabPillText, mainTab === 'Alerts' && { color: '#000' }]}>Alerts</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setMainTab('Details')}
                        style={[styles.tabPill, mainTab === 'Details' && styles.tabPillActive]}
                    >
                        <Text style={[styles.tabPillText, mainTab === 'Details' && { color: '#000' }]}>Details</Text>
                    </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => onDelete(activeVehicle.id)} style={styles.topRoundBtn}>
                    <Trash2 size={22} color={COLORS.textMuted} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                <View style={styles.detailHero}>
                    <View style={styles.heroImgBox}>
                        <View style={styles.heroGlow} />
                        <Image source={{ uri: FALLBACK_IMAGE }} style={styles.heroFallbackImage} resizeMode="cover" />
                    </View>
                    <Text style={styles.detailModel}>{details.model || details.make || "Vehicle"}</Text>
                    <View style={{ marginTop: 16 }}><INDPlate number={details.registrationNumber} /></View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizVehicleList}>
                        <TouchableOpacity onPress={onAddNew} style={styles.addMiniBtn}>
                            <Plus size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        {vehicles.map((v: Vehicle) => (
                            <TouchableOpacity
                                key={v.id}
                                onPress={() => setActiveVehicle(v)}
                                style={[styles.miniAvatarWrap, activeVehicle.id === v.id && styles.miniAvatarActive]}
                            >
                                <View style={styles.miniAvatar}>
                                    <Image source={{ uri: FALLBACK_IMAGE }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View style={styles.contentPad}>
                    {mainTab === 'Alerts' ? (
                        <View style={{ gap: 16 }}>
                            <InfoCard icon={FileText} label="CHALLAN" value="0" />
                            <InfoCard icon={ShieldCheck} label="INSURANCE" value={'VALID'} />
                            <InfoCard icon={AlertCircle} label="PUC CERTIFICATE" value={'EXPIRED'} />

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
                                                    <Star size={36} color={s <= rating ? COLORS.primary : '#333'} fill={s <= rating ? COLORS.primary : 'transparent'} />
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
                                            style={[styles.primaryBtn, (!rating || isSubmitting) && { backgroundColor: '#333' }, { marginTop: 24 }]}
                                        >
                                            {isSubmitting ? <ActivityIndicator color="#000" /> : <Text style={[styles.primaryBtnText, (!rating || isSubmitting) && { color: '#666' }]}>SUBMIT FEEDBACK</Text>}
                                        </TouchableOpacity>
                                    </>
                                )}
                            </View>
                        </View>
                    ) : (
                        <View>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subTabRow}>
                                {['Owner', 'Vehicle', 'Specs', 'Dates', 'More'].map(t => (
                                    <TouchableOpacity key={t} onPress={() => setSubTab(t)} style={[styles.subTab, subTab === t && styles.subTabActive]}>
                                        <Text style={[styles.subTabText, subTab === t && { color: COLORS.primary }]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                            <View style={{ gap: 16 }}>
                                {subTab === 'Owner' && (
                                    <>
                                        <InfoCard icon={User} label="Owner Name" value={details.customerId?.substring(0, 10) || "Not Available"} />
                                        <InfoCard icon={Building} label="RTO" value={"LOCAL RTO"} />
                                    </>
                                )}
                                {subTab === 'Vehicle' && (
                                    <>
                                        <InfoCard icon={Wrench} label="Model" value={details.model || "Unknown"} />
                                        <InfoCard icon={Cpu} label="Chassis No." value={details.chassisNumber || "N/A"} />
                                        <View style={styles.rowGrid}>
                                            <View style={{ flex: 1 }}><InfoCard icon={Gavel} label="Fuel Norms" value={"BS VI"} /></View>
                                            <View style={{ width: 16 }} />
                                            <View style={{ flex: 1 }}><InfoCard icon={Droplets} label="Fuel Type" value={details.fuelType || "PETROL"} /></View>
                                        </View>
                                    </>
                                )}
                                {subTab === 'Specs' && (
                                    <View style={styles.rowGridMulti}>
                                        <View style={{ width: '47%', marginBottom: 16 }}><InfoCard icon={Tag} label="Price" value={"₹ 80K*"} /></View>
                                        <View style={{ width: '47%', marginBottom: 16 }}><InfoCard icon={Star} label="Rating" value={`4.4 / 5`} /></View>
                                        <View style={{ width: '47%' }}><InfoCard icon={Settings} label="Trans." value={"Manual"} /></View>
                                        <View style={{ width: '47%' }}><InfoCard icon={Gauge} label="Mileage" value={"45.5 km/l"} /></View>
                                    </View>
                                )}
                                {subTab === 'Dates' && (
                                    <>
                                        <InfoCard icon={Clock} label="Vehicle Age" value="Calculated from Reg" />
                                        <View style={styles.rowGrid}>
                                            <View style={{ flex: 1 }}><InfoCard icon={FileCheck} label="Registration" value={details.registrationDate ? new Date(details.registrationDate).toLocaleDateString() : "N/A"} /></View>
                                            <View style={{ width: 16 }} />
                                            <View style={{ flex: 1 }}><InfoCard icon={Activity} label="Fitness Upto" value={"N/A"} /></View>
                                        </View>
                                    </>
                                )}
                                {subTab === 'More' && (
                                    <>
                                        <InfoCard icon={IdCard} label="Reg Number" value={details.registrationNumber} />
                                        <View style={styles.rowGrid}>
                                            <View style={{ flex: 1 }}><InfoCard icon={Weight} label="Weight" value={"N/A"} /></View>
                                            <View style={{ width: 16 }} />
                                            <View style={{ flex: 1 }}><InfoCard icon={ShieldCheck} label="RC Status" value={details.isActive ? "ACTIVE" : "INACTIVE"} /></View>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

export default function GupioGarageApp() {
    const [screen, setScreen] = useState('GARAGE');
    const [vehicles, setVehicles] = useState<Vehicle[]>([]);
    const [activeVehicle, setActiveVehicle] = useState<Vehicle | null>(null);
    const [initialLoading, setInitialLoading] = useState(true);

    useEffect(() => {
        fetchVehicles();
    }, []);

    const fetchVehicles = async () => {
        try {
            const data = await vehicleService.getVehicles();
            setVehicles(data);
            if (data.length > 0 && !activeVehicle) {
                setActiveVehicle(data[0]);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setInitialLoading(false);
        }
    };

    const handleAdd = async (v: Vehicle) => {
        await fetchVehicles();
        setActiveVehicle(v);
        setScreen('GARAGE');
    };

    const handleDelete = async (id: string) => {
        try {
            await vehicleService.deleteVehicle(id);
            await fetchVehicles();
            if (activeVehicle?.id === id) {
                setActiveVehicle(null);
                setScreen('GARAGE');
            }
        } catch (error) {
            console.error(error);
        }
    };

    if (initialLoading) {
        return (
            <View style={[styles.screen, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (vehicles.length === 0 && screen === 'GARAGE') {
        return <AddVehicleScreen isFirst={true} onDone={handleAdd} />;
    }

    switch (screen) {
        case 'GARAGE':
            return <GarageScreen vehicles={vehicles} onAdd={() => setScreen('ADD')} onSelect={(v: Vehicle) => { setActiveVehicle(v); setScreen('DETAILS'); }} onDelete={handleDelete} />;
        case 'ADD':
            return <AddVehicleScreen onBack={() => setScreen('GARAGE')} onDone={handleAdd} />;
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

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: 24, paddingTop: 48, minHeight: 80 },
    backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },

    // Plate
    plate: { flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 6, alignSelf: 'center', borderWidth: 1, borderColor: '#DDD', overflow: 'hidden' },
    indStrip: { backgroundColor: '#003399', padding: 4, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 4, height: 4, backgroundColor: '#8BC34A', borderRadius: 2, marginBottom: 2 },
    indText: { color: '#FFF', fontSize: 6, fontFamily: 'Outfit-Bold' },
    plateNo: { paddingHorizontal: 16, paddingVertical: 6, color: '#000', fontSize: 18, fontFamily: 'Outfit-Bold', letterSpacing: 2 },

    // Info Card
    card: { backgroundColor: COLORS.surface, padding: 20, borderRadius: 32, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', alignItems: 'center', gap: 16 },
    iconBox: { width: 48, height: 48, backgroundColor: '#000', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    label: { color: COLORS.textMuted, fontSize: 10, fontFamily: 'Outfit-Bold', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
    value: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', textTransform: 'uppercase', fontStyle: 'italic' },

    // Add Screen
    addContent: { alignItems: 'center', paddingHorizontal: 24, paddingBottom: 40 },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 40 },
    brandLogo: { width: 48, height: 48, backgroundColor: COLORS.primary, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    brandText: { fontSize: 24, fontFamily: 'Outfit-Black', color: '#FFF', fontStyle: 'italic' },
    addTitle: { fontSize: 20, fontFamily: 'Outfit-Bold', color: '#FFF', textAlign: 'center', marginTop: 24 },
    addSub: { color: '#888', fontSize: 14, fontFamily: 'Outfit-Regular', textAlign: 'center', marginTop: 8, maxWidth: 220 },
    graphicContainer: { height: 160, marginTop: 40, alignItems: 'center', justifyContent: 'center', width: '100%' },
    glow: { position: 'absolute', width: 200, height: 100, backgroundColor: 'rgba(255, 215, 0, 0.15)', borderRadius: 100 },
    carShape: { backgroundColor: '#1A1A1A', borderTopLeftRadius: 50, borderTopRightRadius: 50, borderWidth: 1, borderTopColor: '#333', borderLeftColor: '#333', borderRightColor: '#333', borderBottomWidth: 0 },
    addBottomCard: { backgroundColor: COLORS.surface, padding: 32, paddingBottom: Dimensions.get('window').height > 800 ? 48 : 32, borderTopLeftRadius: 40, borderTopRightRadius: 40, borderTopWidth: 1, borderTopColor: COLORS.border },
    inputLabel: { color: '#888', fontSize: 12, fontFamily: 'Outfit-Bold', marginBottom: 12, paddingHorizontal: 8 },
    plateInputContainer: { backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 16 },
    plateInput: { flex: 1, color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Bold', letterSpacing: 2, padding: 0 },
    normalInput: { backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 16, color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Regular' },
    primaryBtn: { backgroundColor: COLORS.primary, paddingVertical: 18, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
    primaryBtnText: { color: '#000', fontSize: 16, fontFamily: 'Outfit-Bold', fontStyle: 'italic' },

    // Garage Screen
    headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    headerTitle: { fontSize: 20, fontFamily: 'Outfit-Bold', color: '#FFF' },
    headerSub: { fontSize: 10, color: '#888', fontFamily: 'Outfit-Bold', textTransform: 'uppercase', letterSpacing: 1 },
    roundActionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    statsCard: { backgroundColor: COLORS.surface, borderRadius: 40, padding: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 40, borderWidth: 1, borderColor: COLORS.border },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 36, fontFamily: 'Outfit-Black', color: '#FFF', marginBottom: 4 },
    statLabel: { fontSize: 10, color: '#888', fontFamily: 'Outfit-Bold', letterSpacing: 1 },
    sectionTitle: { color: '#FFF', fontSize: 24, fontFamily: 'Outfit-Black', fontStyle: 'italic', marginBottom: 20 },
    vehicleListCard: { backgroundColor: COLORS.surface, borderRadius: 32, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: COLORS.border },
    listImgBox: { width: 96, height: 80, borderRadius: 16, backgroundColor: '#000', overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
    listTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', color: '#FFF', marginBottom: 4 },
    listSub: { fontSize: 12, fontFamily: 'Outfit-Bold', color: '#888', textTransform: 'uppercase' },
    delBtn: { padding: 12, backgroundColor: 'rgba(255, 69, 58, 0.1)', borderRadius: 16 },
    addNewCard: { borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 32, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: 'rgba(255, 215, 0, 0.05)' },
    addNewIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
    addNewTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', color: COLORS.primary, fontStyle: 'italic' },
    addNewSub: { fontSize: 10, fontFamily: 'Outfit-Bold', color: '#888', textTransform: 'uppercase' },

    // Details Screen
    topRoundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    tabPillContainer: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 30, padding: 4, borderWidth: 1, borderColor: COLORS.border, width: 220 },
    tabPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 30 },
    tabPillActive: { backgroundColor: COLORS.primary },
    tabPillText: { fontSize: 12, fontFamily: 'Outfit-Bold', color: '#888' },
    detailHero: { alignItems: 'center', paddingHorizontal: 24, marginTop: 20 },
    heroImgBox: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    heroFallbackImage: { width: 280, height: 160, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
    heroGlow: { position: 'absolute', width: 250, height: 150, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderRadius: 150 },
    detailModel: { fontSize: 32, fontFamily: 'Outfit-Black', color: '#FFF', fontStyle: 'italic', textAlign: 'center' },
    horizVehicleList: { paddingHorizontal: 24, paddingVertical: 24, gap: 16, alignItems: 'center' },
    addMiniBtn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255, 215, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', alignItems: 'center', justifyContent: 'center' },
    miniAvatarWrap: { width: 68, height: 68, borderRadius: 34, padding: 4, borderWidth: 2, borderColor: 'transparent', backgroundColor: COLORS.surface },
    miniAvatarActive: { borderColor: COLORS.primary, backgroundColor: 'rgba(255, 215, 0, 0.1)' },
    miniAvatar: { flex: 1, borderRadius: 34, backgroundColor: '#000', overflow: 'hidden' },
    contentPad: { paddingHorizontal: 24 },
    feedbackCard: { backgroundColor: COLORS.surface, borderRadius: 40, padding: 32, borderWidth: 1, borderColor: COLORS.border, marginTop: 32, alignItems: 'center' },
    feedbackTitle: { fontSize: 20, fontFamily: 'Outfit-Bold', color: '#FFF', fontStyle: 'italic', marginBottom: 8 },
    feedbackSub: { fontSize: 12, fontFamily: 'Outfit-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 24 },
    starRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
    feedbackInput: { width: '100%', backgroundColor: '#000', borderWidth: 1, borderColor: COLORS.border, borderRadius: 24, height: 120, padding: 20, color: '#FFF', textAlignVertical: 'top' },
    successIconBox: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 215, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    resetFeedback: { fontSize: 10, fontFamily: 'Outfit-Bold', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 1, borderBottomWidth: 1, borderBottomColor: COLORS.primary },
    subTabRow: { marginBottom: 32, borderBottomWidth: 1, borderBottomColor: '#333' },
    subTab: { paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    subTabActive: { borderBottomColor: COLORS.primary },
    subTabText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1 },
    rowGrid: { flexDirection: 'row', alignItems: 'stretch' },
    rowGridMulti: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }
});
