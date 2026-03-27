import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useFocusEffect } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import ServiceCard from '../../components/ServiceCard';
import PremiumLoader from '../../components/PremiumLoader';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { api } from '../../services/api';
import type { RootStackParamList } from '../../navigation/types';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

const PART_TYPE_OPTIONS = [
    { label: 'Battery', value: 'BATTERY' },
    { label: 'Engine Oil', value: 'ENGINE_OIL' },
    { label: 'Oil Filter', value: 'OIL_FILTER' },
    { label: 'Air Filter', value: 'AIR_FILTER' },
    { label: 'Brake Pads', value: 'BRAKE_PADS' },
    { label: 'Brake Discs', value: 'BRAKE_DISCS' },
    // { label: 'Tyres (All)', value: 'TYRES' },
    { label: 'Tyres (Front)', value: 'TYRES_FRONT' },
    { label: 'Tyres (Rear)', value: 'TYRES_REAR' },
    { label: 'Clutch Plate', value: 'CLUTCH_PLATE' },
    { label: 'Spark Plugs', value: 'SPARK_PLUGS' },
    { label: 'Coolant', value: 'COOLANT' },
    { label: 'AC Filter', value: 'AC_FILTER' },
    { label: 'Wiper Blades', value: 'WIPER_BLADES' },
    { label: 'Headlight Bulb', value: 'HEADLIGHT_BULB' },
    { label: 'Other Part', value: 'OTHER_PART' },
];

const PART_TYPE_LABELS = PART_TYPE_OPTIONS.reduce<Record<string, string>>(
    (acc, item) => {
        acc[item.value] = item.label;
        return acc;
    },
    {}
);

const getPartLabel = (partType?: string) => {
    if (!partType) {
        return 'All';
    }

    return PART_TYPE_LABELS[partType] || partType.replace(/_/g, ' ') || 'All';
};

function mapRecordToCard(record: any): any {
    const serviceType = record.serviceType || 'SERVICE';
    const serviceLabel = serviceType.replace(/_/g, ' ');
    const partLabels = record.parts?.length
        ? record.parts.map((p: any) => {
              const partType = p.partType || '';
              return PART_TYPE_LABELS[partType] || partType.replace(/_/g, ' ') || partType;
          })
        : [];
    const date = record.serviceDate
        ? new Date(record.serviceDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
          })
        : '';
    const parts = partLabels.join(', ');
    const nextService = record.nextServiceKm
        ? `Next at ${record.nextServiceKm.toLocaleString()} km`
        : record.nextServiceDate
          ? new Date(record.nextServiceDate).toLocaleDateString('en-IN')
          : '';

    return {
        id: String(record.id),
        title: serviceLabel || 'Service',
        serviceType,
        serviceLabel,
        partLabels,
        garage: record.garageName || '-',
        date,
        odometer: record.odometerAtService
            ? `${record.odometerAtService.toLocaleString()} km`
            : undefined,
        parts: parts || undefined,
        nextService: nextService || undefined,
    };
}

type ServiceHistoryProps = NativeStackScreenProps<RootStackParamList, 'ServiceHistory'>;

export default function ServiceHistoryScreen({ navigation, route }: ServiceHistoryProps) {
    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [records, setRecords] = useState<any[]>([]);
    const [selectedFilter, setSelectedFilter] = useState('All');

    const filterOptions = useMemo(() => {
        return ['All', ...PART_TYPE_OPTIONS.map((item) => item.label)];
    }, []);

    const filteredRecords = useMemo(() => {
        if (selectedFilter === 'All') {
            return records;
        }

        return records.filter((item) =>
            Array.isArray(item.partLabels) && item.partLabels.includes(selectedFilter)
        );
    }, [records, selectedFilter]);

    const headerFilterLabel = useMemo(() => {
        return selectedFilter === 'All' ? 'All Parts' : selectedFilter;
    }, [selectedFilter]);

    const fetchData = useCallback(async () => {
        const nextSelectedFilter = getPartLabel(route?.params?.selectedPartType);
        setLoading(true);
        try {
            const vehicles = await vehicleService.getVehicles();
            const primary =
                vehicles.find((v: Vehicle) => v.isPrimary) || vehicles[0];

            if (!primary) {
                setVehicle(null);
                setRecords([]);
                setSelectedFilter(nextSelectedFilter);
                return;
            }

            setVehicle(primary);
            const res = await api.get<any>(
                `/v1/expenses/warranty/vehicles/${primary.id}/history`
            );
            const data = (res as any).data ?? res;
            setRecords(Array.isArray(data) ? data.map(mapRecordToCard) : []);
            setSelectedFilter(nextSelectedFilter);
        } catch (err) {
            console.error('Service history fetch failed:', err);
            setRecords([]);
            setSelectedFilter(nextSelectedFilter);
        } finally {
            setLoading(false);
        }
    }, [route?.params?.selectedPartType]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [fetchData])
    );

    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.backgroundGlow} />
            <View style={styles.container}>
                <LinearGradient
                    colors={['#1A1A1A', '#101010', '#090909']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    <View style={styles.header}>
                        <BackButton onPress={() => navigation?.goBack()} />
                        <View style={styles.headerTextWrap}>
                            <Text style={styles.headerTitle}>Service History</Text>
                            <Text style={styles.headerSubTitle}>
                                Track every repair and replacement
                            </Text>
                        </View>
                    </View>

                    <View style={styles.vehiclePill}>
                        <MaterialIcon name="car" size={wp(4.5)} color="#FFBF00" />
                        <Text style={styles.vehicle} numberOfLines={1}>
                            {vehicle?.registrationNumber ?? 'No primary vehicle selected'}
                        </Text>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{records.length}</Text>
                            <Text style={styles.statLabel}>Total</Text>
                        </View>

                        <View style={styles.statCard}>
                            <Text style={styles.statValue}>{filteredRecords.length}</Text>
                            <Text style={styles.statLabel}>Showing</Text>
                        </View>

                        <View style={[styles.statCard, styles.statCardWide]}>
                            <MaterialIcon
                                name="filter-variant"
                                size={wp(4)}
                                color="#FFBF00"
                            />
                            <Text style={styles.statFilter} numberOfLines={1}>
                                {headerFilterLabel}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {loading ? (
                    <View style={styles.loading}>
                        <PremiumLoader
                            size={68}
                            label="Fetching Service Records"
                        />
                    </View>
                ) : (
                    <FlatList
                        data={filteredRecords}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <ServiceCard item={item} />}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={[
                            styles.listContent,
                            filteredRecords.length === 0 &&
                                styles.listContentEmpty,
                        ]}
                        ListHeaderComponent={
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                style={styles.filterScroll}
                                contentContainerStyle={styles.filterRow}
                            >
                                {filterOptions.map((item) => {
                                    const isActive = selectedFilter === item;

                                    return (
                                        <TouchableOpacity
                                            key={item}
                                            style={styles.filterTouchable}
                                            onPress={() =>
                                                setSelectedFilter(item)
                                            }
                                            activeOpacity={0.85}
                                        >
                                            {isActive ? (
                                                <LinearGradient
                                                    colors={['#FFD466', '#FFBF00']}
                                                    start={{ x: 0, y: 0 }}
                                                    end={{ x: 1, y: 1 }}
                                                    style={[
                                                        styles.filterChip,
                                                        styles.filterChipActive,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.filterText,
                                                            styles.filterTextActive,
                                                        ]}
                                                    >
                                                        {item}
                                                    </Text>
                                                </LinearGradient>
                                            ) : (
                                                <View style={styles.filterChip}>
                                                    <Text style={styles.filterText}>
                                                        {item}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyCard}>
                                <View style={styles.emptyIconWrap}>
                                    <MaterialIcon
                                        name="history"
                                        size={wp(8)}
                                        color="#FFBF00"
                                    />
                                </View>
                                <Text style={styles.emptyTitle}>
                                    No Service Entries
                                </Text>
                                <Text style={styles.emptyText}>
                                    {records.length
                                        ? 'No records match the selected filter.'
                                        : 'Your service records will appear here after your first visit.'}
                                </Text>
                            </View>
                        }
                    />
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#050505',
        paddingBottom: hp(5),
    },

    backgroundGlow: {
        position: 'absolute',
        top: -hp(12),
        left: -wp(18),
        width: wp(72),
        height: wp(72),
        borderRadius: wp(36),
        backgroundColor: 'rgba(255, 191, 0, 0.08)',
    },

    container: {
        flex: 1,
        paddingHorizontal: wp(4),
    },

    hero: {
        borderRadius: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: wp(4.5),
        paddingTop: hp(1.4),
        paddingBottom: hp(1.8),
        marginTop: hp(0.6),
        marginBottom: hp(1.8),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 14,
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    headerTextWrap: {
        marginLeft: wp(2),
        flex: 1,
    },

    headerTitle: {
        fontSize: wp(5.4),
        fontFamily: 'Outfit-Bold',
        color: '#FFFFFF',
    },

    headerSubTitle: {
        marginTop: hp(0.2),
        fontSize: wp(3.2),
        fontFamily: 'Outfit-Medium',
        color: '#8F8F8F',
    },

    vehiclePill: {
        marginTop: hp(1.6),
        borderRadius: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,191,0,0.22)',
        backgroundColor: 'rgba(255,191,0,0.08)',
        paddingHorizontal: wp(3.5),
        paddingVertical: hp(0.9),
        flexDirection: 'row',
        alignItems: 'center',
    },

    vehicle: {
        marginLeft: wp(2.4),
        fontSize: wp(3.8),
        fontFamily: 'Outfit-SemiBold',
        color: '#F8F8F8',
        flex: 1,
    },

    statsRow: {
        flexDirection: 'row',
        marginTop: hp(1.4),
        gap: wp(2.4),
    },

    statCard: {
        flex: 1,
        minHeight: hp(6.1),
        borderRadius: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        backgroundColor: 'rgba(255,255,255,0.03)',
        paddingHorizontal: wp(3),
        paddingVertical: hp(0.9),
        justifyContent: 'center',
    },

    statCardWide: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(1.4),
        flex: 1.35,
    },

    statValue: {
        fontSize: wp(5),
        fontFamily: 'Outfit-Black',
        color: '#FFFFFF',
        lineHeight: wp(5.8),
    },

    statLabel: {
        fontSize: wp(2.9),
        fontFamily: 'Outfit-Medium',
        color: '#8C8C8C',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },

    statFilter: {
        flex: 1,
        fontSize: wp(3.25),
        fontFamily: 'Outfit-SemiBold',
        color: '#E5E5E5',
        textTransform: 'capitalize',
    },

    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: hp(8),
    },

    filterScroll: {
        marginBottom: hp(1.5),
    },

    filterRow: {
        paddingRight: wp(2),
        paddingTop: hp(0.4),
    },

    filterTouchable: {
        marginRight: wp(2.5),
    },

    filterChip: {
        minHeight: hp(4.6),
        paddingHorizontal: wp(4),
        borderRadius: wp(5),
        backgroundColor: '#131313',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.11)',
        justifyContent: 'center',
        alignItems: 'center',
    },

    filterChipActive: {
        borderColor: '#FFBF00',
    },

    filterText: {
        color: '#BEBEBE',
        fontSize: wp(3.45),
        fontFamily: 'Outfit-Medium',
        textTransform: 'capitalize',
    },

    filterTextActive: {
        color: '#181818',
        fontFamily: 'Outfit-Bold',
    },

    listContent: {
        paddingBottom: hp(10),
    },

    listContentEmpty: {
        flexGrow: 1,
        justifyContent: 'center',
    },

    emptyCard: {
        borderRadius: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.09)',
        backgroundColor: '#121212',
        paddingVertical: hp(3.4),
        paddingHorizontal: wp(6),
        alignItems: 'center',
    },

    emptyIconWrap: {
        width: wp(16),
        height: wp(16),
        borderRadius: wp(8),
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,191,0,0.14)',
        borderWidth: 1,
        borderColor: 'rgba(255,191,0,0.3)',
        marginBottom: hp(1.4),
    },

    emptyTitle: {
        color: '#FFFFFF',
        fontSize: wp(4.6),
        fontFamily: 'Outfit-Bold',
        marginBottom: hp(0.6),
    },

    emptyText: {
        color: '#A3A3A3',
        fontSize: wp(3.5),
        fontFamily: 'Outfit-Regular',
        textAlign: 'center',
        lineHeight: hp(2.3),
    },
});
