import React from 'react';
import { View, Text, StyleSheet, ScrollView, SafeAreaView, StatusBar, Platform } from 'react-native';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';

export default function Services() {
    const categories = [
        { name: 'Vehicle Services', icon: 'car-repair' },
        { name: 'Document Services', icon: 'file-invoice' },
        { name: 'RTO Services', icon: 'landmark' },
        { name: 'Insurance', icon: 'shield-alt' },
    ];

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Services</Text>
            </View>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.grid}>
                    {categories.map((cat, idx) => (
                        <View key={idx} style={styles.card}>
                            <View style={styles.iconContainer}>
                                <Icon name={cat.icon} size={28} color="#fff" />
                            </View>
                            <Text style={styles.cardText}>{cat.name}</Text>
                        </View>
                    ))}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    header: {
        paddingHorizontal: wp(6),
        paddingVertical: hp(2),
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    headerTitle: {
        fontSize: wp(7),
        fontWeight: '800',
        color: '#fff',
    },
    scrollContent: {
        padding: wp(6),
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: wp(4),
    },
    card: {
        width: wp(42),
        backgroundColor: '#1a1a1a',
        borderRadius: 16,
        padding: wp(4),
        alignItems: 'center',
        justifyContent: 'center',
        height: wp(35),
        borderWidth: 1,
        borderColor: '#333',
    },
    iconContainer: {
        width: wp(14),
        height: wp(14),
        borderRadius: wp(7),
        backgroundColor: '#222',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: hp(1.5),
    },
    cardText: {
        color: '#fff',
        fontSize: wp(3.5),
        fontWeight: '600',
        textAlign: 'center',
    },
});
