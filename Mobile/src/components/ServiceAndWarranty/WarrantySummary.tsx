import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, InteractionManager } from 'react-native';
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

export const WarrantySummary = React.memo(({ active, expired, health }: WarrantySummaryProps) => {
    const clampedHealth = Math.max(0, Math.min(100, Math.round(health || 0)));
    const animatedProgress = useRef(new Animated.Value(0)).current;

    // Dimensions for the Semicircle Gauge
    const R = wp(36); 
    const strokeWidth = wp(4);
    const padding = wp(5);
    const svgWidth = R * 2 + padding * 2;
    const svgHeight = R + padding * 1.5;

    const startX = padding;
    const startY = R + padding;
    const endX = startX + R * 2;

    const pathData = `M ${startX} ${startY} A ${R} ${R} 0 0 1 ${endX} ${startY}`;
    const pathLength = Math.PI * R;

    useEffect(() => {
        const animation = Animated.timing(animatedProgress, {
            toValue: clampedHealth,
            duration: 1200,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: false,
        });
        
        animation.start();
        
        return () => animation.stop();
    }, [clampedHealth, animatedProgress]);

    const strokeDashoffset = animatedProgress.interpolate({
        inputRange: [0, 100],
        outputRange: [pathLength, 0],
    });

    const statusText = clampedHealth >= 80 ? 'SUPREME' : clampedHealth >= 50 ? 'STABLE' : 'CRITICAL';
    const statusColor = clampedHealth >= 80 ? '#FFF' : clampedHealth >= 50 ? '#888' : '#EF4444';

    return (
        <View style={styles.container}>
            <View style={styles.card}>
                <View style={styles.header}>
                    <Text style={styles.title}>VEHICLE RESONANCE</Text>
                    <View style={styles.liveTag}>
                        <View style={styles.dot} />
                        <Text style={styles.liveText}>READY</Text>
                    </View>
                </View>

                <View style={styles.gaugeArea}>
                    <Svg width={svgWidth} height={svgHeight}>
                        <Defs>
                            <SvgGradient id="trackGrad" x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor="#111" />
                                <Stop offset="1" stopColor="#0a0a0a" />
                            </SvgGradient>
                            <SvgGradient id="fillGrad" x1="0" y1="0" x2="1" y2="0">
                                <Stop offset="0" stopColor="#444" />
                                <Stop offset="0.5" stopColor="#FFF" />
                                <Stop offset="1" stopColor="#5F9EA0" />
                            </SvgGradient>
                        </Defs>
                        
                        <Path
                            d={pathData}
                            stroke="url(#trackGrad)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            fill="transparent"
                        />
                        
                        <AnimatedPath
                            d={pathData}
                            stroke="url(#fillGrad)"
                            strokeWidth={strokeWidth}
                            strokeLinecap="round"
                            fill="transparent"
                            strokeDasharray={pathLength}
                            strokeDashoffset={strokeDashoffset}
                        />
                    </Svg>
                    
                    <View style={styles.centerArea}>
                        <Text style={styles.healthNum}>{clampedHealth}</Text>
                        <Text style={[styles.statusLab, { color: statusColor }]}>{statusText}</Text>
                    </View>
                </View>

                <View style={styles.detailsBox}>
                    <Text style={styles.desc}>
                        {clampedHealth >= 80 
                            ? "OPTIMIZED. ALL SYSTEMS OPERATING AT PEAK CAPACITY."
                            : clampedHealth >= 50
                            ? "STABLE. SCHEDULE ROUTINE MAINTENANCE SOON."
                            : "ALERT. CRITICAL COMPONENTS REQUIRE IMMEDIATE ACTION."}
                    </Text>
                </View>

                <View style={styles.footerStats}>
                    <View style={styles.stat}>
                        <View style={styles.iconCircle}>
                            <Icon name="check-decagram" size={wp(5)} color="#FFF" />
                        </View>
                        <View>
                            <Text style={styles.num}>{active}</Text>
                            <Text style={styles.lab}>HEALTHY</Text>
                        </View>
                    </View>
                    
                    <View style={styles.sep} />
                    
                    <View style={styles.stat}>
                        <View style={styles.iconCircle}>
                            <Icon name="alert-circle" size={wp(5)} color="#EF4444" />
                        </View>
                        <View>
                            <Text style={[styles.num, { color: '#EF4444' }]}>{expired}</Text>
                            <Text style={styles.lab}>DUE NOW</Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        marginTop: hp(1),
    },
    card: {
        backgroundColor: '#0a0a0a',
        borderRadius: 32,
        padding: wp(6),
        borderWidth: 1,
        borderColor: '#111',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp(2), 
    },
    title: {
        color: '#444',
        fontSize: wp(2.8),
        fontFamily: 'Outfit-Black',
        letterSpacing: 2,
    },
    liveTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#111',
        paddingHorizontal: wp(2.5),
        paddingVertical: hp(0.5),
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    dot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#5F9EA0',
    },
    liveText: {
        color: '#fff',
        fontSize: wp(2.2),
        fontFamily: 'Outfit-Black',
    },
    gaugeArea: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: hp(1),
    },
    centerArea: {
        position: 'absolute',
        bottom: wp(4),
        alignItems: 'center',
        width: '100%',
    },
    healthNum: {
        fontSize: wp(20),
        fontFamily: 'Outfit-Black',
        color: '#fff',
        lineHeight: wp(22),
    },
    statusLab: {
        fontSize: wp(3.8),
        fontFamily: 'Outfit-Black',
        letterSpacing: 4,
        marginTop: -hp(1),
    },
    detailsBox: {
        alignItems: 'center',
        marginVertical: hp(3),
        paddingHorizontal: wp(5),
    },
    desc: {
        color: '#444',
        fontSize: wp(2.6),
        fontFamily: 'Outfit-Bold',
        textAlign: 'center',
        lineHeight: hp(1.8),
        letterSpacing: 0.5,
    },
    footerStats: {
        flexDirection: 'row',
        backgroundColor: '#050505',
        borderRadius: 20,
        padding: wp(4),
        borderWidth: 1,
        borderColor: '#111',
    },
    stat: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp(3),
        justifyContent: 'center',
    },
    iconCircle: {
        width: wp(10),
        height: wp(10),
        borderRadius: 12,
        backgroundColor: '#111',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    num: {
        fontSize: wp(4.5),
        fontFamily: 'Outfit-Black',
        color: '#fff',
    },
    lab: {
        fontSize: wp(2.2),
        fontFamily: 'Outfit-Black',
        color: '#444',
        marginTop: -2,
    },
    sep: {
        width: 1,
        height: '60%',
        backgroundColor: '#111',
        alignSelf: 'center',
        marginHorizontal: wp(2),
    },
});
