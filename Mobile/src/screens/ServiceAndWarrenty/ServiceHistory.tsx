import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
} from 'react-native';
import { useFocusEffect } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import ServiceCard from '../../components/ServiceCard';
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
    { label: 'Tyres (All)', value: 'TYRES' },
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
            <View style={styles.shader}>
                <View style={styles.header}>
                    <BackButton onPress={() => navigation?.goBack()} />
                    <Text style={styles.headerTitle}>Service History</Text>
                </View>
                <Text style={styles.vehicle}>
                    {vehicle?.registrationNumber ?? '-'}
                </Text>
            </View>
            <View style={styles.container}>
                {loading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#FFBF00" />
                    </View>
                ) : (
                    <>
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
                                        style={[
                                            styles.filterChip,
                                            isActive &&
                                                styles.filterChipActive,
                                        ]}
                                        onPress={() =>
                                            setSelectedFilter(item)
                                        }
                                        activeOpacity={0.85}
                                    >
                                        <Text
                                            style={[
                                                styles.filterText,
                                                isActive &&
                                                    styles.filterTextActive,
                                            ]}
                                        >
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <FlatList
                            data={filteredRecords}
                            keyExtractor={(item) => item.id}
                            renderItem={({ item }) => <ServiceCard item={item} />}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                            ListEmptyComponent={
                                <Text style={styles.emptyText}>
                                    {records.length
                                        ? 'No service records match the selected filter.'
                                        : 'No records found'}
                                </Text>
                            }
                        />
                    </>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: 'black',
    },

    container: {
        flex: 1,
        paddingHorizontal: wp(4),
        // paddingTop: hp(0),
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: hp(1),
    },

    back: {
        fontSize: wp(6),
        fontWeight: '600',
        marginRight: wp(2),
        color: '#fff',
        paddingHorizontal: wp(2),
    },

    headerTitle: {
        fontSize: wp(5.5),
        fontFamily: 'Outfit-Bold',
        color: '#fff',
        marginLeft: wp(3),
    },

    vehicle: {
        fontSize: wp(4.5),
        fontFamily: 'Outfit-Medium',
        marginBottom: hp('2%'),
        color: '#fff',
    },

    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: hp(4),
    },

    filterScroll: {
        marginBottom: hp(2),
        maxHeight: hp(6),
    },

    filterRow: {
        paddingRight: wp(2),
    },

    filterChip: {
        paddingHorizontal: wp(4),
        paddingVertical: hp(1),
        borderRadius: wp(6),
        backgroundColor: '#151515',
        borderWidth: 1,
        borderColor: '#333',
        marginRight: wp(2.5),
        justifyContent: 'center',
        alignItems: 'center',
    },

    filterChipActive: {
        backgroundColor: '#FFBF00',
        borderColor: '#FFBF00',
    },

    filterText: {
        color: '#bbb',
        fontSize: wp(3.6),
        fontFamily: 'Outfit-Medium',
        textTransform: 'capitalize',
    },

    filterTextActive: {
        color: '#000',
        fontFamily: 'Outfit-Bold',
    },

    listContent: {
        paddingBottom: 20,
    },

    emptyText: {
        color: '#888',
        fontSize: wp(4),
        textAlign: 'center',
        paddingVertical: hp(4),
        paddingHorizontal: wp(6),
    },

    shader: {
        borderBottomLeftRadius: wp('5%'),
        borderBottomRightRadius: wp('5%'),
        paddingBottom: hp('2%'),
        paddingHorizontal: wp('5%'),
    },
});
