import React, { useRef } from 'react';
import {
  StyleSheet,
  Image,
  Animated,
  PanResponder,
  LayoutChangeEvent,
  TouchableWithoutFeedback,
  Easing,
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useResponsive } from '../hooks/useResponsive';

interface PrimaryButtonProps {
  title: string;
  onPress: () => void; // fired on tap
  onSwipeSuccess?: () => void; // fired when swipe completes
  icon?: any; // require('path/to/image')
  swipeThreshold?: number; // % of width to swipe before success (default = 60%)
}

const PRIMARY_COLOR = '#3730A5';

const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  title,
  onPress,
  onSwipeSuccess,
  icon,
  swipeThreshold = 0.6,
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

  const translateX = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const buttonWidth = useRef(0);

  const reset = () =>
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start(() => progress.setValue(0));

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!onSwipeSuccess,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dx > 0) {
          const dx = Math.min(gesture.dx, buttonWidth.current - 60);
          translateX.setValue(dx);
          progress.setValue(dx / (buttonWidth.current - 60));
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const requiredDx = buttonWidth.current * swipeThreshold;
        if (gesture.dx > requiredDx) {
          Animated.timing(translateX, {
            toValue: buttonWidth.current - 60,
            duration: 200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }).start(() => {
            onSwipeSuccess?.();
            reset();
          });
        } else {
          reset();
        }
      },
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    buttonWidth.current = e.nativeEvent.layout.width;
  };

  // Animate background and text opacity
  const bgColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['#fff', PRIMARY_COLOR],
  });

  const textOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0], // fade out only
  });

  const textColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PRIMARY_COLOR, '#fff'],
  });

  return (
    <TouchableWithoutFeedback onPress={onPress}>
      <Animated.View
        style={[
          styles.container,
          is480p && styles.container480p,
          is720p && styles.container720p,
          is1080p && styles.container1080p,
          is1440p && styles.container1440p,
          { backgroundColor: bgColor }
        ]}
        onLayout={onLayout}
      >
        {icon && (
          <Animated.View
            style={[
              styles.iconCircle,
              is480p && styles.iconCircle480p,
              is720p && styles.iconCircle720p,
              is1080p && styles.iconCircle1080p,
              is1440p && styles.iconCircle1440p,
              { transform: [{ translateX }], zIndex: 1 },
            ]}
            {...(onSwipeSuccess ? panResponder.panHandlers : {})}
          >
            <Image
              source={icon}
              style={[
                styles.icon,
                is480p && styles.icon480p,
                is720p && styles.icon720p,
                is1080p && styles.icon1080p,
                is1440p && styles.icon1440p,
              ]}
              resizeMode="contain"
            />
          </Animated.View>
        )}

        <Animated.Text
          style={[
            styles.text,
            is480p && styles.text480p,
            is720p && styles.text720p,
            is1080p && styles.text1080p,
            is1440p && styles.text1440p,
            {
              opacity: textOpacity,
              color: textColor,
              marginLeft: is480p ? wp('2%') : is720p ? wp('2.5%') : wp('2.5%'),
              zIndex: 0,
            },
          ]}
        >
          {title} ➔
        </Animated.Text>
      </Animated.View>
    </TouchableWithoutFeedback>
  );
};

export default PrimaryButton;

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    overflow: 'hidden',
    borderRadius: hp('5%'),
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingVertical: hp('0.5%'),
    paddingHorizontal: wp('1%'),
    borderColor: '#00097959',
    borderWidth: 0.5,
  },
  iconCircle: {
    marginRight: wp('12%'),
    width: wp('11%'),
    height: wp('11%'),
    minWidth: 40,
    minHeight: 40,
    borderRadius: wp('5.5%'),
    borderWidth: 1,
    borderColor: '#00097959',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: wp('1.2%'),
  },
  icon: {
    width: wp('12%'),
    height: wp('12%'),
    minWidth: 45,
    minHeight: 45,
  },
  text: {
    flex: 1,
    fontWeight: '600',
    fontSize: hp('1.6%'),
  },
  // 480p
  container480p: {
    borderRadius: hp('4%'),
    paddingVertical: hp('0.4%'),
    paddingHorizontal: wp('0.8%'),
  },
  iconCircle480p: {
    marginRight: wp('10%'),
    width: wp('9%'),
    height: wp('9%'),
    minWidth: 35,
    minHeight: 35,
    borderRadius: wp('4.5%'),
    padding: wp('1%'),
  },
  icon480p: {
    width: wp('10%'),
    height: wp('10%'),
    minWidth: 40,
    minHeight: 40,
  },
  text480p: {
    fontSize: hp('1.8%'),
  },
  // 720p
  container720p: {
    borderRadius: hp('4.5%'),
    paddingVertical: hp('0.45%'),
    paddingHorizontal: wp('0.9%'),
  },
  iconCircle720p: {
    marginRight: wp('11%'),
    width: wp('10%'),
    height: wp('10%'),
    minWidth: 38,
    minHeight: 38,
    borderRadius: wp('5%'),
    padding: wp('1.1%'),
  },
  icon720p: {
    width: wp('11%'),
    height: wp('11%'),
    minWidth: 42,
    minHeight: 42,
  },
  text720p: {
    fontSize: hp('1.9%'),
  },
  // 1080p
  container1080p: {
    borderRadius: hp('5%'),
    paddingVertical: hp('0.5%'),
    paddingHorizontal: wp('1%'),
  },
  iconCircle1080p: {
    marginRight: wp('12%'),
    width: wp('11%'),
    height: wp('11%'),
    minWidth: 40,
    minHeight: 40,
    borderRadius: wp('5.5%'),
    padding: wp('1.2%'),
  },
  icon1080p: {
    width: wp('12%'),
    height: wp('12%'),
    minWidth: 45,
    minHeight: 45,
  },
  text1080p: {
    fontSize: hp('1.8%'),
  },
  // 1440p
  container1440p: {
    borderRadius: hp('5.5%'),
    paddingVertical: hp('0.6%'),
    paddingHorizontal: wp('1.2%'),
  },
  iconCircle1440p: {
    marginRight: wp('13%'),
    width: wp('12%'),
    height: wp('12%'),
    minWidth: 45,
    minHeight: 45,
    borderRadius: wp('6%'),
    padding: wp('1.4%'),
  },
  icon1440p: {
    width: wp('13%'),
    height: wp('13%'),
    minWidth: 50,
    minHeight: 50,
  },
  text1440p: {
    fontSize: hp('1.8%'),
  },
});
