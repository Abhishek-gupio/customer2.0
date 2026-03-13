import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * GUPIO BRAND THEME CONSTANTS
 */
export const COLORS = {
    background: '#000000',
    surface: '#1C1C1E',
    border: '#2C2C2E',
    primary: '#FFD700', // Gupio Yellow
    textMain: '#FFFFFF',
    textMuted: '#8E8E93',
    success: '#32D74B',
    error: '#FF453A'
};

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';

export const INDPlate = ({ number }: { number: string }) => (
    <View style={styles.plate}>
        <View style={styles.indStrip}>
            <View style={styles.dot} />
            <Text style={styles.indText}>IND</Text>
        </View>
        <Text style={styles.plateNo}>{number}</Text>
    </View>
);

export const InfoCard = ({ icon: Icon, label, value }: { icon: any, label: string, value: string | number }) => (
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

const styles = StyleSheet.create({
    plate: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 6,
        alignSelf: 'center', borderWidth: 1, borderColor: '#DDD', overflow: 'hidden'
    },
    indStrip: { backgroundColor: '#003399', padding: 4, alignItems: 'center', justifyContent: 'center' },
    dot: { width: 4, height: 4, backgroundColor: '#8BC34A', borderRadius: 2, marginBottom: 2 },
    indText: { color: '#FFF', fontSize: 6, fontWeight: '900' },
    plateNo: { paddingHorizontal: 16, paddingVertical: 6, color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
    card: {
        backgroundColor: COLORS.surface, padding: 20, borderRadius: 32,
        borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row',
        alignItems: 'center', gap: 16
    },
    iconBox: {
        width: 48, height: 48, backgroundColor: '#000', borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333'
    },
    label: {
        color: COLORS.textMuted, fontSize: 10, fontWeight: '900',
        letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4
    },
    value: {
        color: '#FFF', fontSize: 16, fontWeight: '900',
        textTransform: 'uppercase', fontStyle: 'italic'
    }
});
