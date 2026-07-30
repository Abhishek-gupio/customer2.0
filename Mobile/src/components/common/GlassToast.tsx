import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { triggerHaptic } from '../../utils/haptics';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'info' | 'warning';
  icon?: string;
  onHide?: () => void;
  duration?: number;
}

export const GlassToast: React.FC<ToastProps> = ({
  visible,
  message,
  type = 'success',
  icon = 'check-circle-outline',
  onHide,
  duration = 2500,
}) => {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      triggerHaptic('success');
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      hideToast();
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: -100,
        duration: 250,
        easing: Easing.in(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!visible) return null;

  const accentColor =
    type === 'success' ? '#30D158' : type === 'warning' ? '#FF9F0A' : '#5F9EA0';

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <TouchableOpacity activeOpacity={0.9} onPress={hideToast} style={styles.toastInner}>
        <View style={[styles.iconBox, { backgroundColor: `${accentColor}20`, borderColor: `${accentColor}40` }]}>
          <IconMC name={icon} size={wp(5)} color={accentColor} />
        </View>
        <Text style={styles.toastText} numberOfLines={2}>
          {message}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toastWrapper: {
    position: 'absolute',
    top: hp(6),
    left: wp(5),
    right: wp(5),
    zIndex: 9999,
    alignItems: 'center',
  },
  toastInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161926E6',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: wp(7),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  iconBox: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  toastText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: hp(1.5),
    fontFamily: 'Outfit-Medium',
  },
});

export default GlassToast;
