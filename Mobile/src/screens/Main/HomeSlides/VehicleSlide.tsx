import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
  type ImageSourcePropType,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import type { Vehicle } from '../../../services/vehicleService';
import { HealthDisplay } from '../components/HealthDisplay';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type VehicleSlideProps = {
  bannerWidth: number;
  vehicleLoading: boolean;
  vehicle: Vehicle | null;
  serviceDueText: string;
  navigateToGarageTab: () => void;
  getBannerVehicleShortName: (vehicle: Vehicle | null) => string;
};

export const VehicleSlide = React.memo(function VehicleSlide({
  bannerWidth,
  vehicleLoading,
  vehicle,
  serviceDueText,
  navigateToGarageTab,
  getBannerVehicleShortName,
}: VehicleSlideProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heroImageSource = useMemo<ImageSourcePropType>(() => {
    const vehicleImageUrl = vehicle?.imageUrl as string | undefined;
    const fallbackHeroImage = (
      vehicle?.vehicleType === 'BIKE'
        ? require('../../../assets/images/bike.png')
        : require('../../../assets/images/car_vehicle_demo.png')
    ) as ImageSourcePropType;

    return vehicleImageUrl && vehicleImageUrl.length > 0
      ? ({ uri: vehicleImageUrl } as ImageSourcePropType)
      : fallbackHeroImage;
  }, [vehicle?.imageUrl, vehicle?.vehicleType]);

  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.92}
        onPress={navigateToGarageTab}
      >
        <View style={styles.primaryImageWrap}>
          <FastImage
            source={heroImageSource as any}
            style={styles.primaryImageFull}
            resizeMode={FastImage.resizeMode.cover}
          />
          <LinearGradient
            colors={[
              'transparent',
              'rgba(0,0,0,0.25)',
              'rgba(0,0,0,0.72)',
              'rgba(0,0,0,0.92)',
            ]}
            locations={[0, 0.3, 0.65, 1]}
            style={styles.primaryImageOverlay}
          >
            <View style={styles.bannerBottomRow}>
              {vehicleLoading ? (
                <ActivityIndicator
                  color="#fff"
                  style={{ alignSelf: 'flex-end' }}
                />
              ) : vehicle ? (
                <View style={styles.vehicleBannerContent}>
                  <View style={styles.regBadge}>
                    <View style={styles.regIndStrip}>
                      <Text style={styles.regFlagEmoji}>🇮🇳</Text>
                      <Text style={styles.regIndText}>IND</Text>
                    </View>
                    <Text style={styles.regBadgeText}>
                      {vehicle.registrationNumber}
                    </Text>
                  </View>
                  <Text style={styles.bannerModel}>
                    {getBannerVehicleShortName(vehicle)}
                  </Text>
                  <HealthDisplay
                    score={vehicle.healthScore?.overallScore ?? 100}
                  />
                </View>
              ) : (
                <View style={styles.vehicleBannerContent}>
                  <Text style={styles.bannerMake}>My Garage</Text>
                  <Text style={styles.bannerModel}>
                    Add your vehicle to get started
                  </Text>
                </View>
              )}

              <View style={styles.serviceDueChip}>
                <Text style={styles.serviceDueLabel}>DUE IN</Text>
                <Text style={styles.serviceDueValue}>{serviceDueText}</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </View>
  );
});
