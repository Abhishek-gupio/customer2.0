import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { COLORS } from '../../../components/Vehicles/VehicleUI';
import { getLastOdometerUpdate } from '../../../services/storage';
import type { Vehicle } from '../../../services/vehicleService';
import { styles } from '../homeStyles';

type OdometerSlideProps = {
  bannerWidth: number;
  vehicle: Vehicle | null;
  onPress: () => void;
};

export const OdometerSlide = React.memo(function OdometerSlide({
  bannerWidth,
  vehicle,
  onPress,
}: OdometerSlideProps) {
  const lastUpdateNum = vehicle?.id
    ? getLastOdometerUpdate(vehicle.id)
    : undefined;
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const isOverAWeekNum = !!(lastUpdateNum && now - lastUpdateNum > weekMs);
  const daysSinceNum = lastUpdateNum
    ? Math.floor((now - lastUpdateNum) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View
          style={[
            styles.promoSlide,
            isOverAWeekNum
              ? styles.odometerAlertSlide
              : { backgroundColor: '#1A1A1A' },
          ]}
        >
          <View style={styles.promoLeft}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: wp(2),
                marginBottom: hp(1),
              }}
            >
              {isOverAWeekNum ? (
                <Ionicons name="alert-circle" size={18} color="#ff4d4d" />
              ) : null}
              <Text
                style={[
                  styles.promoTitle,
                  { marginBottom: 0 },
                  isOverAWeekNum ? { color: '#ff4d4d' } : undefined,
                ]}
              >
                {isOverAWeekNum ? 'ODOMETER ALERT' : 'Update Odometer'}
              </Text>
            </View>

            {lastUpdateNum ? (
              <View>
                <View style={styles.odometerInfoRow}>
                  <MaterialIcon
                    name="calendar-month"
                    size={14}
                    color={isOverAWeekNum ? '#ff4d4d' : '#888'}
                  />
                  <Text
                    style={[
                      styles.odometerInfoText,
                      isOverAWeekNum ? { color: '#ff4d4d' } : undefined,
                    ]}
                  >
                    {new Date(lastUpdateNum).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    })}
                  </Text>
                  <MaterialIcon
                    name="clock-outline"
                    size={14}
                    color={isOverAWeekNum ? '#ff4d4d' : '#888'}
                    style={{ marginLeft: wp(2) }}
                  />
                  <Text
                    style={[
                      styles.odometerInfoText,
                      isOverAWeekNum ? { color: '#ff4d4d' } : undefined,
                    ]}
                  >
                    {new Date(lastUpdateNum).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true,
                    })}
                  </Text>
                </View>

                <View
                  style={[
                    styles.odometerBadge,
                    isOverAWeekNum ? styles.odometerWarningBadge : undefined,
                  ]}
                >
                  <Text
                    style={[
                      styles.odometerBadgeText,
                      isOverAWeekNum
                        ? styles.odometerWarningBadgeText
                        : undefined,
                    ]}
                  >
                    {isOverAWeekNum
                      ? `${daysSinceNum} days ago`
                      : 'Last Reading'}
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.promoDesc}>
                Start tracking your vehicle health by updating odometer.
              </Text>
            )}

            <View style={[styles.promoAction, { marginTop: hp(1.5) }]}>
              <Text style={[styles.promoActionText, { color: COLORS.primary }]}>
                Update Now
              </Text>
              <MaterialIcon
                name="chevron-right"
                size={18}
                color={COLORS.primary}
              />
            </View>
          </View>
          <View style={styles.promoRight}>
            <Image
              source={require('../../../assets/images/odometer.png') as any}
              style={styles.adImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});
