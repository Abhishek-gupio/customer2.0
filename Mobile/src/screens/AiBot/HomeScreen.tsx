import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Animated, Easing } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

const SIZE = 180;

export default function AnimatedOrb() {
  const scale = useRef(new Animated.Value(1)).current;
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Breathing pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.08,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Slow rotation
    Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [scale, rotation]);

  const spin = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.glow, { transform: [{ scale }, { rotate: spin }] }]}>
        <Svg width={SIZE} height={SIZE}>
          <Defs>
            <RadialGradient id="grad" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#5DA9FF" stopOpacity="0.9" />
              <Stop offset="60%" stopColor="#1B3A6F" stopOpacity="0.8" />
              <Stop offset="100%" stopColor="#020617" stopOpacity="1" />
            </RadialGradient>
          </Defs>

          <Circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={SIZE / 2}
            fill="url(#grad)"
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },

  glow: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    shadowColor: "#5DA9FF",
    shadowOpacity: 0.8,
    shadowRadius: 40,
    elevation: 20, // Android glow
  },
});