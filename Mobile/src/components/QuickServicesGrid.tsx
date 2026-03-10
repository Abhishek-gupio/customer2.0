import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import QuickServiceButton from './QuickServiceButton';

// Define the services with their corresponding navigation targets
// 'tab' indicates it's a screen within the Main tab navigator
const SERVICES: { icon: string; label: string; screen: string; isTab?: boolean }[] = [
  { icon: 'wrench', label: 'Service', screen: 'ServiceHistory' },
  { icon: 'calendar-check', label: 'Booking', screen: 'History', isTab: true },
  { icon: 'tachometer-alt', label: 'Driving', screen: 'DrivingSummary' },
  { icon: 'comments', label: 'Support', screen: 'AiBotHome' },
  { icon: 'car', label: 'Vehicles', screen: 'VehicleList' },
  { icon: 'file-alt', label: 'Documents', screen: 'DocumentList' },
  { icon: 'wallet', label: 'Expenses', screen: 'Expenses' },
  { icon: 'parking', label: 'Valet', screen: 'VehicleList' }, // Valet placeholder
];

type QuickServicesGridProps = {
  // onServicePress will now receive the target name and a flag if it's a tab
  onServicePress?: (target: string, isTab: boolean) => void;
};

export default function QuickServicesGrid({ onServicePress }: QuickServicesGridProps) {
  // Split 8 unique services into two rows of 4 each
  const firstRow = SERVICES.slice(0, 4);
  const secondRow = SERVICES.slice(4, 8);

  return (
    <View style={styles.container}>
      {/* Row 1: Service, Booking, Driving, Support */}
      <View style={styles.row}>
        {firstRow.map((item) => (
          <QuickServiceButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.screen, !!item.isTab)}
          />
        ))}
      </View>

      {/* Row 2: Vehicles, Documents, Expenses, Valet */}
      <View style={styles.row}>
        {secondRow.map((item) => (
          <QuickServiceButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.screen, !!item.isTab)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: hp(2),
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
    gap: hp(2), // Space between the two rows
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});
