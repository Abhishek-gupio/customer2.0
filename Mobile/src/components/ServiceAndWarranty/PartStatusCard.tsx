import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface PartStatusCardProps {
    title: string;
    subtitle?: string;
    percentage: number;
    statusText: string;
    color: string;
    icon: string;
    urgency?: 'OVERDUE' | 'DUE_BY_KM' | 'DUE_SOON' | 'ACTIVE';
    predictedDate?: string;
    garageName?: string;
    serviceType?: string;
    warrantyMonths?: number;
    lastReplacedOdo?: number;
    kmSinceReplacement?: number;
    lifecycleKm?: number;
    lifecycleMonths?: number;
    lastReplacedAt?: string;
    currentOdo?: number;
    overdueByKm?: number;
    /** OEM_WEBSITE = from OEM manual; else not from OEM, may be incorrect */
    intervalSource?: string;
    onReplace?: () => void;
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
    garageName,
    serviceType,
    warrantyMonths,
    lastReplacedOdo,
    kmSinceReplacement,
    lifecycleKm,
    lifecycleMonths,
    lastReplacedAt,
    currentOdo,
    overdueByKm,
    intervalSource,
    onReplace,
}: PartStatusCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const isCritical = urgency === 'OVERDUE';
    const displayPercentage = Math.max(0, Math.min(100, percentage));

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const kmRemaining = lifecycleKm && kmSinceReplacement !== undefined ? Math.max(0, lifecycleKm - kmSinceReplacement) : null;

    return (
        <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand} style={styles.card}>
            <View style={styles.topRow}>
                <View style={styles.leftInfo}>
                    <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                        <Icon name={icon} size={wp(6)} color={color} />
                    </View>
                    <View style={styles.titleContainer}>
                        <Text style={styles.title}>{title}</Text>
                        <Text style={styles.subtitle}>{subtitle || statusText}</Text>
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
                {overdueByKm != null && overdueByKm > 0 ? (
                    <Text style={styles.predictionText}>
                        Interval <Text style={{ color: '#fff', fontWeight: '800' }}>{lifecycleKm?.toLocaleString()} km</Text>. Overdue by <Text style={{ color: '#EF4444', fontWeight: '800' }}>{overdueByKm.toLocaleString()} km</Text>
                    </Text>
                ) : kmRemaining !== null ? (
                    <Text style={styles.predictionText}>
                        Due at <Text style={{ color: '#fff', fontWeight: '800' }}>{lifecycleKm?.toLocaleString()} km</Text>. <Text style={{ color: '#fff', fontWeight: '800' }}>{kmRemaining} km</Text> more
                    </Text>
                ) : predictedDate ? (
                    <Text style={styles.predictionText}>
                        Estimated: <Text style={{ color: '#fff', fontWeight: '600' }}>{predictedDate}</Text>
                    </Text>
                ) : (
                    <Text style={styles.predictionText}>Status: {statusText}</Text>
                )}
                {isCritical ? (
                    <View style={styles.criticalNotice}>
                        <Icon name="alert-circle" size={wp(3.5)} color="#EF4444" />
                        <Text style={styles.criticalText}>REPLACE</Text>
                    </View>
                ) : percentage < 50 ? (
                    <View style={[styles.criticalNotice, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                        <Icon name="clock-outline" size={wp(3.5)} color="#F59E0B" />
                        <Text style={[styles.criticalText, { color: '#F59E0B' }]}>DUE SOON</Text>
                    </View>
                ) : null}
                <Icon name={expanded ? "chevron-up" : "chevron-down"} size={wp(5)} color="#444" />
            </View>

            {expanded && (
                <View style={styles.detailsContainer}>
                    <View style={styles.divider} />

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Last Service Odo</Text>
                            <Text style={styles.detailValue}>{lastReplacedOdo || 0} km</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Current Odo</Text>
                            <Text style={styles.detailValue}>{currentOdo || 0} km</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Last Service Date</Text>
                            <Text style={styles.detailValue}>{lastReplacedAt ? new Date(lastReplacedAt).toLocaleDateString('en-IN') : 'N/A'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Warranty</Text>
                            <Text style={styles.detailValue}>{warrantyMonths || 0} Months</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Garage</Text>
                            <Text style={styles.detailValue}>{garageName || 'Owner DIY'}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Type</Text>
                            <Text style={styles.detailValue}>{serviceType ? serviceType.replace(/_/g, ' ') : 'General'}</Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Interval</Text>
                            <Text style={styles.detailValue}>{lifecycleKm || 0} km / {lifecycleMonths || 0} mo</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Text style={styles.detailLabel}>Source</Text>
                            <Text style={[styles.detailValue, (intervalSource || '').toUpperCase() !== 'OEM_WEBSITE' && styles.detailValueWarning]}>
                                {(intervalSource || '').toUpperCase() === 'OEM_WEBSITE' ? 'From OEM manual' : 'Not from OEM — may be incorrect'}
                            </Text>
                        </View>
                    </View>

                    {isCritical && !title.toUpperCase().includes('ENGINE OIL') ? (
                        <TouchableOpacity style={styles.bookButton}>
                            <Text style={styles.bookButtonText}>Book Service Now</Text>
                        </TouchableOpacity>
                    ) : (percentage < 50 || (isCritical && title.toUpperCase().includes('ENGINE OIL'))) ? (
                        <TouchableOpacity style={[styles.bookButton, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#FFBF00' }]} onPress={onReplace}>
                            <Text style={[styles.bookButtonText, { color: '#FFBF00' }]}>Mark as Replaced</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}
        </TouchableOpacity>
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
    detailsContainer: {
        marginTop: hp(2),
        paddingTop: hp(1),
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: hp(2),
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: hp(1.5),
    },
    detailItem: {
        flex: 1,
    },
    detailLabel: {
        color: '#666',
        fontSize: wp(3),
        marginBottom: 2,
    },
    detailValue: {
        color: '#fff',
        fontSize: wp(3.5),
        fontWeight: '600',
    },
    detailValueWarning: {
        color: '#F59E0B',
    },
    bookButton: {
        backgroundColor: '#FFBF00',
        paddingVertical: hp(1.2),
        borderRadius: wp(2),
        alignItems: 'center',
        marginTop: hp(1),
    },
    bookButtonText: {
        color: '#000',
        fontSize: wp(3.5),
        fontWeight: '700',
    },
});
