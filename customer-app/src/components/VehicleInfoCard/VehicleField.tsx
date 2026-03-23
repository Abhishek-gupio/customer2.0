import React from 'react';
import { View, Text, StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useResponsive } from '../../hooks/useResponsive';

interface VehicleFieldProps {
  label: string;
  value: string;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
  valueStyle?: TextStyle;
}

const VehicleField: React.FC<VehicleFieldProps> = ({
  label,
  value,
  rightIcon,
  containerStyle,
  valueStyle,
}) => {
  const { screenHeight } = useResponsive();
  
  // Detect resolution based on screen height
  const getResolution = () => {
    if (screenHeight <= 600) return '480p';
    if (screenHeight <= 800) return '720p';
    if (screenHeight <= 1200) return '1080p';
    return '1440p';
  };

  const resolution = getResolution();
  const is480p = resolution === '480p';
  const is720p = resolution === '720p';
  const is1080p = resolution === '1080p';
  const is1440p = resolution === '1440p';

  return (
    <View style={[
      styles.wrapper,
      is480p && styles.wrapper480p,
      is720p && styles.wrapper720p,
      is1080p && styles.wrapper1080p,
      is1440p && styles.wrapper1440p,
      containerStyle
    ]}>
      <Text style={[
        styles.label,
        is480p && styles.label480p,
        is720p && styles.label720p,
        is1080p && styles.label1080p,
        is1440p && styles.label1440p,
      ]}>
        {label}
      </Text>
      <View style={[
        styles.valueRow,
        is480p && styles.valueRow480p,
        is720p && styles.valueRow720p,
        is1080p && styles.valueRow1080p,
        is1440p && styles.valueRow1440p,
      ]}>
        <Text style={[
          styles.value,
          is480p && styles.value480p,
          is720p && styles.value720p,
          is1080p && styles.value1080p,
          is1440p && styles.value1440p,
          valueStyle
        ]}>
          {value}
        </Text>
        {rightIcon}
      </View>
    </View>
  );
};

export default VehicleField;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: hp('1.5%'),
  },
  label: {
    fontSize: hp('1.75%'),
    color: '#1F1B4E',
    marginBottom: hp('0.5%'),
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF0FB',
    borderRadius: hp('1%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
  },
  value: {
    flex: 1,
    fontSize: hp('2%'),
    color: '#1F1B4E',
  },
  // 480p
  wrapper480p: {
    marginBottom: hp('1.2%'),
  },
  label480p: {
    fontSize: hp('1.5%'),
    marginBottom: hp('0.4%'),
  },
  valueRow480p: {
    borderRadius: hp('0.8%'),
    paddingHorizontal: wp('2.5%'),
    paddingVertical: hp('1%'),
  },
  value480p: {
    fontSize: hp('1.7%'),
  },
  // 720p
  wrapper720p: {
    marginBottom: hp('1.3%'),
  },
  label720p: {
    fontSize: hp('1.6%'),
    marginBottom: hp('0.45%'),
  },
  valueRow720p: {
    borderRadius: hp('0.9%'),
    paddingHorizontal: wp('2.8%'),
    paddingVertical: hp('1.1%'),
  },
  value720p: {
    fontSize: hp('1.85%'),
  },
  // 1080p
  wrapper1080p: {
    marginBottom: hp('1.5%'),
  },
  label1080p: {
    fontSize: hp('1.75%'),
    marginBottom: hp('0.5%'),
  },
  valueRow1080p: {
    borderRadius: hp('1%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.2%'),
  },
  value1080p: {
    fontSize: hp('2%'),
  },
  // 1440p
  wrapper1440p: {
    marginBottom: hp('1.7%'),
  },
  label1440p: {
    fontSize: hp('2%'),
    marginBottom: hp('0.6%'),
  },
  valueRow1440p: {
    borderRadius: hp('1.2%'),
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('1.4%'),
  },
  value1440p: {
    fontSize: hp('2.3%'),
  },
});
