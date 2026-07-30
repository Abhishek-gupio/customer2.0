import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  style?: any;
}

export const SkeletonBox: React.FC<SkeletonProps> = ({
  width = '100%',
  height = hp('6%'),
  borderRadius = 12,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-wp('90%'), wp('90%')],
  });

  return (
    <View
      style={[
        styles.skeletonContainer,
        { width: width as any, height: height as any, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255, 255, 255, 0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

export const VehicleSkeletonCard = () => (
  <View style={styles.cardSkeleton}>
    <SkeletonBox width="100%" height={hp('14%')} borderRadius={16} />
    <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
      <SkeletonBox width="48%" height={hp('8%')} borderRadius={12} />
      <SkeletonBox width="48%" height={hp('8%')} borderRadius={12} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  skeletonContainer: {
    backgroundColor: '#161924',
    overflow: 'hidden',
    position: 'relative',
  },
  cardSkeleton: {
    padding: wp('4%'),
    backgroundColor: '#11131C',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: hp('2%'),
  },
});

export default SkeletonBox;
