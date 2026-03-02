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
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={styles.button}
      onPress={onPress}
    >
      <View style={styles.iconCircle}>
        {typeof icon === 'string' ? (
          <Icon name={icon} size={wp(7.5)} color="#fff" />
        ) : (
          <Image source={icon} style={styles.imageIcon} resizeMode="contain" />
        )}
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
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  imageIcon: {
    width: wp(14),
    height: wp(14),
  },
  label: {
    fontSize: wp(3.2),
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});
