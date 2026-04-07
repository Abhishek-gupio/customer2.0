import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { INDPlate } from '../Vehicles/VehicleUI';
import type { Vehicle } from '../../services/vehicleService';

const CarImage = require('../../assets/images/car_vehicle_demo.png');
const BikeImage = require('../../assets/images/bike.png');

type VehicleSummaryCardProps = {
  vehicle: Vehicle;
  onViewDetails: () => void;
};

export default function VehicleSummaryCard({ vehicle, onViewDetails }: VehicleSummaryCardProps) {
  return (
    <View style={styles.vehicleSummaryCard}>
      <View style={styles.vehicleIconCircle}>
        <Image
          source={(vehicle.vehicleType === 'BIKE' ? BikeImage : CarImage) as any}
          style={styles.vehicleThumb}
          resizeMode="contain"
        />
      </View>
      <View style={styles.vehicleInfo}>
        <Text style={styles.vehicleName}>{vehicle.model?.toUpperCase() || 'SXL'}</Text>
        <View style={styles.plateWrap}>
          <INDPlate number={vehicle.registrationNumber} />
        </View>
      </View>
      <TouchableOpacity onPress={onViewDetails} style={styles.viewDetailsBtn}>
        <Text style={styles.viewDetailsText}>View details</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  vehicleSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 32,
  },
  vehicleIconCircle: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  vehicleThumb: { width: 40, height: 40 },
  vehicleInfo: { flex: 1, marginLeft: 16 },
  vehicleName: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', marginBottom: 2, fontWeight: '700' },
  plateWrap: { alignSelf: 'flex-start', transform: [{ scale: 0.65 }], marginLeft: -24, marginTop: -4 },
  viewDetailsBtn: { paddingVertical: 4 },
  viewDetailsText: { color: '#FFF', fontSize: 12, fontFamily: 'Outfit-Medium', borderBottomWidth: 1, borderBottomColor: '#FFF' },
});
