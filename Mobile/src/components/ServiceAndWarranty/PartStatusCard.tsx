import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

interface PartStatusCardProps {
    title: string;
    subtitle?: string;
    percentage: number;
    statusText: string;
    color: string;
    icon: string;
    urgency?: 'OVERDUE' | 'DUE_BY_KM' | 'DUE_SOON' | 'ACTIVE';
    predictedDate?: string;
}

export const PartStatusCard = ({
    title,
    subtitle,
    percentage,
    statusText,
    color,
    icon,
    urgency,
    predictedDate,
}: PartStatusCardProps) => {
    const isCritical = urgency === 'OVERDUE';
    const displayPercentage = Math.max(0, Math.min(100, percentage));

    return (
        <View style={styles.card}>
            <View style={styles.topRow}>
                <View style={styles.leftInfo}>
                    <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                        <Icon name={icon} size={wp(6)} color={color} />
                    </View>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{title}</Text>
                        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
                    </View>
                </View>

                <View style={styles.rightScore}>
                    <Text style={[styles.scoreText, { color }]}>{displayPercentage}%</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${color}20` }]}>
                        <Text style={[styles.statusBadgeText, { color }]}>{statusText}</Text>
                    </View>
                </View>
            </View>

            <View style={styles.progressSection}>
                <View style={styles.progressBarContainer}>
                    <View
                        style={[
                            styles.progressBar,
                            { width: `${displayPercentage}%`, backgroundColor: color },
                        ]}
                    />
                </View>
            </View>

            <View style={styles.bottomRow}>
                {predictedDate ? (
                    <Text style={styles.predictionText}>
                        Estimated replacement: <Text style={{ color: '#fff', fontWeight: '600' }}>{predictedDate}</Text>
                    </Text>
                ) : (
                    <Text style={styles.predictionText}>Current status: {statusText}</Text>
                )}
                {isCritical && (
                    <View style={styles.criticalNotice}>
                        <Icon name="alert-circle" size={wp(3.5)} color="#EF4444" />
                        <Text style={styles.criticalText}>Replace Now</Text>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#111',
        borderRadius: wp(5),
        padding: wp(4.5),
        marginBottom: hp(2),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(1.5),
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: wp(11),
        height: wp(11),
        borderRadius: wp(3),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp(3.5),
    },
    titleContainer: {
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: wp(4.2),
        fontWeight: '700',
        marginBottom: 2,
    },
    subtitle: {
        color: '#888',
        fontSize: wp(3.2),
    },
    rightScore: {
        alignItems: 'flex-end',
    },
    scoreText: {
        fontSize: wp(4.5),
        fontWeight: '800',
        marginBottom: 4,
    },
    statusBadge: {
        paddingHorizontal: wp(2.5),
        paddingVertical: hp(0.4),
        borderRadius: wp(2),
    },
    statusBadgeText: {
        fontSize: wp(2.8),
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    progressSection: {
        marginBottom: hp(1.5),
    },
    progressBarContainer: {
        height: hp(0.8),
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: hp(0.4),
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: hp(0.4),
    },
    bottomRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    predictionText: {
        color: '#666',
        fontSize: wp(3.2),
        flex: 1,
    },
    criticalNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: wp(2),
        paddingVertical: hp(0.4),
        borderRadius: wp(1.5),
        gap: wp(1),
    },
    criticalText: {
        color: '#EF4444',
        fontSize: wp(2.8),
        fontWeight: '700',
    },
});
