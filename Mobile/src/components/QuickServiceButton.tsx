import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';

type QuickServiceButtonProps = {
  icon: string;
  label: string;
  onPress?: () => void;
};

export default function QuickServiceButton({ icon, label, onPress }: QuickServiceButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.button}
      onPress={onPress}
    >
      <View style={styles.iconBox}>
        <Icon name={icon} size={wp(6)} color="#333" />
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: wp(15),
    height: wp(15),
    borderRadius: wp(7.5),
    borderWidth: 0,
    backgroundColor: '#FFD700',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  label: {
    fontSize: wp(2.8),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
    marginTop: hp(0.4),
  },
});
