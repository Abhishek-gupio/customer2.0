import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
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
    /** OEM_WEBSITE = from OEM manual; AI_SUGGESTED = AI data */
    intervalSource?: string;
    onPressHistory?: () => void;
    onPressUpdate?: () => void;
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
    onPressHistory,
    onPressUpdate,
}: PartStatusCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const isCritical = urgency === 'OVERDUE';
    const displayPercentage = Math.max(0, Math.min(100, percentage));
    const isOemIntervalSource = ['OEM_WEBSITE', 'OEM'].includes((intervalSource || '').toUpperCase());
    const isAiSource = (intervalSource || '').toUpperCase() === 'AI_SUGGESTED';

    const toggleExpand = () => {
        LayoutAnimation.configureNext({
            duration: 300,
            create: { type: 'easeInEaseOut', property: 'opacity' },
            update: { type: 'spring', springDamping: 0.7 },
        });
        setExpanded(!expanded);
    };

    const kmRemaining = lifecycleKm && kmSinceReplacement !== undefined ? Math.max(0, lifecycleKm - kmSinceReplacement) : null;

    return (
        <View style={styles.cardContainer}>
            <LinearGradient
                colors={['#1a1a1a', '#111111']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand} style={styles.mainAction}>
                    <View style={styles.topRow}>
                        <View style={styles.leftInfo}>
                            <LinearGradient
                                colors={[`${color}30`, `${color}10`]}
                                style={styles.iconContainer}
                            >
                                <Icon name={icon} size={wp(6)} color={color} />
                            </LinearGradient>
                            <View style={styles.titleContainer}>
                                <Text style={styles.title}>{title}</Text>
                                <View style={styles.statusRow}>
                                    <View style={[styles.pulse, { backgroundColor: color }]} />
                                    <Text style={[styles.subtitle, { color }]}>{statusText}</Text>
                                    {warrantyMonths != null && warrantyMonths > 0 && (
                                        <View style={styles.warrantyBadge}>
                                            <Icon name="shield-check" size={wp(3)} color="#22C55E" />
                                            <Text style={styles.warrantyText}>Under Warranty</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        <View style={styles.rightInfo}>
                            <Text style={[styles.percentageText, { color }]}>{displayPercentage}%</Text>
                        </View>
                    </View>

                    <View style={styles.progressSection}>
                        <View style={styles.progressBarContainer}>
                            <LinearGradient
                                colors={[color, `${color}80`]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={[styles.progressBar, { width: `${displayPercentage}%` }]}
                            >
                                <View style={styles.progressShine} />
                            </LinearGradient>
                        </View>
                        <View style={styles.dueInfo}>
                            {overdueByKm != null && overdueByKm > 0 ? (
                                <Text style={styles.odoStatusText}>
                                    <Text style={styles.overdueBold}>{overdueByKm.toLocaleString()} km overdue</Text>
                                </Text>
                            ) : kmRemaining !== null ? (
                                <Text style={styles.odoStatusText}>
                                    {kmRemaining.toLocaleString()} km remaining
                                </Text>
                            ) : null}
                            <Text style={styles.intervalText}>{lifecycleKm?.toLocaleString()} km interval</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onPressHistory}>
                        <Icon name="history" size={wp(4.5)} color="#888" />
                        <Text style={styles.secondaryBtnText}>History</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.dividerVertical} />
                    
                    <TouchableOpacity style={[styles.secondaryBtn, styles.primarySubBtn]} onPress={onPressUpdate}>
                        <Icon name="plus-circle" size={wp(4.5)} color="#FFBF00" />
                        <Text style={[styles.secondaryBtnText, { color: '#FFBF00' }]}>Update</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.expandBtn} onPress={toggleExpand}>
                        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={wp(5)} color="#444" />
                    </TouchableOpacity>
                </View>

                {expanded && (
                    <View style={styles.detailsContainer}>
                        <View style={styles.dividerHorizontal} />
                        
                        <View style={styles.grid}>
                            <View style={styles.gridItem}>
                                <Text style={styles.detailLabel}>Last Service</Text>
                                <Text style={styles.detailValue}>{lastReplacedOdo || 0} km</Text>
                                <Text style={styles.detailSub}>{lastReplacedAt ? new Date(lastReplacedAt).toLocaleDateString('en-IN') : 'N/A'}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.detailLabel}>Lifespan</Text>
                                <Text style={styles.detailValue}>{lifecycleKm || 0} km</Text>
                                <Text style={styles.detailSub}>{lifecycleMonths || 0} months</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.detailLabel}>Vendor</Text>
                                <Text style={styles.detailValue} numberOfLines={1}>{garageName || 'Owner DIY'}</Text>
                                <Text style={styles.detailSub}>{serviceType ? serviceType.replace(/_/g, ' ') : 'General'}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.detailLabel}>Data Source</Text>
                                <Text style={styles.detailValue}>
                                    {isOemIntervalSource ? 'OEM Official' : isAiSource ? 'AI Suggested' : 'Internal Base'}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    cardContainer: {
        marginBottom: hp(2),
        borderRadius: wp(5),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    },
    card: {
        borderRadius: wp(5),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    mainAction: {
        padding: wp(4.5),
        paddingBottom: hp(1.5),
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: hp(2),
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconContainer: {
        width: wp(12),
        height: wp(12),
        borderRadius: wp(3.5),
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: wp(4),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
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
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(1.5),
    },
    pulse: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    subtitle: {
        fontSize: wp(3.2),
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    warrantyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        paddingHorizontal: wp(2),
        paddingVertical: hp(0.3),
        borderRadius: wp(1.5),
        marginLeft: wp(2),
        gap: 4,
    },
    warrantyText: {
        color: '#22C55E',
        fontSize: wp(2.5),
        fontWeight: '700',
    },
    rightInfo: {
        alignItems: 'flex-end',
    },
    percentageText: {
        fontSize: wp(5.5),
        fontWeight: '900',
    },
    progressSection: {
        marginTop: hp(0.5),
    },
    progressBarContainer: {
        height: hp(1),
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: hp(0.5),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.02)',
    },
    progressBar: {
        height: '100%',
        borderRadius: hp(0.5),
    },
    progressShine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: '40%',
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
    dueInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: hp(1),
    },
    odoStatusText: {
        color: '#aaa',
        fontSize: wp(3.2),
        fontWeight: '500',
    },
    overdueBold: {
        color: '#EF4444',
        fontWeight: '800',
    },
    intervalText: {
        color: '#666',
        fontSize: wp(3.2),
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        paddingVertical: hp(1.2),
        paddingHorizontal: wp(4.5),
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.05)',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: hp(0.5),
        gap: 6,
    },
    primarySubBtn: {
        marginLeft: wp(4),
    },
    secondaryBtnText: {
        color: '#888',
        fontSize: wp(3.2),
        fontWeight: '700',
    },
    dividerVertical: {
        width: 1,
        height: hp(2),
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: wp(4),
    },
    expandBtn: {
        marginLeft: 'auto',
    },
    detailsContainer: {
        padding: wp(4.5),
        paddingTop: 0,
    },
    dividerHorizontal: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginBottom: hp(2),
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: hp(2),
    },
    gridItem: {
        width: '45%',
    },
    detailLabel: {
        color: '#666',
        fontSize: wp(2.8),
        textTransform: 'uppercase',
        marginBottom: 4,
        letterSpacing: 0.5,
    },
    detailValue: {
        color: '#fff',
        fontSize: wp(3.8),
        fontWeight: '700',
    },
    detailSub: {
        color: '#888',
        fontSize: wp(3),
        marginTop: 2,
    },
    sourceWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});
