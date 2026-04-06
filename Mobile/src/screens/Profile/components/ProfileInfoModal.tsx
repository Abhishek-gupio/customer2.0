import React from 'react';
import {
  Animated,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfileIdentitySummary } from './ProfileIdentitySummary';
import { ProfileInfoList } from './ProfileInfoList';
import { ProfileInfoModalHeader } from './ProfileInfoModalHeader';

type ProfileLike = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
};

type ProfileInfoModalProps = {
  styles: any;
  visible: boolean;
  isEditing: boolean;
  saving: boolean;
  currentPic?: string;
  profilePicUri?: string;
  profile: ProfileLike;
  editData: ProfileLike;
  errors: { fullName?: string; email?: string; phone?: string };
  onRequestClose: () => void;
  onEdit: () => void;
  onSave: () => void;
  onOpenPhotoPreview: () => void;
  onFullNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
};

export const ProfileInfoModal = React.memo(function ProfileInfoModal({
  styles,
  visible,
  isEditing,
  saving,
  currentPic,
  profilePicUri,
  profile,
  editData,
  errors,
  onRequestClose,
  onEdit,
  onSave,
  onOpenPhotoPreview,
  onFullNameChange,
  onEmailChange,
  onPhoneChange,
}: ProfileInfoModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.advancedModalContent, localStyles.modalContent]}>
        <SafeAreaView edges={['top']} style={localStyles.flex}>
          <ProfileInfoModalHeader
            styles={styles}
            isEditing={isEditing}
            saving={saving}
            onRequestClose={onRequestClose}
            onEdit={onEdit}
            onSave={onSave}
          />

          <ScrollView
            contentContainerStyle={styles.advancedModalScroll}
            showsVerticalScrollIndicator={false}
          >
            <ProfileIdentitySummary
              styles={styles}
              currentPic={currentPic}
              profilePicUri={profilePicUri}
              fullName={profile.fullName}
              email={profile.email}
              onOpenPhotoPreview={onOpenPhotoPreview}
            />

            <ProfileInfoList
              styles={styles}
              profile={profile}
              editData={editData}
              isEditing={isEditing}
              errors={errors}
              onFullNameChange={onFullNameChange}
              onEmailChange={onEmailChange}
              onPhoneChange={onPhoneChange}
            />

            <TouchableOpacity style={styles.modalCloseBtnFull} activeOpacity={0.8} onPress={onRequestClose}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
});

const localStyles = {
  flex: {
    flex: 1,
  },
  modalContent: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    minHeight: '100%',
    borderWidth: 0,
  },
};
