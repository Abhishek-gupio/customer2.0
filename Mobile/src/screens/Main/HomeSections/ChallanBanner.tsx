import React, { useMemo } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type ChallanBannerProps = {
  onPress: () => void;
};

export const ChallanBanner = React.memo(function ChallanBanner({
  onPress,
}: ChallanBannerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.bannerSection}>
      <View style={styles.insuranceBanner}>
        <Image
          source={require('../../../assets/images/challan.png') as any}
          style={styles.bannerImage}
          resizeMode="contain"
        />
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>
            Check Your Challans & Avoid Trouble!
          </Text>
          <Text style={styles.bannerDesc}>
            Settle now to avoid late fees and skip the hassle of going to court.
          </Text>
          <TouchableOpacity style={styles.payNowButton} onPress={onPress}>
            <Text style={styles.payNowText}>Check Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});
