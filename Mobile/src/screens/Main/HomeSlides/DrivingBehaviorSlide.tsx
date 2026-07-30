import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type DrivingBehaviorSlideProps = {
  bannerWidth: number;
  onPress: () => void;
};

export const DrivingBehaviorSlide = React.memo(function DrivingBehaviorSlide({
  bannerWidth,
  onPress,
}: DrivingBehaviorSlideProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.slideFull}>
          <FastImage
            source={
              require('../../../assets/images/driving_behavior_banner_v2.png') as any
            }
            style={styles.promoBackgroundImage}
            resizeMode={FastImage.resizeMode.cover}
          />
          <LinearGradient
            colors={[
              'rgba(5,7,10,0.82)',
              'rgba(5,7,10,0.46)',
              'rgba(5,7,10,0.14)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.promoBackgroundOverlay}
          >
            <View style={styles.promoBackgroundContent}>
              <Text style={[styles.promoSubtitle, styles.drivingPromoSubtitle]}>
                Drive Safely
              </Text>
              <Text style={styles.promoTitle}>Driving Behavior</Text>
              <Text style={styles.promoDesc}>
                Check speeding, braking, and trip safety insights in one place.
              </Text>
              <View style={styles.promoAction}>
                <Text
                  style={[
                    styles.promoActionText,
                    styles.drivingPromoActionText,
                  ]}
                >
                  View Driving Score
                </Text>
                <MaterialIcon name="chevron-right" size={18} color="#60A5FA" />
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
});
