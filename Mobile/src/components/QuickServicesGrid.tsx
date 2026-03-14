import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import QuickServiceButton from './QuickServiceButton';

const SERVICES = [
  { icon: 'wrench', label: 'Service' },
  { icon: 'calendar-check', label: 'Booking' },
  { icon: 'tachometer-alt', label: 'Driving' },
  { icon: 'comments', label: 'Support' },
  { icon: 'car', label: 'My Vehicle' },
  { icon: 'file-alt', label: 'Document' },
  { icon: 'wallet', label: 'Expense' },
  { icon: 'parking', label: 'Valet' },
];

type QuickServicesGridProps = {
  onServicePress?: (label: string) => void;
};

export default function QuickServicesGrid({ onServicePress }: QuickServicesGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {SERVICES.slice(0, 4).map((item) => (
          <QuickServiceButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.label)}
          />
        ))}
      </View>
      <View style={[styles.row, { marginTop: hp(1.5) }]}>
        {SERVICES.slice(4, 8).map((item) => (
          <QuickServiceButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.label)}
          />
        ))}
      </View>
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
