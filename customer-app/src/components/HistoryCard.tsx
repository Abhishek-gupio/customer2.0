import React from 'react';
import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

const valetParking = require('../assets/valet-parking1.png');
const valetParking2 = require('../assets/valet-parking2.png');
const group = require('../assets/Group.png');
const parking11 = require('../assets/parking11.png');
const parking22 = require('../assets/parking22.png');

// Dashed line component
const DottedLine: React.FC = () => {
  const dashes = Array.from({ length: 4 }, (_, i) => i);
  return (
    <View style={styles.dottedLineContainer}>
      {dashes.map((_, index) => (
        <View key={index} style={styles.dash} />
      ))}
    </View>
  );
};

export interface HistoryCardProps {
  vehiclePlate: string;
  date: string;
  parkedAt: string;
  droppedAt: string;
  pickupTime: string;
  parkTime: string;
  dropTime: string;
  pickupValet: string;
  dropOffValet: string;
  onPress?: (id: string) => void;
}

const HistoryCard: React.FC<HistoryCardProps & { id?: string }> = ({
  vehiclePlate,
  date,
  parkedAt,
  droppedAt,
  pickupTime,
  parkTime,
  dropTime,
  pickupValet,
  dropOffValet,
  onPress,
  id,
}) => {
  return (
    <Pressable onPress={() => id && onPress?.(id)}>
      <View style={styles.card}>
        {/* Header: Vehicle and Date */}
        <View style={styles.header}>
          <View style={styles.vehicleFrame}>
            <View style={styles.vehicleInfo}>
              <View style={styles.indTag}>
                <Text style={styles.indText}>IND</Text>
              </View>
              <Text style={styles.vehiclePlate}>{vehiclePlate}</Text>
            </View>
          </View>
          <Text style={styles.date}>{date}</Text>
        </View>

        {/* Parking Locations */}
        <View style={styles.locationsContainer}>
          <View style={styles.locationTextContainer}>
            <View style={styles.locationRow}>
              <Image source={parking11} style={styles.locationImage} resizeMode="contain" />
              <Text style={styles.locationText}>Parked at: {parkedAt}</Text>
            </View>
            <View style={styles.dottedLineWrapperParking}>
              <DottedLine />
            </View>
            <View style={styles.locationRow}>
              <Image source={parking22} style={styles.locationImage} resizeMode="contain" />
              <Text style={styles.locationText}>Dropped at: {droppedAt}</Text>
            </View>
          </View>
        </View>

        {/* Service Timeline */}
        <View style={styles.timelineContainer}>
          <LinearGradient
            colors={['#5E5CD5', '#1E2999']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.timelineLine}
          />
          <View style={styles.timelineNodes}>
            <View style={[styles.timelineNode, styles.pickupNode]}>
              <View style={styles.nodeIcon}>
                <Image source={valetParking} style={styles.nodeImage} resizeMode="contain" />
              </View>
              <Text style={styles.timelineLabel}>Pickup</Text>
              <Text style={styles.timelineTime}>{pickupTime}</Text>
            </View>
            <View style={styles.timelineNode}>
              <View style={styles.nodeIcon}>
                <Image source={valetParking2} style={styles.nodeImage} resizeMode="contain" />
              </View>
              <Text style={styles.timelineLabel}>Park</Text>
              <Text style={styles.timelineTime}>{parkTime}</Text>
            </View>
            <View style={[styles.timelineNode, styles.dropNode]}>
              <View style={styles.nodeIcon}>
                <Image source={group} style={styles.nodeImage} resizeMode="contain" />
              </View>
              <Text style={styles.timelineLabel}>Drop</Text>
              <Text style={styles.timelineTime}>{dropTime}</Text>
            </View>
          </View>
        </View>

        {/* Valet Information */}
        <View style={styles.valetContainer}>
          <View style={styles.valetTextContainer}>
            <View style={styles.valetRow}>
              <View style={styles.emptyCircle} />
              <Text style={styles.valetText}>Pickup Valet: {pickupValet}</Text>
            </View>
            <View style={styles.dottedLineWrapperValet}>
              <DottedLine />
            </View>
            <View style={styles.valetRow}>
              <View style={styles.solidCircle} />
              <Text style={styles.valetText}>Drop-Off Valet: {dropOffValet}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export default HistoryCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: wp('4%'),
    paddingHorizontal: wp('4%'),
    paddingVertical: hp('2.2%'),
    marginBottom: hp('1.6%'),
    marginHorizontal: wp('4%'),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: hp('0.2%') },
    shadowOpacity: 0.08,
    shadowRadius: wp('2%'),
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp('2%'),
  },
  vehicleFrame: {
    borderWidth: wp('0.15%'),
    borderColor: '#000000',
    borderRadius: wp('0.6%'),
    alignSelf: 'flex-start',
    overflow: 'hidden',
    height: hp('4.2%'),
    justifyContent: 'center',
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  indTag: {
    backgroundColor: '#1E2999',
    paddingHorizontal: wp('1.6%'),
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indText: {
    color: '#FFFFFF',
    fontSize: hp('1.6%'),
    fontWeight: '600',
  },
  vehiclePlate: {
    fontSize: hp('2.2%'),
    fontWeight: '500',
    color: '#000000',
    paddingHorizontal: wp('1.6%'),
  },
  date: {
    fontSize: hp('2%'),
    color: '#000000',
    fontWeight: '600',
  },
  locationsContainer: {
    marginBottom: hp('2%'),
  },
  locationTextContainer: {
    borderWidth: wp('0.2%'),
    borderColor: '#D0D0D0',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.6%'),
    backgroundColor: '#FFFFFF',
    gap: hp('0.6%'),
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('2%'),
  },
  locationImage: {
    width: wp('6.5%'),
    height: wp('6.5%'),
  },
  locationText: {
    fontSize: hp('1.9%'),
    color: '#000000',
    fontWeight: '500',
    flex: 1,
  },
  dottedLineWrapperParking: {
    marginLeft: wp('3.5%'),
    marginVertical: hp('0.2%'),
    alignSelf: 'flex-start',
  },
  dottedLineContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    height: hp('2.4%'),
    justifyContent: 'space-between',
    width: wp('1%'),
  },
  dash: {
    width: wp('1%'),
    height: hp('0.4%'),
    backgroundColor: '#000000',
  },
  timelineContainer: {
    marginBottom: hp('2%'),
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    top: hp('2.05%'),
    left: wp('8%'),
    right: wp('8%'),
    height: hp('0.45%'),
    borderRadius: wp('1%'),
    zIndex: 0,
  },
  timelineNodes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp('2%'),
    zIndex: 1,
  },
  timelineNode: {
    alignItems: 'center',
    flex: 1,
  },
  pickupNode: {
    marginLeft: -wp('5.5%'),
  },
  dropNode: {
    marginRight: -wp('5.5%'),
  },
  nodeIcon: {
    width: wp('11%'),
    height: wp('11%'),
    borderRadius: wp('11%') / 2,
    backgroundColor: '#FFFFFF',
    borderWidth: wp('0.2%'),
    borderColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp('1%'),
  },
  nodeImage: {
    width: wp('6%'),
    height: wp('6%'),
  },
  timelineLabel: {
    fontSize: hp('1.8%'),
    fontWeight: '700',
    color: '#000000',
    marginBottom: hp('0.4%'),
  },
  timelineTime: {
    fontSize: hp('1.7%'),
    color: '#000000',
    fontWeight: '500',
  },
  valetContainer: {
    marginTop: hp('1%'),
  },
  valetTextContainer: {
    borderWidth: wp('0.2%'),
    borderColor: '#D0D0D0',
    borderRadius: wp('2%'),
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('1.6%'),
    backgroundColor: '#FFFFFF',
    gap: hp('0.6%'),
  },
  valetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp('3%'),
  },
  emptyCircle: {
    width: wp('6.2%'),
    height: wp('6.2%'),
    borderRadius: wp('6.2%') / 2,
    borderWidth: wp('0.35%'),
    borderColor: '#CCCCCC',
    backgroundColor: 'transparent',
  },
  solidCircle: {
    width: wp('6.2%'),
    height: wp('6.2%'),
    borderRadius: wp('6.2%') / 2,
    borderWidth: wp('0.25%'),
    borderColor: '#1E2999',
    backgroundColor: '#1E2999',
  },
  dottedLineWrapperValet: {
    marginLeft: wp('3%'),
    marginVertical: hp('0.2%'),
    alignSelf: 'flex-start',
  },
  valetText: {
    fontSize: hp('1.9%'),
    color: '#000000',
    fontWeight: '500',
  },
});
