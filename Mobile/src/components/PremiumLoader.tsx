import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

type LoaderSize = 'small' | 'large' | number;

type PremiumLoaderProps = {
  size?: LoaderSize;
  label?: string;
  tint?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZE_MAP: Record<'small' | 'large', number> = {
  small: 36,
  large: 72,
};

export default function PremiumLoader({
  size = 'large',
  label,
  tint = '#FFBF00',
  style,
}: PremiumLoaderProps) {
  const resolvedSize =
    typeof size === 'number' ? Math.max(24, size) : SIZE_MAP[size];
  const ringThickness = Math.max(3, Math.round(resolvedSize * 0.1));
  const innerSize = resolvedSize - ringThickness * 2;
  const coreSize = Math.round(innerSize * 0.42);

  const spinAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 700,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 700,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [pulseAnim, spinAnim]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.08],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.45, 0.92],
  });

  const glowColor = useMemo(() => `${tint}66`, [tint]);
  const labelText = label ?? 'Loading...';

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.shell, { width: resolvedSize, height: resolvedSize }]}>
        <Animated.View
          style={[
            styles.rotator,
            {
              width: resolvedSize,
              height: resolvedSize,
              borderRadius: resolvedSize / 2,
              transform: [{ rotate: spin }],
            },
          ]}
        >
          <LinearGradient
            colors={[`${tint}10`, tint, '#ffffff', tint]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.ring,
              {
                borderRadius: resolvedSize / 2,
              },
            ]}
          />
        </Animated.View>

        <View
          style={[
            styles.innerMask,
            {
              width: innerSize,
              height: innerSize,
              borderRadius: innerSize / 2,
            },
          ]}
        />

        <Animated.View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
              backgroundColor: tint,
              shadowColor: glowColor,
              transform: [{ scale: pulseScale }],
              opacity: pulseOpacity,
            },
          ]}
        />
      </View>

      <Text style={styles.label}>{labelText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  shell: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  rotator: {
    position: 'absolute',
  },
  ring: {
    ...StyleSheet.absoluteFillObject,
  },
  innerMask: {
    backgroundColor: '#0b0b0d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  core: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  label: {
    color: '#F5F5F5',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    fontFamily: 'Outfit-SemiBold',
  },
});
