import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import QuickServiceButton from "./QuickServiceButton";

const SERVICES: { icon: string; label: string }[] = [
  { icon: 'wrench', label: 'Service' },
  { icon: 'calendar-check', label: 'Booking' },
  { icon: 'tachometer-alt', label: 'Driving' },
  { icon: 'comments', label: 'Support' },
  { icon: 'car', label: 'Vehicles' },
  { icon: 'file-alt', label: 'Documents' },
  { icon: 'wallet', label: 'Expenses' },
  { icon: 'parking', label: 'Valet' },
];

type QuickServicesGridProps = {
  onServicePress?: (label: string) => void;
};

export default function QuickServicesGrid({
  onServicePress,
}: QuickServicesGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {SERVICES.map((item) => (
          <QuickServiceButton
            key={item.label}
            icon={item.icon}
            label={item.label}
            onPress={() => onServicePress?.(item.label)}
          />
        ))}
      </View>
      <View style={styles.row}>
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
    paddingVertical: hp(2),
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: wp(2),
  },
});
