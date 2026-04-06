import React from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import BackButton from '../../../components/BackButton';

type ProfileHeroSectionProps = {
  styles: any;
  profile: {
    fullName: string;
    memberSince: string;
  };
  currentPic?: string;
  profilePicUri?: string;
  saving: boolean;
  onBack: () => void;
  onOpenInfoModal: () => void;
  onImagePick: () => void;
};

export const ProfileHeroSection = React.memo(function ProfileHeroSection({
  styles,
  profile,
  currentPic,
  profilePicUri,
  saving,
  onBack,
  onOpenInfoModal,
  onImagePick,
}: ProfileHeroSectionProps) {
  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.headerLeft}>
          <BackButton onPress={onBack} />
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
      </View>

      <View style={styles.premiumHeaderBackground}>
        <LinearGradient
          colors={['rgba(255, 215, 0, 0.08)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        <View style={styles.identityContainer}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <TouchableOpacity activeOpacity={0.8} onPress={onOpenInfoModal}>
              <View style={styles.avatar}>
                {currentPic ? (
                  <Image source={{ uri: profilePicUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="user" size={wp(8)} color="#FFFFFF" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cameraBtn, saving && localStyles.cameraBtnDisabled]}
              activeOpacity={0.9}
              onPress={saving ? undefined : onImagePick}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Icon name="camera" size={wp(3.2)} color="#000" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.identityTextInfo}>
            <Text style={styles.profileName}>{profile.fullName?.toUpperCase() || 'USER'}</Text>
            <Text style={styles.memberSinceText}>
              Member since {profile.memberSince.split(' ').pop()}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
});

const localStyles = StyleSheet.create({
  cameraBtnDisabled: {
    opacity: 0.6,
  },
});
