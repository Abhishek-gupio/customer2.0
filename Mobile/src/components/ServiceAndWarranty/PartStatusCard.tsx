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
    intervalSource?: string;
    dataQuality?: string;
    onPressHistory?: () => void;
    onPressUpdate?: () => void;
}

export const PartStatusCard = React.memo(({
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
    dataQuality,
    onPressHistory,
    onPressUpdate,
}: PartStatusCardProps) => {
    const [expanded, setExpanded] = useState(false);
    const displayPercentage = Math.max(0, Math.min(100, percentage));
    const normalizedQuality = (dataQuality || '').toUpperCase();
    const isOemIntervalSource = normalizedQuality === 'VERIFIED' || (!normalizedQuality && ['OEM_WEBSITE', 'OEM'].includes((intervalSource || '').toUpperCase()));
    const isAiSource = normalizedQuality === 'AI_PREDICTED' || (!normalizedQuality && (intervalSource || '').toUpperCase() === 'AI_SUGGESTED');

    const toggleExpand = () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setExpanded(!expanded);
    };

    const kmRemaining = lifecycleKm && kmSinceReplacement !== undefined ? Math.max(0, lifecycleKm - kmSinceReplacement) : null;

    return (
        <View style={styles.cardWrapper}>
            <View style={styles.card}>
                <TouchableOpacity activeOpacity={0.9} onPress={toggleExpand} style={styles.mainAction}>
                    <View style={styles.topRow}>
                        <View style={styles.leftInfo}>
                            <View style={styles.iconBox}>
                                <Icon name={icon} size={wp(5.5)} color="#FFF" />
                            </View>
                            <View style={styles.titleArea}>
                                <Text style={styles.title}>{title}</Text>
                                <View style={styles.statusRow}>
                                    <View style={[styles.dot, { backgroundColor: color || '#FFBF00' }]} />
                                    <Text style={styles.statusLabel}>{statusText}</Text>
                                    {warrantyMonths != null && warrantyMonths > 0 && (
                                        <Text style={styles.warrantyTag}>• WARRANTY</Text>
                                    )}
                                    {isOemIntervalSource ? (
                                        <Text style={styles.verifiedTag}>• VERIFIED</Text>
                                    ) : isAiSource ? (
                                        <Text style={styles.aiTag}>• AI PREDICTED</Text>
                                    ) : null}
                                </View>
                            </View>
                        </View>
                        <Text style={styles.percentageVal}>{displayPercentage}%</Text>
                    </View>

                    <View style={styles.progressContainer}>
                        <View style={styles.track}>
                            <View style={[styles.bar, { width: `${displayPercentage}%`, backgroundColor: color || '#FFBF00' }]} />
                        </View>
                        <View style={styles.dueRow}>
                            <Text style={styles.odoText}>
                                {overdueByKm != null && overdueByKm > 0 ? (
                                    <Text style={styles.alertText}>{overdueByKm.toLocaleString()} KM OVERDUE</Text>
                                ) : kmRemaining !== null ? (
                                    <Text>{kmRemaining.toLocaleString()} KM REMAINING</Text>
                                ) : null}
                            </Text>
                            <Text style={styles.intervalLab}>{lifecycleKm?.toLocaleString()} KM INTERVAL</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onPressHistory}>
                        <Icon name="history" size={wp(4.2)} color="#444" />
                        <Text style={styles.secondaryBtnText}>HISTORY</Text>
                    </TouchableOpacity>
                    
                    <View style={styles.divider} />
                    
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onPressUpdate}>
                        <Icon name="plus-circle" size={wp(4.2)} color="#FFBF00" />
                        <Text style={styles.updateBtnText}>UPDATE</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.expandBtn} onPress={toggleExpand}>
                        <Icon name={expanded ? "chevron-up" : "chevron-down"} size={wp(5)} color="#222" />
                    </TouchableOpacity>
                </View>

                {expanded && (
                    <View style={styles.detailsArea}>
                        <View style={styles.grid}>
                            <View style={styles.gridItem}>
                                <Text style={styles.lab}>LAST REPLACED</Text>
                                <Text style={styles.val}>{lastReplacedOdo || 0} km</Text>
                                <Text style={styles.subVal}>{lastReplacedAt ? new Date(lastReplacedAt).toLocaleDateString() : '-'}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.lab}>EXPECTED LIFE</Text>
                                <Text style={styles.val}>{lifecycleKm || 0} km</Text>
                                <Text style={styles.subVal}>{lifecycleMonths || 0} months</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.lab}>LAST GARAGE</Text>
                                <Text style={styles.val} numberOfLines={1}>{garageName || 'Owner DIY'}</Text>
                                <Text style={styles.subVal}>{serviceType?.replace(/_/g, ' ') || 'General'}</Text>
                            </View>
                            <View style={styles.gridItem}>
                                <Text style={styles.lab}>SPEC SOURCE</Text>
                                <Text style={styles.val}>
                                    {isOemIntervalSource ? 'VERIFIED' : isAiSource ? 'PREDICTED (AI)' : 'ESTIMATED'}
                                </Text>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    cardWrapper: {
        marginBottom: hp(2),
    },
    card: {
        backgroundColor: '#0a0a0a',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#111',
        overflow: 'hidden',
    },
    mainAction: {
        padding: wp(5),
    },
    topRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2),
    },
    leftInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    iconBox: {
        width: wp(11),
        height: wp(11),
        borderRadius: 14,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    titleArea: {
        marginLeft: wp(3.5),
        flex: 1,
    },
    title: {
        color: '#fff',
        fontSize: wp(3.8),
        fontFamily: 'Outfit-Bold',
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusLabel: {
        color: '#444',
        fontSize: wp(2.5),
        fontFamily: 'Outfit-Black',
        textTransform: 'uppercase',
    },
    warrantyTag: {
        color: '#22C55E',
        fontSize: wp(2.2),
        fontFamily: 'Outfit-Black',
        marginLeft: 6,
    },
    verifiedTag: {
        color: '#22C55E',
        fontSize: wp(2.2),
        fontFamily: 'Outfit-Black',
        marginLeft: 6,
    },
    aiTag: {
        color: '#F59E0B',
        fontSize: wp(2.2),
        fontFamily: 'Outfit-Black',
        marginLeft: 6,
    },
    percentageVal: {
        color: '#fff',
        fontSize: wp(5),
        fontFamily: 'Outfit-Black',
    },
    progressContainer: {
        marginTop: hp(0.5),
    },
    track: {
        height: 6,
        backgroundColor: '#111',
        borderRadius: 3,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 3,
    },
    dueRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: hp(1),
    },
    odoText: {
        color: '#555',
        fontSize: wp(2.5),
        fontFamily: 'Outfit-Bold',
    },
    alertText: {
        color: '#EF4444',
    },
    intervalLab: {
        color: '#333',
        fontSize: wp(2.5),
        fontFamily: 'Outfit-Bold',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: hp(1.5),
        paddingHorizontal: wp(5),
        backgroundColor: '#050505',
        borderTopWidth: 1,
        borderTopColor: '#111',
    },
    secondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    secondaryBtnText: {
        color: '#444',
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Black',
    },
    updateBtnText: {
        color: '#FFBF00',
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Black',
    },
    divider: {
        width: 1,
        height: hp(1.5),
        backgroundColor: '#111',
        marginHorizontal: wp(4),
    },
    expandBtn: {
        marginLeft: 'auto',
    },
    detailsArea: {
        padding: wp(5),
        backgroundColor: '#030303',
        borderTopWidth: 1,
        borderTopColor: '#111',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: hp(2.5),
    },
    gridItem: {
        width: '45%',
    },
    lab: {
        color: '#333',
        fontSize: wp(2.5),
        fontFamily: 'Outfit-Black',
    },
    val: {
        color: '#fff',
        fontSize: wp(3.4),
        fontFamily: 'Outfit-Bold',
        marginTop: 1,
    },
    subVal: {
        color: '#444',
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Medium',
        marginTop: 1,
    },
});
