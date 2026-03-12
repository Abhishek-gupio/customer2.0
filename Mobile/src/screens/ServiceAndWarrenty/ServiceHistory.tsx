import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
} from 'react-native';

import ServiceCard from '../../components/ServiceCard';
import { serviceHistory } from '../ServiceAndWarrenty/data';
import { COLORS } from './data';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';


export default function ServiceHistoryScreen({ navigation }: any) {
    return (
        <SafeAreaView style={styles.safe}>
            <View style={styles.shader}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation?.goBack()}>
                        <Text style={styles.back}>←</Text>
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Service History</Text>
                </View>

                {/* Vehicle Number */}
                <Text style={styles.vehicle}>MH12AB1234</Text>
            </View>
            <View style={styles.container}>

                {/* Service List */}
                <FlatList
                    // ListHeaderComponent={}
                    data={serviceHistory}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <ServiceCard item={item} />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />

                {/* Add Service */}
                {/* <TouchableOpacity style={styles.addButton}>
          <Text style={styles.addText}>+ Log Service</Text>
        </TouchableOpacity> */}
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
        fontSize: wp(7),
        fontWeight: '600',
        color: '#fff',
    },

    vehicle: {
        fontSize: wp(4.5),
        fontWeight: '500',
        marginBottom: hp('2%'),
        color: '#fff',
    },

    addButton: {
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: COLORS.border,
        borderRadius: wp('3%'),
        paddingVertical: hp('1.8%'),
        alignItems: 'center',
        backgroundColor: 'transparent',
        marginTop: hp('1%'),
        marginBottom: hp('2%'),
    },

    addText: {
        fontSize: wp('4%'),
        fontWeight: '600',
        color: '#fff',
    },

    shader: {
        borderBottomLeftRadius: wp('5%'),
        borderBottomRightRadius: wp('5%'),
        paddingBottom: hp('2%'),
        paddingHorizontal: wp('4%'),
    },
});