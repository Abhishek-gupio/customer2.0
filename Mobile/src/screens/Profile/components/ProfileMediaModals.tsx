import React from 'react';
import { Animated } from 'react-native';
import { ProfileAvatarPickerModal } from './ProfileAvatarPickerModal';
import { ProfilePhotoPreviewModal } from './ProfilePhotoPreviewModal';
import { ProfilePictureOptionsModal } from './ProfilePictureOptionsModal';

type AvatarItem = {
  id: string;
  url: string;
  label: string;
};

type ProfileMediaModalsProps = {
  styles: any;
  photoPreview: boolean;
  profilePicModal: boolean;
  avatarModal: boolean;
  currentPic?: string;
  profilePicUri?: string;
  selectedAvatar: string | null;
  avatarItems: AvatarItem[];
  saving: boolean;
  zoomScale: Animated.Value;
  onPinchEvent: any;
  onPinchStateChange: (event: any) => void;
  onClosePhotoPreview: () => void;
  onCloseProfilePicModal: () => void;
  onCloseAvatarModal: () => void;
  onCameraOption: () => void;
  onGalleryOption: () => void;
  onAvatarOption: () => void;
  onDeleteProfilePic: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
  onConfirmAvatar: () => void;
};

export const ProfileMediaModals = React.memo(function ProfileMediaModals({
  styles,
  photoPreview,
  profilePicModal,
  avatarModal,
  currentPic,
  profilePicUri,
  selectedAvatar,
  avatarItems,
  saving,
  zoomScale,
  onPinchEvent,
  onPinchStateChange,
  onClosePhotoPreview,
  onCloseProfilePicModal,
  onCloseAvatarModal,
  onCameraOption,
  onGalleryOption,
  onAvatarOption,
  onDeleteProfilePic,
  onSelectAvatar,
  onConfirmAvatar,
}: ProfileMediaModalsProps) {
  return (
    <>
      <ProfilePhotoPreviewModal
        styles={styles}
        visible={photoPreview}
        profilePicUri={profilePicUri}
        zoomScale={zoomScale}
        onPinchEvent={onPinchEvent}
        onPinchStateChange={onPinchStateChange}
        onClose={onClosePhotoPreview}
      />

      <ProfilePictureOptionsModal
        styles={styles}
        visible={profilePicModal}
        currentPic={currentPic}
        onClose={onCloseProfilePicModal}
        onCameraOption={onCameraOption}
        onGalleryOption={onGalleryOption}
        onAvatarOption={onAvatarOption}
        onDeleteProfilePic={onDeleteProfilePic}
      />

      <ProfileAvatarPickerModal
        styles={styles}
        visible={avatarModal}
        avatarItems={avatarItems}
        selectedAvatar={selectedAvatar}
        saving={saving}
        onClose={onCloseAvatarModal}
        onSelectAvatar={onSelectAvatar}
        onConfirmAvatar={onConfirmAvatar}
      />
    </>
  );
});
