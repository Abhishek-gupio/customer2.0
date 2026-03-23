import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useResponsive } from '../hooks/useResponsive';
const PRIMARY_COLOR = '#3730A5';
interface InfoRowProps {
  label: string;
  value: string;
  /** make value bold/colored to highlight important data */
  highlight?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  valueStyle?: StyleProp<TextStyle>;
}
const InfoRow: React.FC<InfoRowProps> = ({
  label,
  value,
  highlight = false,
  containerStyle,
  labelStyle,
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
    <View
      style={[
        styles.row,
        is480p && styles.row480p,
        is720p && styles.row720p,
        is1080p && styles.row1080p,
        is1440p && styles.row1440p,
        containerStyle,
      ]}
    >
      <Text
        style={[
          styles.label,
          is480p && styles.label480p,
          is720p && styles.label720p,
          is1080p && styles.label1080p,
          is1440p && styles.label1440p,
          labelStyle,
        ]}
        numberOfLines={1}
      >
        {label} :
      </Text>
      <Text
        style={[
          styles.value,
          is480p && styles.value480p,
          is720p && styles.value720p,
          is1080p && styles.value1080p,
          is1440p && styles.value1440p,
          highlight && styles.highlight,
          valueStyle,
        ]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {value}
      </Text>
    </View>
  );
};

export default InfoRow;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.7%'),
  },
  label: {
    fontSize: hp('1.75%'),
    color: '#1F1B4E',
    flexShrink: 0,
  },
  value: {
    marginLeft: wp('1%'),
    fontSize: hp('1.75%'),
    color: PRIMARY_COLOR,
    flexShrink: 1,
    flexGrow: 1,
  },
  highlight: {
    fontWeight: '600',
  },
  // 480p
  row480p: {
    marginBottom: hp('0.5%'),
  },
  label480p: {
    fontSize: hp('1.7%'),
  },
  value480p: {
    marginLeft: wp('0.8%'),
    fontSize: hp('1.7%'),
  },
  // 720p
  row720p: {
    marginBottom: hp('0.6%'),
  },
  label720p: {
    fontSize: hp('1.6%'),
  },
  value720p: {
    marginLeft: wp('0.9%'),
    fontSize: hp('1.6%'),
  },
  // 1080p
  row1080p: {
    marginBottom: hp('0.7%'),
  },
  label1080p: {
    fontSize: hp('1.75%'),
  },
  value1080p: {
    marginLeft: wp('1%'),
    fontSize: hp('1.75%'),
  },
  // 1440p
  row1440p: {
    marginBottom: hp('0.8%'),
  },
  label1440p: {
    fontSize: hp('2%'),
  },
  value1440p: {
    marginLeft: wp('1.2%'),
    fontSize: hp('2%'),
  },
});
