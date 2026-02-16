import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';

const ICON_COLORS: Record<string, string> = {
  Service: '#e74c3c',
  Booking: '#1abc9c',
  History: '#3498db',
  Support: '#e91e63',
  Vehicles: '#9b59b6',
  Documents: '#e91e63',
  Expenses: '#2196f3',
  Valet: '#b0bec5',
};

type QuickServiceButtonProps = {
  icon: string;
  label: string;
  onPress?: () => void;
};

export default function QuickServiceButton({ icon, label, onPress }: QuickServiceButtonProps) {
  const bgColor = ICON_COLORS[label] ?? '#607d8b';
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.button}
      onPress={onPress}
    >
      <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
        <Icon name={icon} size={wp(5.5)} color="#fff" />
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    width: wp(22),
  },
  iconCircle: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  label: {
    fontSize: wp(3.2),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
