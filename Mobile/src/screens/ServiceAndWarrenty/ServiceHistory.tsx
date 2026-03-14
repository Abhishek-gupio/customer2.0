import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
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

function mapRecordToCard(record: any): any {
    const date = record.serviceDate
        ? new Date(record.serviceDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : '';
    const parts = record.parts?.length
        ? record.parts.map((p: any) => p.partType?.replace(/_/g, ' ') || p.partType).join(', ')
        : '';
    const nextService = record.nextServiceKm
        ? `Next at ${record.nextServiceKm.toLocaleString()} km`
        : record.nextServiceDate
            ? new Date(record.nextServiceDate).toLocaleDateString('en-IN')
            : '';
    return {
        id: record.id,
        title: record.serviceType?.replace(/_/g, ' ') || 'Service',
        garage: record.garageName || '—',
        date,
        odometer: record.odometerAtService ? `${record.odometerAtService.toLocaleString()} km` : undefined,
        parts: parts || undefined,
        nextService: nextService || undefined,
    };
}

export default function ServiceHistoryScreen({ navigation }: any) {
    const [loading, setLoading] = useState(true);
    const [vehicle, setVehicle] = useState<Vehicle | null>(null);
    const [records, setRecords] = useState<any[]>([]);

    const fetchData = useCallback(async () => {
        try {
            const vehicles = await vehicleService.getVehicles();
            const primary = vehicles.find((v: Vehicle) => v.isPrimary) || vehicles[0];
            if (!primary) {
                setVehicle(null);
                setRecords([]);
                return;
            }
            setVehicle(primary);
            const res = await api.get<any>(`/v1/expenses/warranty/vehicles/${primary.id}/history`);
            const data = (res as any).data ?? res;
            setRecords(Array.isArray(data) ? data.map(mapRecordToCard) : []);
        } catch (err) {
            console.error('Service history fetch failed:', err);
            setRecords([]);
        } finally {
            setLoading(false);
        }
    }, []);

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
                    {vehicle?.registrationNumber ?? '—'}
                </Text>
            </View>
            <View style={styles.container}>
                {loading ? (
                    <View style={styles.loading}>
                        <ActivityIndicator size="large" color="#FFBF00" />
                    </View>
                ) : (
                    <FlatList
                        data={records}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => <ServiceCard item={item} />}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        ListEmptyComponent={
                            <Text style={styles.emptyText}>
                                No service records yet. Add a Service expense with a part to log replacements.
                            </Text>
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
        backgroundColor: 'black',
    },

    container: {
        flex: 1,
        paddingHorizontal: wp(4),
        paddingTop: hp(2),
    },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: hp(1.5),
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
        fontWeight: '700',
        color: '#fff',
        marginLeft: wp(3),
    },

    vehicle: {
        fontSize: wp(4.5),
        fontWeight: '500',
        marginBottom: hp('2%'),
        color: '#fff',
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: hp(4),
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