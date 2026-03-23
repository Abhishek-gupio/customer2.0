import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import {
    widthPercentageToDP as wp,
    heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface WarrantySummaryProps {
    active: number;
    expired: number;
    health: number;
}

export const WarrantySummary = ({ active, expired, health }: WarrantySummaryProps) => {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(health || 0)));
    const animatedProgress = useRef(new Animated.Value(0)).current;
    const gaugeSize = wp(30);
    const strokeWidth = wp(2.2);
    const svgSize = 160;
    const center = svgSize / 2;
    const radius = 62;
    const circumference = 2 * Math.PI * radius;

    const healthTone = useMemo(() => {
        if (clampedHealth >= 70) {
            return '#22C55E';
        }
        if (clampedHealth >= 40) {
            return '#F59E0B';
        }
        return '#EF4444';
    }, [clampedHealth]);

    useEffect(() => {
        Animated.timing(animatedProgress, {
            toValue: clampedHealth,
            duration: 1200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [animatedProgress, clampedHealth]);

    const strokeDashoffset = animatedProgress.interpolate({
        inputRange: [0, 50, 100],
        outputRange: [circumference, circumference / 2, 0],
    });

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

                <View style={styles.contentRow}>
                    <View style={styles.healthBlock}>
                        <Text style={styles.healthTitle}>Vehicle Health</Text>
                        <View style={[styles.circleWrap, { width: gaugeSize, height: gaugeSize }]}>
                            <Svg width={gaugeSize} height={gaugeSize} viewBox={`0 0 ${svgSize} ${svgSize}`}>
                                <Defs>
                                    <SvgGradient
                                        id="warrantyHealthGrad"
                                        x1="0%"
                                        y1="0%"
                                        x2="100%"
                                        y2="0%"
                                    >
                                        <Stop offset="0%" stopColor={healthTone} stopOpacity="0.35" />
                                        <Stop offset="100%" stopColor={healthTone} />
                                    </SvgGradient>
                                </Defs>
                                <Circle
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    stroke="rgba(255,255,255,0.08)"
                                    strokeWidth={strokeWidth * 4}
                                    fill="transparent"
                                />
                                <AnimatedCircle
                                    cx={center}
                                    cy={center}
                                    r={radius}
                                    stroke="url(#warrantyHealthGrad)"
                                    strokeWidth={strokeWidth * 4}
                                    fill="transparent"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="round"
                                    rotation="-90"
                                    origin={`${center}, ${center}`}
                                />
                            </Svg>
                            <View style={styles.circleCenter}>
                                <Text style={[styles.healthValue, { color: healthTone }]}>
                                    {clampedHealth}%
                                </Text>
                                <Text style={styles.circleLabel}>Health</Text>
                            </View>
                        </View>
                        <Text style={styles.healthLabel}>
                            {clampedHealth >= 70
                                ? 'Healthy vehicle'
                                : clampedHealth >= 40
                                  ? 'Needs attention soon'
                                  : 'Service recommended'}
                        </Text>
                    </View>

                    <View style={styles.statsColumn}>
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
    contentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(4),
    },
    healthBlock: {
        flex: 1.2,
        justifyContent: 'center',
        alignItems: 'center',
    },
    healthTitle: {
        color: '#fff',
        fontSize: wp(4.2),
        fontWeight: '800',
        marginBottom: hp(1.4),
    },
    circleWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: hp(1.2),
    },
    circleCenter: {
        position: 'absolute',
        width: '72%',
        height: '72%',
        borderRadius: 999,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    healthValue: {
        fontSize: wp(7),
        fontWeight: '900',
    },
    circleLabel: {
        color: '#777',
        fontSize: wp(2.8),
        fontWeight: '700',
        marginTop: 1,
    },
    healthLabel: {
        color: '#888',
        fontSize: wp(3),
        fontWeight: '600',
        textAlign: 'center',
    },
    statsColumn: {
        flex: 1,
    },
    statBox: {
        alignItems: 'flex-start',
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
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.05)',
        marginVertical: hp(1.8),
    },
});
