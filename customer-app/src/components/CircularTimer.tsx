import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularTimerProps {
  /** Total countdown time in seconds */
  totalTime: number;
  /** Initial time left in seconds (used to resume timer) */
  initialTimeLeft?: number;
  /** Size of the SVG square (width & height) */
  size?: number;
  /** Stroke width of the circle */
  strokeWidth?: number;
  /** Active ring color */
  progressColor?: string;
  /** Background ring color */
  trackColor?: string;
  /** Text style for the timer in the center */
  textStyle?: TextStyle;
  /** Container style override */
  containerStyle?: ViewStyle;
  /** Optional callback when timer reaches 0 */
  onComplete?: () => void;
}

const CircularTimer: React.FC<CircularTimerProps> = ({
  totalTime,
  initialTimeLeft,
  size = 120,
  strokeWidth = 8,
  progressColor = '#00D160',
  trackColor = '#FFFFFF',
  textStyle,
  containerStyle,
  onComplete,
}) => {
  const RADIUS = size / 2 - strokeWidth / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

  // Use initialTimeLeft if provided, otherwise start from totalTime
  const [timeLeft, setTimeLeft] = useState(initialTimeLeft !== undefined ? initialTimeLeft : totalTime);

  // Update timeLeft when initialTimeLeft prop changes (when modal reopens)
  useEffect(() => {
    if (initialTimeLeft !== undefined) {
      setTimeLeft(initialTimeLeft);
    }
  }, [initialTimeLeft]);

  useEffect(() => {
    if (timeLeft === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onComplete?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, onComplete]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  const progress = (timeLeft / totalTime) * CIRCUMFERENCE;

  return (
    <View
      style={[styles.wrapper, containerStyle, { width: size, height: size }]}
    >
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={RADIUS}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE - progress}
          strokeLinecap="round"
          fill="none"
          rotation="-90"
          origin={`${size / 2},${size / 2}`}
        />
      </Svg>
      <Text style={[styles.timeText, textStyle]}>{formattedTime}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeText: {
    position: 'absolute',
    fontSize: 18,
    fontWeight: '600',
    color: '#1F1B4E',
  },
});

export default CircularTimer;
