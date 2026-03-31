import React from 'react';
import { View, StyleSheet, type ImageSourcePropType } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import QuickServiceButton from './QuickServiceButton';

const DrivingIcon = require('../assets/images/driving_icon.jpg') as any;

interface ServiceItem {
  id: string;
  icon: string | ImageSourcePropType;
  label: string;
}

const SERVICES: ServiceItem[] = [
  { id: 'service', icon: 'wrench', label: 'Service' },
  { id: 'nearby', icon: 'map-marker-alt', label: 'Near By' },
  { id: 'driving', icon: DrivingIcon, label: 'Driving' },
  { id: 'support', icon: 'comments', label: 'Support' },
  { id: 'garage', icon: 'car', label: 'My Garage' },
  { id: 'document', icon: 'file-alt', label: 'Documents' },
  { id: 'expense', icon: 'wallet', label: 'Expenses' },
  { id: 'tripcost', icon: 'map-signs', label: 'Trip Planner' },
  { id: 'valet', icon: 'parking', label: 'Valet Parking' },
];

type QuickServicesGridProps = {
  onServicePress?: (id: string) => void;
};

export default function QuickServicesGrid({ onServicePress }: QuickServicesGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {SERVICES.slice(4, 8).map((item) => (
          <QuickServiceButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.id)}
          />
        ))}
      </View>
      <View style={[styles.row, { marginTop: hp(1.5) }]}>
        {SERVICES.slice(0, 4).map((item) => (
          <QuickServiceButton
            key={item.id}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.id)}
          />
        ))}
      </View>
      {SERVICES.length > 8 && (
        <View style={[styles.row, { marginTop: hp(1.5) }]}>
          {SERVICES.slice(8).map((item) => (
            <QuickServiceButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              onPress={() => onServicePress?.(item.id)}
            />
          ))}
          {/* Pad with empty Views to keep the first item left-aligned in the 4-column grid */}
          {[...Array(4 - (SERVICES.length % 4 || 4))].map((_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1 }} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(4),
    marginBottom: hp(2.5),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
    color: '#fff',
    marginTop: hp(0.5),
    textAlign: 'center'
  }
});
