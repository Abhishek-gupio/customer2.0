import React from 'react';
import { Text, View } from 'react-native';
import { ProfileMenuRow } from './ProfileMenuRow';

type SettingsItem = {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  isLast?: boolean;
  badgeCount?: number;
};

type ProfileSettingsSectionProps = {
  styles: any;
  items: SettingsItem[];
};

export const ProfileSettingsSection = React.memo(function ProfileSettingsSection({
  styles,
  items,
}: ProfileSettingsSectionProps) {
  return (
    <View style={styles.integratedSettingsCard}>
      <Text style={styles.integratedSettingsTitle}>Settings & Preferences</Text>
      <View style={styles.integratedGroupCard}>
        {items.map((item) => (
          <ProfileMenuRow
            key={item.label}
            styles={styles}
            icon={item.icon}
            label={item.label}
            onPress={item.onPress}
            color={item.color}
            bgColor={item.bgColor}
            borderColor={item.borderColor}
            isLast={item.isLast}
            badgeCount={item.badgeCount}
          />
        ))}
      </View>
    </View>
  );
});
