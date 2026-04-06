import React from 'react';
import { Text, View } from 'react-native';
import { ProfileStatCard } from './ProfileStatCard';

type StatsItem = {
  icon: string;
  label: string;
  value: string;
  color: string;
};

type ProfileStatsSectionProps = {
  styles: any;
  items: StatsItem[];
};

export const ProfileStatsSection = React.memo(function ProfileStatsSection({
  styles,
  items,
}: ProfileStatsSectionProps) {
  return (
    <View style={styles.statsContainer}>
      <Text style={styles.statsSectionTitle}>FLEET INSIGHTS</Text>
      <View style={styles.premiumStatsGrid}>
        {items.map((item) => (
          <ProfileStatCard
            key={item.label}
            styles={styles}
            icon={item.icon}
            label={item.label}
            value={item.value}
            color={item.color}
          />
        ))}
      </View>
    </View>
  );
});
