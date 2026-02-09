import React from 'react';
import {
  TouchableOpacity,
  Text,
  Image,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  onPress: () => void;
  title: string;
  iconSize?: number;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  title,
  iconSize = 24,
  style,
  textStyle,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Image
        source={require('../assets/images/Gicon.png')}
        style={[styles.icon, { width: iconSize, height: iconSize }]}
        resizeMode="contain"
      />
      <Text style={[styles.text, textStyle]}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFC107',
    borderRadius: 8,
    gap: 10,
  },
  icon: {
    width: 24,
    height: 24,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
});
