import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type TripPlannerSlideProps = {
  bannerWidth: number;
  onPress: () => void;
};

export const TripPlannerSlide = React.memo(function TripPlannerSlide({
  bannerWidth,
  onPress,
}: TripPlannerSlideProps) {
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
              require('../../../assets/images/trip_planner_banner.png') as any
            }
            style={styles.promoBackgroundImage}
            resizeMode={FastImage.resizeMode.cover}
          />
          <LinearGradient
            colors={[
              'rgba(8,12,18,0.84)',
              'rgba(8,12,18,0.48)',
              'rgba(8,12,18,0.16)',
            ]}
            locations={[0, 0.5, 1]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.promoBackgroundOverlay}
          >
            <View style={styles.promoBackgroundContent}>
              <Text
                style={[styles.promoSubtitle, styles.tripPlannerPromoSubtitle]}
              >
                Plan Your Journey
              </Text>
              <Text style={styles.promoTitle}>Trip Planner</Text>
              <Text style={styles.promoDesc}>
                Build your route, estimate costs, and organize stops before you
                travel.
              </Text>
              <View style={styles.promoAction}>
                <Text
                  style={[
                    styles.promoActionText,
                    styles.tripPlannerPromoActionText,
                  ]}
                >
                  Start Planning
                </Text>
                <MaterialIcon name="chevron-right" size={18} color="#34D399" />
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
});
