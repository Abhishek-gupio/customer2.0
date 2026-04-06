import React from 'react';
import { View } from 'react-native';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { ProfileHeroSection } from './ProfileHeroSection';
import { ProfileSettingsSection } from './ProfileSettingsSection';
import { ProfileStatsSection } from './ProfileStatsSection';

type StatsItem = {
  icon: string;
  label: string;
  value: string;
  color: string;
};

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

type ProfileOverviewContentProps = {
  styles: any;
  profile: {
    fullName: string;
    memberSince: string;
  };
  currentPic?: string;
  profilePicUri?: string;
  saving: boolean;
  statsItems: StatsItem[];
  settingsItems: SettingsItem[];
  onBack: () => void;
  onOpenInfoModal: () => void;
  onImagePick: () => void;
};

export const ProfileOverviewContent = React.memo(function ProfileOverviewContent({
  styles,
  profile,
  currentPic,
  profilePicUri,
  saving,
  statsItems,
  settingsItems,
  onBack,
  onOpenInfoModal,
  onImagePick,
}: ProfileOverviewContentProps) {
  return (
    <>
      <ProfileHeroSection
        styles={styles}
        profile={profile}
        currentPic={currentPic}
        profilePicUri={profilePicUri}
        saving={saving}
        onBack={onBack}
        onOpenInfoModal={onOpenInfoModal}
        onImagePick={onImagePick}
      />
      <ProfileStatsSection styles={styles} items={statsItems} />
      <ProfileSettingsSection styles={styles} items={settingsItems} />
      <View style={{ height: hp(10) }} />
    </>
  );
});
