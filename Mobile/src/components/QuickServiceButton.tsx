import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, type ImageSourcePropType } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';

type QuickServiceButtonProps = {
  icon: string | ImageSourcePropType;
  label: string;
  onPress?: () => void;
};

export default function QuickServiceButton({ icon, label, onPress }: QuickServiceButtonProps) {
  const isImageIcon = typeof icon !== 'string';

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      style={styles.button}
      onPress={onPress}
    >
      <View style={styles.iconBox}>
        {isImageIcon ? (
          <Image source={icon} style={styles.imageIcon} resizeMode="contain" />
        ) : (
          <Icon name={icon as string} size={wp(5.5)} color="#fff" />
        )}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(4),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
  },
  imageIcon: {
    width: wp(9),
    height: wp(9),
  },
  label: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#eee',
    textAlign: 'center',
    marginTop: hp(0.4),
  },
});
