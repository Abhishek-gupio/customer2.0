import React from 'react';
import { Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';

type ProfileStatCardProps = {
  styles: any;
  icon: string;
  label: string;
  value: string;
  color: string;
};

export const ProfileStatCard = React.memo(function ProfileStatCard({
  styles,
  icon,
  label,
  value,
  color,
}: ProfileStatCardProps) {
  return (
    <View style={styles.glassStatCard}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}15` }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});
