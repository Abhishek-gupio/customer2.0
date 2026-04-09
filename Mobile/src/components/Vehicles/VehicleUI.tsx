import { View, Text, StyleSheet, TouchableOpacity, Platform, Dimensions } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const { width } = Dimensions.get('window');

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
    error: '#FF453A',
    lightBlack: '#1A1A1A',
    lightBg: '#2C2C2E'
};

export const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';

export const INDPlate = ({ number }: { number: string }) => (
    <View style={styles.plate}>
        <View style={styles.indStrip}>
            <Text style={styles.flag}>🇮🇳</Text>
            <Text style={styles.indText}>IND</Text>
        </View>
        <Text style={styles.plateNo}>{number}</Text>
    </View>
);

export const InfoCard = ({ icon: Icon, label, value, style }: { icon: any, label: string, value: string | number, style?: any }) => (
    <View style={[styles.card, style]}>
        <View style={styles.iconBox}>
            {Icon && <Icon size={20} color={COLORS.primary} />}
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
        </View>
    </View>
);

export const StatusCard = ({ icon: Icon, label, value, onPress, style }: { icon: any, label: string, value: string, onPress?: () => void, style?: any }) => (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={[styles.statusCard, style]} activeOpacity={0.8}>
        <View style={styles.statusContentMain}>
            <View style={styles.statusHeaderRow}>
                <View style={styles.statusIconBoxSmall}>
                    {Icon && <Icon size={16} color={COLORS.primary} />}
                </View>
                <Text style={styles.statusLabel}>{label}</Text>
            </View>
            <Text style={styles.statusValue}>{value}</Text>
        </View>
        <View style={styles.statusAction}>
            <Text style={styles.actionText}>Check</Text>
            <ChevronRight size={16} color={COLORS.primary} />
        </View>
    </TouchableOpacity>
);

export const GloveboxItem = ({ label, icon: Icon, onPress }: { label: string, icon: any, onPress: () => void }) => (
    <TouchableOpacity onPress={onPress} style={styles.gloveboxItem}>
        <View style={styles.gloveboxIconBox}>
            {Icon && <Icon size={20} color="#FFF" />}
        </View>
        <Text style={styles.gloveboxLabel} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    plate: {
        flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 8,
        alignSelf: 'center', borderWidth: 1, borderColor: '#EEE', overflow: 'hidden',
        height: hp('5.5%'), elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1, shadowRadius: 2
    },
    indStrip: { backgroundColor: '#003399', width: wp('8%'), alignItems: 'center', justifyContent: 'center', gap: 1 },
    flag: { fontSize: hp('1.2%'), lineHeight: hp('1.5%') },
    indText: { color: '#FFF', fontSize: hp('0.8%'), fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
    plateNo: { 
        paddingHorizontal: wp('4%'), justifyContent: 'center', color: '#000', 
        fontSize: hp('2.5%'), fontFamily: 'Outfit-Bold', letterSpacing: 1, textAlignVertical: 'center',
        paddingVertical: Platform.OS === 'ios' ? hp('1%') : 0
    },
    card: {
        backgroundColor: COLORS.surface, padding: wp('5%'), borderRadius: 24,
        borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row',
        alignItems: 'center', gap: wp('4%')
    },
    iconBox: {
        width: wp('11%'), height: wp('11%'), backgroundColor: '#000', borderRadius: 14,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333'
    },
    label: {
        color: COLORS.textMuted, fontSize: hp('1.2%'), fontWeight: '900',
        letterSpacing: 1, textTransform: 'uppercase', marginBottom: hp('0.5%')
    },
    value: {
        color: '#FFF', fontSize: hp('1.8%'), fontWeight: '900',
        textTransform: 'uppercase'
    },
    gloveboxItem: {
        width: (wp('100%') - wp('21%')) / 4, alignItems: 'center', gap: hp('1%')
    },
    gloveboxIconBox: {
        width: '100%', aspectRatio: 1, backgroundColor: COLORS.lightBg, 
        borderRadius: 16,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333'
    },
    gloveboxLabel: {
        color: '#AAA', fontSize: hp('1.3%'), fontWeight: '600', textAlign: 'center', fontFamily: 'Outfit'
    },
    statusCard: {
        width: '100%', backgroundColor: '#0D0D0E', padding: 16, borderRadius: 24,
        borderWidth: 1, borderColor: '#1F1F1F', flexDirection: 'row', 
        alignItems: 'center', justifyContent: 'space-between',
        marginBottom: hp('1.8%')
    },
    statusLeft: {
        flexDirection: 'row', alignItems: 'center', gap: 16, flex: 1
    },
    statusIconBox: {
        width: 44, height: 44, backgroundColor: '#000', borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1F1F1F'
    },
    statusContentMain: {
        flex: 1, flexDirection: 'column', gap: 12
    },
    statusHeaderRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10
    },
    statusIconBoxSmall: {
        width: 32, height: 32, backgroundColor: '#000', borderRadius: 8,
        alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#1F1F1F'
    },
    statusLabel: {
        color: '#8E8E93', fontSize: hp('1.1%'), fontFamily: 'Outfit-Bold', textTransform: 'uppercase', letterSpacing: 1.5
    },
    statusValue: {
        color: '#FFF', fontSize: hp('1.8%'), fontFamily: 'Outfit-Black'
    },
    statusAction: {
        flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.08)', 
        paddingVertical: 8, paddingHorizontal: 14, borderRadius: 14, gap: 4, marginLeft: 12
    },
    actionText: {
        color: COLORS.primary, fontSize: hp('1.4%'), fontFamily: 'Outfit-Bold'
    }
});
