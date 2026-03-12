import React from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, StyleSheet, Alert } from 'react-native';
import { Plus, Trash2, ChevronRight, Car, Clock } from 'lucide-react-native';
import { COLORS, FALLBACK_IMAGE } from '../../../components/Vehicles/VehicleUI';
import { Vehicle } from '../../../services/vehicleService';

type GarageListScreenProps = {
    vehicles: Vehicle[];
    onAdd: () => void;
    onSelect: (v: Vehicle) => void;
    onDelete: (id: string) => void;
};

export const GarageListScreen = ({ vehicles, onAdd, onSelect, onDelete }: GarageListScreenProps) => {
    const avgHealth = Math.round(
        vehicles
            .filter(v => !v.__optimistic) // exclude optimistic entries from health avg
            .reduce((acc: number, v: Vehicle) => acc + (v.healthScore?.overallScore || 0), 0)
        / (vehicles.filter(v => !v.__optimistic).length || 1)
    ) || 0;

    const handleDeletePress = (v: Vehicle) => {
        // Don't allow deleting an optimistic vehicle that hasn't saved yet
        if (v.__optimistic) return;

        Alert.alert(
            'Remove Vehicle',
            `Remove ${v.registrationNumber} from your garage?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete(v.id) },
            ]
        );
    };

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
                            style={[
                                styles.vehicleListCard,
                                // Dim the card while optimistic save is in-flight
                                v.__optimistic && styles.vehicleListCardOptimistic
                            ]}
                            onPress={() => !v.__optimistic && onSelect(v)}
                            activeOpacity={v.__optimistic ? 1 : 0.7}
                        >
                            <View style={styles.listImgBox}>
                                <Image
                                    source={{ uri: v.imageUrl || v.rtoDetails?.imageUrl || FALLBACK_IMAGE }}
                                    style={StyleSheet.absoluteFill}
                                    resizeMode="cover"
                                    onError={() => {}}
                                />
                                {/* Pending badge for optimistic entries */}
                                {v.__optimistic && (
                                    <View style={styles.pendingBadge}>
                                        <Clock size={10} color={COLORS.primary} />
                                    </View>
                                )}
                            </View>

                            <View style={{ flex: 1 }}>
                                <Text style={styles.listTitle}>{v.registrationNumber}</Text>
                                <Text style={styles.listSub} numberOfLines={1}>
                                    {v.__optimistic ? 'Saving...' : (v.model || v.make || 'Unknown Model')}
                                </Text>
                            </View>

                            {!v.__optimistic && (
                                <TouchableOpacity
                                    onPress={() => handleDeletePress(v)}
                                    style={styles.delBtn}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Trash2 size={20} color="#FF453A" />
                                </TouchableOpacity>
                            )}

                            <ChevronRight size={20} color={v.__optimistic ? '#333' : '#666'} />
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

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: COLORS.background },
    header: { padding: 24, paddingTop: 48, minHeight: 80 },
    headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
    headerSub: { fontSize: 10, color: '#888', fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    roundActionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center' },
    statsCard: { backgroundColor: COLORS.surface, borderRadius: 40, padding: 24, flexDirection: 'row', alignItems: 'center', marginBottom: 40, borderWidth: 1, borderColor: COLORS.border },
    statBox: { flex: 1, alignItems: 'center' },
    statVal: { fontSize: 36, fontWeight: '900', color: '#FFF', marginBottom: 4 },
    statLabel: { fontSize: 10, color: '#888', fontWeight: '900', letterSpacing: 1 },
    sectionTitle: { color: '#FFF', fontSize: 24, fontWeight: '900', fontStyle: 'italic', marginBottom: 20 },
    vehicleListCard: { backgroundColor: COLORS.surface, borderRadius: 32, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderWidth: 1, borderColor: COLORS.border },
    vehicleListCardOptimistic: { opacity: 0.5, borderColor: COLORS.primary, borderStyle: 'dashed' },
    listImgBox: { width: 96, height: 80, borderRadius: 16, backgroundColor: '#000', overflow: 'hidden', borderWidth: 1, borderColor: '#333' },
    pendingBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 8, padding: 3 },
    listTitle: { fontSize: 18, fontWeight: '900', color: '#FFF', marginBottom: 4 },
    listSub: { fontSize: 12, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' },
    delBtn: { padding: 12, backgroundColor: 'rgba(255, 69, 58, 0.1)', borderRadius: 16 },
    addNewCard: { borderWidth: 2, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 32, padding: 24, flexDirection: 'row', alignItems: 'center', gap: 20, backgroundColor: 'rgba(255, 215, 0, 0.05)' },
    addNewIcon: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
    addNewTitle: { fontSize: 18, fontWeight: '900', color: COLORS.primary, fontStyle: 'italic' },
    addNewSub: { fontSize: 10, fontWeight: 'bold', color: '#888', textTransform: 'uppercase' },
});
