import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    StatusBar, ActivityIndicator, RefreshControl, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import {
    AlertTriangle, CheckCircle, RefreshCcw,
    Calendar, MapPin, Receipt, ExternalLink, ShieldAlert
} from 'lucide-react-native';
import { COLORS, INDPlate } from '../../components/Vehicles/VehicleUI';
import { api } from '../../services/api';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';

const ChallansScreen = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { vehicle } = route.params;

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [challans, setChallans] = useState<any[]>([]);
    const [stats, setStats] = useState({ total: 0, unpaid: 0, amount: 0 });

    const fetchChallans = useCallback(async (isSync = false) => {
        if (!isSync) setLoading(true);
        try {
            let endpoint = '';
            let method: 'get' | 'post' = isSync ? 'post' : 'get';

            if (vehicle.id) {
                endpoint = isSync
                    ? `/v1/vehicles/${vehicle.id}/challans/sync`
                    : `/v1/vehicles/${vehicle.id}/challans`;
            } else if (vehicle.registrationNumber) {
                endpoint = `/v1/vehicles/plate/${vehicle.registrationNumber}/challans`;
                method = 'get'; // Plate endpoint is always GET for now
            } else {
                throw new Error('No vehicle identifier provided');
            }

            const response = await api[method](endpoint);
            const data = (response as any).data || response;

            const list = Array.isArray(data) ? data : [];
            setChallans(list);

            const unpaid = list.filter((c: any) => c.status !== 'PAID');
            const totalAmount = unpaid.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);

            setStats({
                total: list.length,
                unpaid: unpaid.length,
                amount: totalAmount
            });
        } catch (error) {
            console.error('Error fetching challans:', error);
            Alert.alert('Error', 'Failed to fetch challans. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [vehicle.id, vehicle.registrationNumber]);

    useEffect(() => {
        fetchChallans(true);
    }, [fetchChallans]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchChallans(true);
    };

    const handlePayChallan = (challan: any) => {
        Alert.alert(
            'Payment Notice',
            'Redirecting to government portal to pay this challan.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Proceed', onPress: () => {
                        // In a real app, open browser with payment URL
                    }
                }
            ]
        );
    };

    const ChallanCard = ({ item, onPay }: { item: any, onPay: (item: any) => void }) => {
        const [expanded, setExpanded] = useState(false);
        const offences = (item.violationType || '').split(' | ');
        const hasMore = offences.length > 1;

        return (
            <View style={styles.challanCard}>
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'PAID' ? '#1B3921' : '#3D1C1C' }]}>
                        <Text style={[styles.statusText, { color: item.status === 'PAID' ? '#32D74B' : '#FF453A' }]}>
                            {item.status === 'PAID' ? 'PAID' : 'UNPAID'}
                        </Text>
                    </View>
                    <Text style={styles.challanNumber}>#{item.challanNumber}</Text>
                </View>

                <View style={styles.cardBody}>
                    {/* Vertical Metadata */}
                    <View style={styles.mainInfoList}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Owner:</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{item.metadata?.ownerName || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Date:</Text>
                            <Text style={styles.infoValue}>{new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Location:</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{item.location || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>RTO:</Text>
                            <Text style={styles.infoValue} numberOfLines={1}>{item.metadata?.rtoName || 'N/A'}</Text>
                        </View>
                    </View>

                    <View style={styles.divider} />

                    {/* Offence & Amount */}
                    <View style={styles.offenceSection}>
                        <Text style={styles.offenceTitle}>{offences[0]}</Text>
                        {expanded && offences.slice(1).map((off: string, idx: number) => (
                            <Text key={idx} style={[styles.offenceTitle, { marginTop: 8, color: COLORS.primary }]}>
                                {off}
                            </Text>
                        ))}

                        <View style={styles.amountContainer}>
                            <Text style={styles.amountLabel}>Total Fine:</Text>
                            <Text style={styles.amountValue}>₹{item.amount}</Text>
                        </View>

                        <View style={styles.actionRow}>
                            {hasMore && (
                                <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.detailsToggle}>
                                    <Text style={styles.detailsToggleText}>
                                        {expanded ? 'Hide Details' : 'View Details'}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            {item.status !== 'PAID' && (
                                <TouchableOpacity style={styles.payButton} onPress={() => onPay(item)}>
                                    <Text style={styles.payButtonText}>PAY NOW</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <View style={styles.titleContainer}>
                    <Text style={styles.headerTitle}>Traffic Challans</Text>
                </View>
                <TouchableOpacity onPress={() => fetchChallans(true)} style={styles.syncBtn}>
                    <RefreshCcw size={20} color={COLORS.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
                }
            >
                {/* Vehicle Mini Info */}
                <View style={styles.vehicleInfo}>
                    <INDPlate number={vehicle.registrationNumber} />
                    <Text style={styles.vehicleModel}>{vehicle.make} {vehicle.model}</Text>
                </View>

                {/* Stats Row */}
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statLabel}>Total</Text>
                        <Text style={styles.statValue}>{stats.total}</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statLabel, { color: '#FF453A' }]}>Unpaid</Text>
                        <Text style={[styles.statValue, { color: '#FF453A' }]}>{stats.unpaid}</Text>
                    </View>
                    <View style={[styles.statBox, { flex: 1.5 }]}>
                        <Text style={styles.statLabel}>Amount Due</Text>
                        <Text style={styles.statValue}>₹{stats.amount}</Text>
                    </View>
                </View>

                {loading && !refreshing ? (
                    <View style={styles.loaderBox}>
                        <ActivityIndicator size="large" color={COLORS.primary} />
                        <Text style={styles.loaderText}>Checking Parivahan Portal...</Text>
                    </View>
                ) : challans.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <View style={styles.successIconBox}>
                            <CheckCircle size={48} color={COLORS.success} />
                        </View>
                        <Text style={styles.emptyTitle}>All Clear!</Text>
                        <Text style={styles.emptySubtitle}>No traffic violations found for this vehicle. Keep driving safe!</Text>
                    </View>
                ) : (
                    <View style={styles.listContainer}>
                        {challans.map(item => (
                            <ChallanCard
                                key={item.id}
                                item={item}
                                onPay={handlePayChallan}
                            />
                        ))}
                    </View>
                )}

                {/* Footer Tip */}
                <View style={styles.tipBox}>
                    <ShieldAlert size={18} color={COLORS.primary} />
                    <Text style={styles.tipText}>
                        Always verify challans on the official Parivahan website. Late payments may attract additional penalties.
                    </Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: wp('5%'), paddingVertical: hp('2%')
    },
    titleContainer: {
        flexDirection: 'row', alignItems: 'center', gap: wp('2%')
    },
    unpaidBadge: {
        backgroundColor: '#FF453A', borderRadius: 10, width: 20, height: 20,
        alignItems: 'center', justifyContent: 'center'
    },
    unpaidBadgeText: {
        color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Bold'
    },
    syncBtn: {
        width: wp('11%'), height: wp('11%'), borderRadius: wp('5.5%'),
        backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: '#333'
    },
    headerTitle: {
        color: '#FFF', fontSize: hp('2.2%'), fontFamily: 'Outfit-Bold'
    },
    scrollContent: { paddingHorizontal: wp('5%'), paddingBottom: hp('5%') },
    vehicleInfo: {
        alignItems: 'center', marginVertical: hp('3%'), gap: hp('1%')
    },
    vehicleModel: {
        color: '#8E8E93', fontSize: hp('1.6%'), fontFamily: 'Outfit-Medium', textTransform: 'uppercase', letterSpacing: 2
    },
    ownerInfoRow: {
        flexDirection: 'row', gap: wp('2%'), marginTop: hp('1.5%'), justifyContent: 'center'
    },
    infoPill: {
        backgroundColor: '#111', paddingHorizontal: wp('3%'), paddingVertical: hp('0.8%'),
        borderRadius: 12, borderWidth: 1, borderColor: '#222', flexDirection: 'row', gap: wp('2%'), alignItems: 'center'
    },
    pillLabel: {
        color: '#666', fontSize: hp('1%'), fontFamily: 'Outfit-Bold', letterSpacing: 0.5
    },
    pillValue: {
        color: '#FFF', fontSize: hp('1.2%'), fontFamily: 'Outfit-Medium'
    },
    statsGrid: {
        flexDirection: 'row', gap: wp('3%'), marginBottom: hp('3%')
    },
    statBox: {
        flex: 1, backgroundColor: '#111', padding: wp('4%'), borderRadius: 20,
        borderWidth: 1, borderColor: '#222', alignItems: 'center'
    },
    statLabel: {
        color: '#8E8E93', fontSize: hp('1.2%'), fontFamily: 'Outfit-Bold', textTransform: 'uppercase', marginBottom: 4
    },
    statValue: {
        color: '#FFF', fontSize: hp('2.4%'), fontFamily: 'Outfit-Black'
    },
    loaderBox: {
        minHeight: hp('55%'),
        alignItems: 'center',
        justifyContent: 'center',
        gap: hp('2%'),
    },
    loaderText: {
        color: '#8E8E93', fontSize: hp('1.6%'), fontFamily: 'Outfit-Medium'
    },
    emptyBox: {
        backgroundColor: '#111', borderRadius: 32, padding: wp('10%'),
        alignItems: 'center', borderWidth: 1, borderColor: '#222', marginTop: hp('2%')
    },
    successIconBox: {
        width: wp('20%'), height: wp('20%'), borderRadius: wp('10%'),
        backgroundColor: 'rgba(50, 215, 75, 0.1)', alignItems: 'center', justifyContent: 'center',
        marginBottom: hp('2%')
    },
    emptyTitle: {
        color: '#FFF', fontSize: hp('2.6%'), fontFamily: 'Outfit-Bold', marginBottom: hp('1%')
    },
    emptySubtitle: {
        color: '#8E8E93', fontSize: hp('1.6%'), fontFamily: 'Outfit-Regular', textAlign: 'center', lineHeight: hp('2.2%')
    },
    listContainer: { gap: hp('2%') },
    challanCard: {
        backgroundColor: '#1A1A1A', borderRadius: 24, padding: wp('5%'),
        borderWidth: 1, borderColor: '#333'
    },
    cardHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp('2%')
    },
    statusBadge: {
        paddingHorizontal: wp('3%'), paddingVertical: hp('0.5%'), borderRadius: 8
    },
    statusText: {
        fontSize: hp('1.2%'), fontFamily: 'Outfit-Bold'
    },
    challanNumber: {
        color: '#8E8E93', fontSize: hp('1.4%'), fontFamily: 'Outfit-Medium'
    },
    cardBody: { gap: hp('1.5%') },
    mainInfoList: { gap: hp('0.5%') },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    infoLabel: { color: '#666', fontSize: hp('1.4%'), fontFamily: 'Outfit-Medium' },
    infoValue: { color: '#FFF', fontSize: hp('1.4%'), fontFamily: 'Outfit-Bold', flex: 1, textAlign: 'right', marginLeft: wp('4%') },
    offenceSection: { gap: hp('1%') },
    offenceTitle: { color: COLORS.primary, fontSize: hp('1.7%'), fontFamily: 'Outfit-Bold', lineHeight: hp('2.2%') },
    amountContainer: {
        flexDirection: 'row', alignItems: 'center', gap: wp('2%'),
        marginTop: hp('0.5%'), backgroundColor: '#222', padding: wp('3%'), borderRadius: 12
    },
    actionRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hp('1%')
    },
    detailsToggle: { paddingVertical: hp('1%') },
    detailsToggleText: { color: '#8E8E93', fontSize: hp('1.4%'), fontFamily: 'Outfit-Bold', textDecorationLine: 'underline' },
    violationType: {
        color: '#FFF', fontSize: hp('2%'), fontFamily: 'Outfit-Bold', marginBottom: hp('0.5%')
    },
    detailRow: {
        flexDirection: 'row', alignItems: 'center', gap: wp('2%')
    },
    detailText: {
        color: '#8E8E93', fontSize: hp('1.5%'), fontFamily: 'Outfit-Regular'
    },
    divider: {
        height: 1, backgroundColor: '#333', marginVertical: hp('1.5%')
    },
    priceRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'
    },
    amountLabel: {
        color: '#8E8E93', fontSize: hp('1.4%'), fontFamily: 'Outfit-Medium'
    },
    amountValue: {
        color: '#FFF', fontSize: hp('2.6%'), fontFamily: 'Outfit-Black'
    },
    payButton: {
        backgroundColor: COLORS.primary, paddingHorizontal: wp('6%'), paddingVertical: hp('1.5%'), borderRadius: 12
    },
    payButtonText: {
        color: '#000', fontSize: hp('1.4%'), fontFamily: 'Outfit-Black'
    },
    tipBox: {
        flexDirection: 'row', backgroundColor: '#111', padding: wp('4%'), borderRadius: 16,
        marginTop: hp('4%'), gap: wp('3%'), alignItems: 'center', borderWidth: 1, borderColor: '#222'
    },
    tipText: {
        flex: 1, color: '#666', fontSize: hp('1.3%'), fontFamily: 'Outfit-Regular', lineHeight: hp('1.8%')
    }
});

export default ChallansScreen;
