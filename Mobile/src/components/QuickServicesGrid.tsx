import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import QuickServiceButton from './QuickServiceButton';
import {
  quickServices,
  type QuickServiceId,
} from '../config/servicesConfig';

type QuickServicesGridProps = {
  onServicePress?: (id: QuickServiceId) => void;
};

export default function QuickServicesGrid({ onServicePress }: QuickServicesGridProps) {
  const rows: Array<(typeof quickServices)[number][]> = [];
  for (let index = 0; index < quickServices.length; index += 4) {
    rows.push(quickServices.slice(index, index + 4));
  }

  return (
    <View style={styles.container}>
      {rows.map((row, rowIndex) => (
        <View
          key={`row-${rowIndex}`}
          style={rowIndex === 0 ? styles.row : [styles.row, { marginTop: hp(1.5) }]}
        >
          {row.map((item) => (
            <QuickServiceButton
              key={item.id}
              icon={item.icon}
              label={item.label}
              onPress={() => onServicePress?.(item.id)}
            />
          ))}
          {row.length < 4
            ? [...Array(4 - row.length)].map((_, index) => (
                <View key={`empty-${rowIndex}-${index}`} style={styles.emptySlot} />
              ))
            : null}
        </View>
      ))}
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
  emptySlot: {
    flex: 1,
  },
  label: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
    color: '#fff',
    marginTop: hp(0.5),
    textAlign: 'center'
  }
});
