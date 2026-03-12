import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

interface WarrantySummaryProps {
    active: number;
    expired: number;
}

export const WarrantySummary = ({ active, expired }: WarrantySummaryProps) => {
    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#1a1a1a', '#0a0a0a']}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>Service Status</Text>
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>Threshold: 15%</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <View style={[styles.dot, { backgroundColor: '#22C55E' }]} />
                        <Text style={styles.statVal}>{active}</Text>
                        <Text style={styles.statLabel}>Active</Text>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.statBox}>
                        <View style={[styles.dot, { backgroundColor: '#EF4444' }]} />
                        <Text style={styles.statVal}>{expired}</Text>
                        <Text style={styles.statLabel}>Expired</Text>
                    </View>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: wp(5),
        marginTop: hp(1),
    },
    card: {
        padding: wp(5),
        borderRadius: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2.5),
    },
    title: {
        color: '#888',
        fontSize: wp(3.8),
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    badge: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: wp(2.5),
        paddingVertical: hp(0.5),
        borderRadius: wp(2),
    },
    badgeText: {
        color: '#aaa',
        fontSize: wp(2.5),
        fontWeight: '600',
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
    },
    dot: {
        width: wp(1.5),
        height: wp(1.5),
        borderRadius: wp(0.75),
        marginBottom: hp(0.8),
    },
    statVal: {
        color: '#fff',
        fontSize: wp(6.5),
        fontWeight: '900',
    },
    statLabel: {
        color: '#666',
        fontSize: wp(3.2),
        fontWeight: '500',
        marginTop: 2,
    },
    divider: {
        width: 1,
        height: hp(4),
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
});
