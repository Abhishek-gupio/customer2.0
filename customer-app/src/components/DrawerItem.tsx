// DrawerItem.tsx
import React, { useMemo } from 'react';
import { TouchableOpacity, View, Text, Image, StyleSheet, Platform } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useWindowDimensions } from 'react-native';

type Props = {
  label: string;
  icon: any;
  onPress: () => void;
  isLogout?: boolean;
  showSeparator?: boolean;
};

const DrawerItem: React.FC<Props> = ({
  label,
  icon,
  onPress,
  isLogout = false,
  showSeparator = false,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTablet = useMemo(() => windowWidth >= 768 || Math.max(windowWidth, windowHeight) / Math.min(windowWidth, windowHeight) < 1.6, [windowWidth, windowHeight]);

  const touchVertical = isTablet ? hp('1.6%') : hp('1.2%');

  const iconSize = isTablet ? wp('7%') : wp('6%');
  const textFontSize = isTablet ? hp('2.6%') : hp('2%');

  return (
    <>
      <TouchableOpacity
        style={[styles.item, { paddingVertical: touchVertical }]}
        onPress={onPress}
        activeOpacity={0.72}
        accessibilityRole="button"
        accessibilityLabel={label}
        // increase hit area for iOS small screens; still fine on Android
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Image source={icon} style={[styles.itemIcon, { width: iconSize, height: iconSize }]} resizeMode="contain" />
        <Text
          style={[styles.itemText, { fontSize: textFontSize }, isLogout && styles.logoutText]}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling
        >
          {label}
        </Text>
      </TouchableOpacity>
      {showSeparator && <View style={styles.separator} />}
    </>
  );
};

export default React.memo(DrawerItem);

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: wp('2%'),
    paddingRight: wp('2%'),
    borderRadius: wp('2%'),
    width: '100%',
  },
  itemIcon: {
    marginRight: wp('3%'),
  },
  itemText: {
    fontWeight: Platform.OS === 'ios' ? '600' : '700',
    color: '#000',
    flexShrink: 1,
    includeFontPadding: false,
    lineHeight: undefined,
  },
  logoutText: {
    color: '#FF0C0C',
  },
  separator: {
    height: hp('0.12%'),
    backgroundColor: '#E0E0E0',
    width: '100%',
    marginVertical: hp('1%'),
  },
});