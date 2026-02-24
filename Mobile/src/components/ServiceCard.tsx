import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../screens/ServiceAndWarrenty/data';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

export default function ServiceCard({ item  }: { item: any }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>🔧 {item.title}</Text>

      <Text style={styles.text}>{item.garage}</Text>
      <Text style={styles.text}>{item.date}</Text>

      {item.odometer && (
        <Text style={styles.text}>@ {item.odometer}</Text>
      )}

      {item.parts && (
        <Text style={styles.text}>Parts: {item.parts}</Text>
      )}

      {item.nextService && (
        <Text style={styles.next}>
          Next: {item.nextService}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#151515',
    borderRadius: wp(7),
    borderWidth: wp(0.3),
    borderColor: '#999',
    padding: 16,
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },
  text: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  next: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.accent,
  },
});