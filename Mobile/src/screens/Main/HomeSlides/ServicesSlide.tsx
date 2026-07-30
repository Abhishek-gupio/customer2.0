import React, { useMemo } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type ServicesSlideProps = {
  bannerWidth: number;
  onPress: () => void;
};

export const ServicesSlide = React.memo(function ServicesSlide({
  bannerWidth,
  onPress,
}: ServicesSlideProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.promoSlide}>
          <View style={styles.promoLeft}>
            <Text style={[styles.promoSubtitle, { color: '#4ade80' }]}>
              Premium Care
            </Text>
            <Text style={styles.promoTitle}>Featured Services</Text>
            <Text style={styles.promoDesc}>
              Book maintenance, car wash, and emergency repairs instantly.
            </Text>
            <View style={styles.promoAction}>
              <Text style={[styles.promoActionText, { color: '#4ade80' }]}>
                Explore
              </Text>
              <MaterialIcon name="chevron-right" size={18} color="#4ade80" />
            </View>
          </View>
          <View style={styles.promoRight}>
            <Image
              source={require('../../../assets/images/vehicle_AD.png') as any}
              style={styles.adImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});
