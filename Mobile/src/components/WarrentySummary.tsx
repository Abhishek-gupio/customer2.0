// components/WarrantySummary.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

type Props = {
  active: number;
  expired: number;
};

export const WarrantySummary = ({ active, expired }: Props) => {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Warranty Summary</Text>

      <View style={styles.row}>
        <View style={[styles.column, { borderColor: '#22C55E' }]}>
          <Text style={[styles.label,{ color: '#22C55E' }]}>Active Warranties</Text>
          <Text style={[styles.value, { color: '#22C55E' }]}>{active}</Text>
        </View>

        <View style={[styles.column, { borderColor: '#EF4444' }]}>
          <Text style={[styles.label, { color: '#EF4444' }]}>Expired</Text>
          <Text style={[styles.value, { color: '#EF4444' }]}>{expired}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgb(54, 54, 54)',
    borderRadius: wp(5),
    padding: wp(4),
    borderWidth: wp(0.3),
    borderColor: '#999',
    marginHorizontal: hp(2),
  },
  title: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '600',
    marginBottom: hp(2),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    color: '#9CA3AF',
    marginBottom: hp(0.5),
  },
  value: {
    fontSize: wp(6),
    fontWeight: '700',
  },
    column: {
        backgroundColor: 'rgb(54, 54, 54)',
        padding: wp(3),
        borderRadius: wp(3),
        alignItems: 'center',
        borderWidth: wp(0.1),
        borderColor: '#999',
  },

});