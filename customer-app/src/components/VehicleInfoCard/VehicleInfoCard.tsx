import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useResponsive } from '../../hooks/useResponsive';
import InfoRow from '../InfoRow';

const closeEye = require('../../assets/closeEye.png');
const openEye = require('../../assets/openEye.png');
const carIcon = require('../../assets/Car.png');
const clockIcon = require('../../assets/clock.png');
const mapPinIcon = require('../../assets/MapPin.png');

interface VehicleInfoCardProps {
  vehicleNumberFull: string;
  vehicleNumberMasked: string;
  pickedBy: string;
  pickupTime: string;
  pickupLocation: string;
}

const PRIMARY_COLOR = '#1F1B4E';

const VehicleInfoCard: React.FC<VehicleInfoCardProps> = ({
  vehicleNumberFull,
  vehicleNumberMasked,
  pickedBy,
  pickupTime,
  pickupLocation,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
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



  // Check if vehicle data exists
  const hasVehicleData = vehicleNumberFull && vehicleNumberFull !== 'No vehicle requested';

  // Format vehicle number display
  const getVehicleNumberDisplay = () => {
    if (!hasVehicleData) {
      return '** ** ** ****';
    }
    return vehicleNumberFull;
  };

  return (
    <View style={[
      styles.card,
      is480p && styles.card480p,
      is720p && styles.card720p,
      is1080p && styles.card1080p,
      is1440p && styles.card1440p,
    ]}>
      {/* Vehicle number field */}
      {/* <VehicleField
        label="Vehicle number"
        value={showVehicleNumber ? vehicleNumberFull : vehicleNumberMasked}
        rightIcon={
          <TouchableOpacity onPress={toggleVehicleNumber} activeOpacity={0.7}>
            <Animated.Image
              source={showVehicleNumber ? openEye : closeEye}
              style={[
                styles.eyeIcon,
                is480p && styles.eyeIcon480p,
                is720p && styles.eyeIcon720p,
                is1080p && styles.eyeIcon1080p,
                is1440p && styles.eyeIcon1440p,
                { transform: [{ scale: scaleAnim }] }
              ]}
              resizeMode="contain"
            />
          </TouchableOpacity>
        }
      /> */}
      {/* License Plate Container - IND + Vehicle Number in one box */}
      <View style={[
        styles.licensePlateContainer,
        is480p && styles.licensePlateContainer480p,
        is720p && styles.licensePlateContainer720p,
        is1080p && styles.licensePlateContainer1080p,
        is1440p && styles.licensePlateContainer1440p,
      ]}>
        {/* IND Badge - Left Side */}
        <View style={[
          styles.indBadge,
          is480p && styles.indBadge480p,
          is720p && styles.indBadge720p,
          is1080p && styles.indBadge1080p,
          is1440p && styles.indBadge1440p,
        ]}>
          <Text style={[
            styles.indText,
            is480p && styles.indText480p,
            is720p && styles.indText720p,
            is1080p && styles.indText1080p,
            is1440p && styles.indText1440p,
          ]}>
            IND
          </Text>
        </View>

        {/* Vehicle Number - Right Side */}
        <View style={[
          styles.vehicleNumberSection,
          is480p && styles.vehicleNumberSection480p,
          is720p && styles.vehicleNumberSection720p,
          is1080p && styles.vehicleNumberSection1080p,
          is1440p && styles.vehicleNumberSection1440p,
        ]}>
          <View style={[
            styles.vehicleNumberRow,
            is480p && styles.vehicleNumberRow480p,
            is720p && styles.vehicleNumberRow720p,
            is1080p && styles.vehicleNumberRow1080p,
            is1440p && styles.vehicleNumberRow1440p,
          ]}>
            <Text style={[
              styles.vehicleNumberText,
              is480p && styles.vehicleNumberText480p,
              is720p && styles.vehicleNumberText720p,
              is1080p && styles.vehicleNumberText1080p,
              is1440p && styles.vehicleNumberText1440p,
            ]}>
              {getVehicleNumberDisplay()}
            </Text>

          </View>
        </View>
      </View>

      {/* Divider line */}
      <LinearGradient
        colors={['#1E2999', '#FFBF00']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[
          styles.divider,
          is480p && styles.divider480p,
          is720p && styles.divider720p,
          is1080p && styles.divider1080p,
          is1440p && styles.divider1440p,
        ]}
      />

      {/* All info rows with icons */}
      <View style={[
        styles.infoRows,
        is480p && styles.infoRows480p,
        is720p && styles.infoRows720p,
        is1080p && styles.infoRows1080p,
        is1440p && styles.infoRows1440p,
      ]}>
        {/* Picked by with car icon */}
        <View style={[
          styles.infoRowWithIcon,
          is480p && styles.infoRowWithIcon480p,
          is720p && styles.infoRowWithIcon720p,
          is1080p && styles.infoRowWithIcon1080p,
          is1440p && styles.infoRowWithIcon1440p,
        ]}>
          <Image
            source={carIcon}
            style={[
              styles.rowIcon,
              is480p && styles.rowIcon480p,
              is720p && styles.rowIcon720p,
              is1080p && styles.rowIcon1080p,
              is1440p && styles.rowIcon1440p,
            ]}
            resizeMode="contain"
          />
          <InfoRow label="Picked by" value={pickedBy} highlight />
        </View>

        {/* Pickup time with clock icon */}
        <View style={[
          styles.infoRowWithIcon,
          is480p && styles.infoRowWithIcon480p,
          is720p && styles.infoRowWithIcon720p,
          is1080p && styles.infoRowWithIcon1080p,
          is1440p && styles.infoRowWithIcon1440p,
        ]}>
          <Image
            source={clockIcon}
            style={[
              styles.rowIcon,
              styles.clockIcon,
              is480p && styles.rowIcon480p,
              is720p && styles.rowIcon720p,
              is1080p && styles.rowIcon1080p,
              is1440p && styles.rowIcon1440p,
            ]}
            resizeMode="contain"
          />
          <InfoRow label="Pickup time" value={pickupTime} highlight />
        </View>

        {/* Pickup Location with map pin icon */}
        <View style={[
          styles.infoRowWithIcon,
          is480p && styles.infoRowWithIcon480p,
          is720p && styles.infoRowWithIcon720p,
          is1080p && styles.infoRowWithIcon1080p,
          is1440p && styles.infoRowWithIcon1440p,
        ]}>
          <Image
            source={mapPinIcon}
            style={[
              styles.rowIcon,
              styles.mapPinIcon,
              is480p && styles.rowIcon480p,
              is720p && styles.rowIcon720p,
              is1080p && styles.rowIcon1080p,
              is1440p && styles.rowIcon1440p,
            ]}
            resizeMode="contain"
          />
          <InfoRow label="Pickup Location" value={pickupLocation} highlight />
        </View>
      </View>
    </View>
  );
};

export default VehicleInfoCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: hp('1.5%'),
    paddingHorizontal: wp('4.5%'),
    paddingVertical: hp('2%'),
    marginBottom: hp('3%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
    gap: hp('0.6%'),
  },
  licensePlateContainer: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'center',
    marginBottom: hp('0.5%'),
    backgroundColor: '#fff',
    borderRadius: hp('0.6%'),
    borderWidth: 1,
    borderColor: '#E0E0E0',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  indBadge: {
    backgroundColor: '#3730A5',
    // paddingHorizontal: wp('1%'),
    paddingVertical: hp('0.5%'),
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: wp('6%'),
    alignSelf: 'stretch',
    borderRadius: hp('0.6%'),
  },
  indText: {
    color: '#fff',
    fontSize: hp('2%'),
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  vehicleNumberSection: {
    paddingLeft: wp('2.5%'),
    paddingRight: wp('2%'),
    paddingVertical: hp('0.5%'),
    backgroundColor: '#fff',
    justifyContent: 'center',
    borderTopRightRadius: hp('0.6%'),
    borderBottomRightRadius: hp('0.6%'),
    alignSelf: 'stretch',
  },
  vehicleNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('1.5%'),
  },
  vehicleNumberText: {
    fontSize: hp('1.7%'),
    color: '#1F1B4E',
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  eyeIcon: {
    width: wp('5%'),
    height: wp('5%'),
    minWidth: 18,
    minHeight: 18,
    tintColor: PRIMARY_COLOR,
  },
  divider: {
    height: 0.5,
    marginTop: hp('0.3%'),
    marginBottom: hp('0.8%'),
    width: '100%' as const,
  },
  infoRows: {
    marginTop: hp('0.5%'),
    gap: hp('0.6%'),
  },
  infoRowWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp('0.7%'),
  },
  rowIcon: {
    width: wp('4%'),
    height: wp('4%'),
    minWidth: 16,
    minHeight: 16,
    marginRight: wp('2%'),
    tintColor: '#1F1B4E',
  },
  clockIcon: {
    tintColor: '#3730A5',
  },
  mapPinIcon: {
    tintColor: '#EF0000',
  },
  // 480p
  card480p: {
    borderRadius: hp('1.2%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('3.5%'),
    marginBottom: hp('2%'),
    gap: hp('1.2%'),
  },
  licensePlateContainer480p: {
    marginBottom: hp('0.4%'),
    borderRadius: hp('0.5%'),
  },
  indBadge480p: {
    paddingHorizontal: wp('1%'),
    paddingVertical: hp('0.4%'),
    minWidth: wp('6.5%'),
    borderRadius: hp('0.5%'),
  },
  indText480p: {
    fontSize: hp('1.8%'),
  },
  vehicleNumberSection480p: {
    paddingLeft: wp('2%'),
    paddingRight: wp('1.5%'),
    paddingVertical: hp('0.4%'),
    borderTopRightRadius: hp('0.5%'),
    borderBottomRightRadius: hp('0.5%'),
  },
  vehicleNumberRow480p: {
    gap: wp('1%'),
  },
  vehicleNumberText480p: {
    fontSize: hp('1.8%'),
    letterSpacing: 0.8,
  },
  eyeIcon480p: {
    width: wp('4.5%'),
    height: wp('4.5%'),
    minWidth: 16,
    minHeight: 16,
  },
  divider480p: {
    height: 0.7,
    marginTop: hp('0.2%'),
    marginBottom: hp('0.6%'),
  },
  infoRows480p: {
    marginTop: hp('0.8%'),
    gap: hp('1%'),
  },
  infoRowWithIcon480p: {
    marginBottom: hp('0.9%'),
  },
  rowIcon480p: {
    width: wp('3.5%'),
    height: wp('3.5%'),
    minWidth: 14,
    minHeight: 14,
    marginRight: wp('1.5%'),
  },
  // 720p
  card720p: {
    borderRadius: hp('1.3%'),
    paddingHorizontal: wp('4.5%'),
    paddingVertical: hp('3%'),
    marginBottom: hp('2.5%'),
    gap: hp('1%'),
  },
  licensePlateContainer720p: {
    marginBottom: hp('0.45%'),
    borderRadius: hp('0.55%'),
  },
  indBadge720p: {
    paddingHorizontal: wp('1%'),
    paddingVertical: hp('0.45%'),
    minWidth: wp('7%'),
    borderRadius: hp('0.55%'),
  },
  indText720p: {
    fontSize: hp('1.9%'),
  },
  vehicleNumberSection720p: {
    paddingLeft: wp('2.3%'),
    paddingRight: wp('1.8%'),
    paddingVertical: hp('0.45%'),
    borderTopRightRadius: hp('0.55%'),
    borderBottomRightRadius: hp('0.55%'),
  },
  vehicleNumberRow720p: {
    gap: wp('1.2%'),
  },
  vehicleNumberText720p: {
    fontSize: hp('1.9%'),
    letterSpacing: 1,
  },
  eyeIcon720p: {
    width: wp('4.8%'),
    height: wp('4.8%'),
    minWidth: 17,
    minHeight: 17,
  },
  divider720p: {
    marginTop: hp('0.25%'),
    marginBottom: hp('0.7%'),
  },
  infoRows720p: {
    marginTop: hp('0.7%'),
    gap: hp('0.9%'),
  },
  infoRowWithIcon720p: {
    marginBottom: hp('0.8%'),
  },
  rowIcon720p: {
    width: wp('3.8%'),
    height: wp('3.8%'),
    minWidth: 15,
    minHeight: 15,
    marginRight: wp('1.8%'),
  },
  // 1080p
  card1080p: {
    borderRadius: hp('1.5%'),
    paddingHorizontal: wp('4.5%'),
    paddingVertical: hp('2%'),
    marginBottom: hp('3%'),
    gap: hp('0.6%'),
  },
  licensePlateContainer1080p: {
    marginBottom: hp('0.5%'),
    borderRadius: hp('0.5%'),
  },
  indBadge1080p: {
    paddingHorizontal: wp('1%'),
    paddingVertical: hp('0.4%'),
    minWidth: wp('7%'),
    borderRadius: hp('0.5%'),
  },
  indText1080p: {
    fontSize: hp('1.8%'),
  },
  vehicleNumberSection1080p: {
    paddingLeft: wp('2.2%'),
    paddingRight: wp('1.8%'),
    paddingVertical: hp('0.4%'),
    borderTopRightRadius: hp('0.5%'),
    borderBottomRightRadius: hp('0.5%'),
  },
  vehicleNumberRow1080p: {
    gap: wp('1.2%'),
  },
  vehicleNumberText1080p: {
    fontSize: hp('1.5%'),
    letterSpacing: 1,
  },
  eyeIcon1080p: {
    width: wp('5%'),
    height: wp('5%'),
    minWidth: 18,
    minHeight: 18,
  },
  divider1080p: {
    marginTop: hp('0.3%'),
    marginBottom: hp('0.8%'),
  },
  infoRows1080p: {
    marginTop: hp('0.5%'),
    gap: hp('0.6%'),
  },
  infoRowWithIcon1080p: {
    marginBottom: hp('0.7%'),
  },
  rowIcon1080p: {
    width: wp('4%'),
    height: wp('4%'),
    minWidth: 16,
    minHeight: 16,
    marginRight: wp('2%'),
  },
  // 1440p
  card1440p: {
    borderRadius: hp('1.7%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('2.3%'),
    marginBottom: hp('3.5%'),
    gap: hp('0.7%'),
  },
  licensePlateContainer1440p: {
    marginBottom: hp('0.6%'),
    borderRadius: hp('0.6%'),
  },
  divider1440p: {
    marginTop: hp('0.35%'),
    marginBottom: hp('0.9%'),
  },
  indBadge1440p: {
    paddingHorizontal: wp('1.2%'),
    paddingVertical: hp('0.5%'),
    minWidth: wp('7.5%'),
    borderRadius: hp('0.6%'),
  },
  indText1440p: {
    fontSize: hp('2%'),
  },
  vehicleNumberSection1440p: {
    paddingLeft: wp('2.5%'),
    paddingRight: wp('2%'),
    paddingVertical: hp('0.5%'),
    borderTopRightRadius: hp('0.6%'),
    borderBottomRightRadius: hp('0.6%'),
  },
  vehicleNumberRow1440p: {
    gap: wp('1.5%'),
  },
  vehicleNumberText1440p: {
    fontSize: hp('1.7%'),
    letterSpacing: 1.2,
  },
  eyeIcon1440p: {
    width: wp('5.5%'),
    height: wp('5.5%'),
    minWidth: 20,
    minHeight: 20,
  },
  infoRows1440p: {
    marginTop: hp('1.4%'),
    gap: hp('0.7%'),
  },
  infoRowWithIcon1440p: {
    marginBottom: hp('0.8%'),
  },
  rowIcon1440p: {
    width: wp('4.5%'),
    height: wp('4.5%'),
    minWidth: 18,
    minHeight: 18,
    marginRight: wp('2.5%'),
  },
});
