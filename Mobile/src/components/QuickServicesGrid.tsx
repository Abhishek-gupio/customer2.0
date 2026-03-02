import { View, Text, StyleSheet, type ImageSourcePropType } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import QuickServiceButton from './QuickServiceButton';

const VEHICLE_ICON = require('../assets/icons/vehicle.png') as ImageSourcePropType;
const DOCUMENT_ICON = require('../assets/icons/document.png') as ImageSourcePropType;
const EXPENSE_ICON = require('../assets/icons/expense.png') as ImageSourcePropType;
const VALET_ICON = require('../assets/icons/valet.png') as ImageSourcePropType;

const SERVICES: { icon: string | ImageSourcePropType; label: string }[] = [
  { icon: VEHICLE_ICON, label: 'Vehicles' },
  { icon: DOCUMENT_ICON, label: 'Documents' },
  { icon: EXPENSE_ICON, label: 'Expenses' },
  { icon: VALET_ICON, label: 'Valet' },
  { icon: 'wrench', label: 'Service' },
  { icon: 'calendar-check', label: 'Booking' },
  { icon: 'clipboard-list', label: 'History' },
  { icon: 'comments', label: 'Support' },
];

type QuickServicesGridProps = {
  onServicePress?: (label: string) => void;
};

export default function QuickServicesGrid({ onServicePress }: QuickServicesGridProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Quick Services</Text>
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
    paddingHorizontal: wp(4),
    marginBottom: hp(2),
  },
  title: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(2),
  },
});
