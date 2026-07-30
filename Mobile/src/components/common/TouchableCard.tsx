import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { triggerHaptic } from '../../utils/haptics';

interface TouchableCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  scaleTo?: number;
}

export const TouchableCard: React.FC<TouchableCardProps> = ({
  children,
  onPress,
  onLongPress,
  style,
  activeOpacity = 0.88,
  scaleTo = 0.97,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: scaleTo,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const handlePress = () => {
    triggerHaptic('light');
    onPress?.();
  };

  const handleLongPress = () => {
    triggerHaptic('medium');
    onLongPress?.();
  };

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        activeOpacity={activeOpacity}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onLongPress={handleLongPress}
        style={styles.fullWidth}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullWidth: {
    width: '100%',
  },
});

export default TouchableCard;
