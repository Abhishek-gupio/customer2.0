import React from 'react';
import { View } from 'react-native';
import { ProfileInfoRow } from './ProfileInfoRow';

type ProfileLike = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
};

type ProfileInfoListProps = {
  styles: any;
  profile: ProfileLike;
  editData: ProfileLike;
  isEditing: boolean;
  errors: { fullName?: string; email?: string; phone?: string };
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
};

export const ProfileInfoList = React.memo(function ProfileInfoList({
  styles,
  profile,
  editData,
  isEditing,
  errors,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
}: ProfileInfoListProps) {
  return (
    <View style={styles.modalInfoList}>
      <ProfileInfoRow
        styles={styles}
        icon="user"
        label="Full Name"
        value={isEditing ? editData.fullName : profile.fullName}
        isEditing={isEditing}
        onChange={onFullNameChange}
        error={errors.fullName}
      />
      <ProfileInfoRow
        styles={styles}
        icon="envelope"
        label="Email Address"
        value={isEditing ? editData.email : profile.email}
        isEditing={isEditing}
        onChange={onEmailChange}
        keyboardType="email-address"
        error={errors.email}
      />
      <ProfileInfoRow
        styles={styles}
        icon="phone-alt"
        label="Phone Number"
        value={isEditing ? editData.phone : profile.phone}
        isEditing={isEditing}
        onChange={onPhoneChange}
        keyboardType="phone-pad"
        error={errors.phone}
      />
      <ProfileInfoRow
        styles={styles}
        icon="calendar-alt"
        label="Member Since"
        value={profile.memberSince}
        isEditing={false}
      />
      <ProfileInfoRow
        styles={styles}
        icon="map-marker-alt"
        label="Location"
        value={profile.location}
        isEditing={false}
        numberOfLines={2}
        fixedHeight
      />
    </View>
  );
});
