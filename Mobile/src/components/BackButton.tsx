import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

interface BackButtonProps {
  onPress: () => void;
  style?: ViewStyle;
  isAbsolute?: boolean;
}

/**
 * Standardised back button used across all screens.
 * – 44×44 touchable for accessibility minimum target
 * – Rounded square (borderRadius 14) dark glass background
 * – Always white arrow-left icon at wp(4.5)
 * – Position is controlled by the parent via `style` prop (position: 'absolute' etc.)
 */
export default function BackButton({ onPress, style, isAbsolute = false }: BackButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={[styles.btn, isAbsolute && styles.absoluteBtn, style]}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Icon name="arrow-left" size={wp(4.5)} color="#fff" />
    </TouchableOpacity>
  );
}

export const BACK_BUTTON_TOP = hp(5.5); // shared top offset for all screens
export const BACK_BUTTON_LEFT = wp(5);  // shared left offset for all screens

const styles = StyleSheet.create({
  btn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  absoluteBtn: {
    position: 'absolute',
    top: BACK_BUTTON_TOP,
    left: BACK_BUTTON_LEFT,
  },
});
