import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

type ProfileIdentitySummaryProps = {
  styles: any;
  currentPic?: string;
  profilePicUri?: string;
  fullName: string;
  email: string;
  onOpenPhotoPreview: () => void;
};

export const ProfileIdentitySummary = React.memo(function ProfileIdentitySummary({
  styles,
  currentPic,
  profilePicUri,
  fullName,
  email,
  onOpenPhotoPreview,
}: ProfileIdentitySummaryProps) {
  return (
    <View style={styles.modalIdentityRow}>
      <TouchableOpacity
        activeOpacity={currentPic ? 0.8 : 1}
        onPress={currentPic ? onOpenPhotoPreview : undefined}
      >
        <View style={styles.modalAvatar}>
          {currentPic ? (
            <Image source={{ uri: profilePicUri }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="user" size={wp(6)} color="#FFFFFF" />
            </View>
          )}
        </View>
      </TouchableOpacity>
      <View style={styles.modalIdentityText}>
        <Text style={styles.modalName}>{fullName}</Text>
        <Text style={styles.modalEmail}>{email}</Text>
      </View>
    </View>
  );
});
