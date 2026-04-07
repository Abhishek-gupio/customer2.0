import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, InteractionManager } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Svg, { Path, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface WarrantySummaryProps {
    active: number;
    expired: number;
    health: number;
}

export const WarrantySummary = ({ active, expired, health }: WarrantySummaryProps) => {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(health || 0)));
    const animatedProgress = useRef(new Animated.Value(0)).current;

    // Dimensions for the Semicircle Gauge
    const R = wp(36); // Radius defining the size of the gauge
    const strokeWidth = wp(4.5);
    const padding = wp(5);
    const svgWidth = R * 2 + padding * 2;
    const svgHeight = R + padding * 1.5;

    const startX = padding;
    const startY = R + padding;
    const endX = startX + R * 2;

    const pathData = `M ${startX} ${startY} A ${R} ${R} 0 0 1 ${endX} ${startY}`;
    const pathLength = Math.PI * R;

    useEffect(() => {
        const task = InteractionManager.runAfterInteractions(() => {
            Animated.timing(animatedProgress, {
                toValue: clampedHealth,
                duration: 1800,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: false, // SVG stroke dashoffset must run on the JS thread
            }).start();
        });

        return () => {
            task.cancel();
        };
    }, [clampedHealth, animatedProgress]);

    const strokeDashoffset = animatedProgress.interpolate({
        inputRange: [0, 100],
        outputRange: [pathLength, 0], // Animate from completely empty to completely filled
    });

    const statusText = clampedHealth >= 80 ? 'EXCELLENT' : clampedHealth >= 50 ? 'GOOD' : 'CRITICAL';
    const statusColor = clampedHealth >= 80 ? '#22C55E' : clampedHealth >= 50 ? '#F59E0B' : '#EF4444';

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#171717', '#0A0A0A']}
                style={styles.card}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                {/* Header Row */}
                <View style={styles.header}>
                    <Text style={styles.title}>VEHICLE HEALTH SCORE</Text>
                    <View style={styles.liveBadge}>
                        <View style={styles.livePulseContainer}>
                            <View style={styles.liveDot} />
                            <View style={styles.liveDotPing} />
                        </View>
                        <Text style={styles.liveText}>LIVE</Text>
                    </View>
                </View>

                {/* Semicircle Gauge */}
                <View style={styles.gaugeContainer}>
                    <Svg width={svgWidth} height={svgHeight}>
                        <Defs>
                            <SvgGradient id="gaugeTrack" x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor="#EF4444" stopOpacity="0.15" />
                                <Stop offset="0.4" stopColor="#F59E0B" stopOpacity="0.15" />
                                <Stop offset="1" stopColor="#22C55E" stopOpacity="0.15" />
                            </SvgGradient>
                            <SvgGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor="#EF4444" />
                                <Stop offset="0.4" stopColor="#F59E0B" />
                                <Stop offset="1" stopColor="#22C55E" />
                            </SvgGradient>
                        </Defs>
                        
                        {/* Background Path */}
                        <Path
                            d={pathData}
                            stroke="url(#gaugeTrack)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                        
                        {/* Foreground Progress Path */}
                        <AnimatedPath
                            d={pathData}
                            stroke="url(#gaugeFill)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={pathLength}
                            strokeDashoffset={strokeDashoffset}
                        />
                    </Svg>
                    
                    {/* Centered Score Data inside the arc */}
                    <View style={styles.gaugeDataContainer}>
                        <View style={styles.scoreRow}>
                            <Text style={styles.healthValue}>{clampedHealth}</Text>
                        </View>
                        <Text style={[styles.healthSuffix, { color: statusColor }]}>{statusText}</Text>
                    </View>
                </View>

                {/* Descriptive Feedback below the gauge */}
                <View style={styles.statusSection}>
                    <Text style={styles.statusDescription}>
                        {clampedHealth >= 80 
                            ? "Your vehicle is in top shape. Maintenance is up to date."
                            : clampedHealth >= 50
                            ? "Some parts need your attention soon to maintain peak performance."
                            : "Immediate service recommended. Essential parts are overdue."}
                    </Text>
                </View>

                {/* Statistics Row (Boxes) */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <LinearGradient colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.02)']} style={styles.statIconBg}>
                            <Icon name="shield-check" size={wp(5)} color="#22C55E" />
                        </LinearGradient>
                        <View style={styles.statInfo}>
                            <Text style={styles.statNumber}>{active}</Text>
                            <Text style={styles.statLabel}>Healthy Parts</Text>
                        </View>
                    </View>
                    
                    <View style={styles.divider} />
                    
                    <View style={styles.statBox}>
                        <LinearGradient colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.02)']} style={styles.statIconBg}>
                            <Icon name="alert-octagon" size={wp(5)} color="#EF4444" />
                        </LinearGradient>
                        <View style={styles.statInfo}>
                            <Text style={styles.statNumberError}>{expired}</Text>
                            <Text style={styles.statLabel}>Parts Due</Text>
                        </View>
                    </View>
                </View>

            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: hp(1),
        marginBottom: hp(2),
    },
    card: {
        padding: wp(4.5),
        borderRadius: wp(6),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(1), 
    },
    title: {
        color: '#666',
        fontSize: wp(3.2),
        fontFamily: 'Outfit-Bold',
        letterSpacing: 1.5,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        paddingHorizontal: wp(2.5),
        paddingVertical: hp(0.5),
        borderRadius: wp(2),
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.2)',
    },
    livePulseContainer: {
        width: 8,
        height: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#22C55E',
        position: 'absolute',
    },
    liveDotPing: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#22C55E',
        opacity: 0.4,
    },
    liveText: {
        color: '#22C55E',
        fontSize: wp(2.5),
        fontFamily: 'Outfit-Bold',
        letterSpacing: 0.5,
    },
    gaugeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginTop: hp(1),
    },
    gaugeDataContainer: {
        position: 'absolute',
        bottom: wp(4.5),
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    scoreRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    healthValue: {
        fontSize: wp(22),
        fontFamily: 'Outfit-Black',
        color: '#fff',
        includeFontPadding: false,
        lineHeight: wp(22),
    },
    healthSuffix: {
        fontSize: wp(4.5),
        fontFamily: 'Outfit-Black',
        letterSpacing: 3,
        marginTop: -hp(1), // pull it closely under the giant number
    },
    statusSection: {
        alignItems: 'center',
        marginBottom: hp(3.5),
        marginTop: hp(1),
        paddingHorizontal: wp(2),
    },
    statusDescription: {
        color: '#888',
        fontSize: wp(3.2),
        fontFamily: 'Outfit-Medium',
        textAlign: 'center',
        lineHeight: hp(2.2),
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: wp(5),
        paddingVertical: hp(2),
        paddingHorizontal: wp(5),
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    statBox: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        justifyContent: 'center',
        gap: wp(3.5),
    },
    statIconBg: {
        width: wp(11),
        height: wp(11),
        borderRadius: wp(3.5),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.03)',
    },
    statInfo: {
        justifyContent: 'center',
        flex: 1,
    },
    statNumber: {
        fontSize: wp(5.5),
        fontFamily: 'Outfit-Black',
        color: '#fff',
        lineHeight: wp(6.5),
    },
    statNumberError: {
        fontSize: wp(5.5),
        fontFamily: 'Outfit-Black',
        color: '#EF4444',
        lineHeight: wp(6.5),
    },
    statLabel: {
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Medium',
        color: '#888',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    divider: {
        width: 1,
        backgroundColor: 'rgba(255,255,255,0.08)',
        height: '80%',
        alignSelf: 'center',
        marginHorizontal: wp(2),
    },
});
