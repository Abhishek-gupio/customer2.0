import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing } from 'react-native';
import { healthStyles } from '../homeStyles';

export const HealthDisplay = React.memo(function HealthDisplay({
  score,
}: {
  score: number;
}) {
  const countAnim = useRef(new Animated.Value(0)).current;
  const barAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [displayScore, setDisplayScore] = React.useState(0);

  useEffect(() => {
    countAnim.setValue(0);
    barAnim.setValue(0);
    fadeAnim.setValue(0);

    const countListener = countAnim.addListener(({ value }) => {
      setDisplayScore(Math.round(value));
    });

    Animated.parallel([
      Animated.timing(countAnim, {
        toValue: score,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(barAnim, {
        toValue: score,
        duration: 1500,
        easing: Easing.out(Easing.exp),
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.delay(1200),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    return () => {
      countAnim.removeListener(countListener);
    };
  }, [score]);

  const color = score >= 80 ? '#4ade80' : score >= 50 ? '#facc15' : '#f87171';
  const label = score >= 80 ? 'EXCELLENT' : score >= 50 ? 'GOOD' : 'CRITICAL';
  const barWidth = barAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={healthStyles.container}>
      <View style={healthStyles.row}>
        {/* Animated count-up score */}
        <Text style={[healthStyles.score, { color }]}>
          {displayScore}
          <Text style={healthStyles.scoreUnit}>%</Text>
        </Text>
        {/* Fade-in status pill */}
        <Animated.View
          style={[
            healthStyles.statusPill,
            {
              opacity: fadeAnim,
              borderColor: `${color}55`,
              backgroundColor: `${color}18`,
            },
          ]}
        >
          <Text style={[healthStyles.statusText, { color }]}>{label}</Text>
        </Animated.View>
      </View>
      {/* Animated fill bar */}
      <View style={healthStyles.barBg}>
        <Animated.View
          style={[
            healthStyles.barFill,
            { width: barWidth, backgroundColor: color, shadowColor: color },
          ]}
        />
      </View>
      <Text style={healthStyles.subLabel}>VEHICLE HEALT</Text>
    </View>
  );
});
