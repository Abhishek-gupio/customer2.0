import React from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';

type ProfilePictureOptionsModalProps = {
  styles: any;
  visible: boolean;
  currentPic?: string;
  onClose: () => void;
  onCameraOption: () => void;
  onGalleryOption: () => void;
  onAvatarOption: () => void;
  onDeleteProfilePic: () => void;
};

export const ProfilePictureOptionsModal = React.memo(function ProfilePictureOptionsModal({
  styles,
  visible,
  currentPic,
  onClose,
  onCameraOption,
  onGalleryOption,
  onAvatarOption,
  onDeleteProfilePic,
}: ProfilePictureOptionsModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.premiumModalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.premiumModalContent}>
              <View style={styles.premiumModalHeader}>
                <Text style={styles.premiumModalTitle}>Profile Picture</Text>
                <TouchableOpacity onPress={onClose} style={styles.premiumCloseBtn}>
                  <MaterialIcon name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.premiumOptions}>
                <TouchableOpacity style={styles.premiumOption} onPress={onCameraOption}>
                  <View style={[styles.premiumOptionIcon, localStyles.cameraOptionIcon]}>
                    <MaterialIcon name="photo-camera" size={22} color="#FFBF00" />
                  </View>
                  <Text style={styles.premiumOptionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.premiumOption} onPress={onGalleryOption}>
                  <View style={[styles.premiumOptionIcon, localStyles.galleryOptionIcon]}>
                    <MaterialIcon name="photo-library" size={22} color="#2196F3" />
                  </View>
                  <Text style={styles.premiumOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.premiumOption} onPress={onAvatarOption}>
                  <View style={[styles.premiumOptionIcon, localStyles.avatarOptionIcon]}>
                    <MaterialCommunityIcon name="emoticon-outline" size={22} color="#4CAF50" />
                  </View>
                  <Text style={styles.premiumOptionText}>Pick an Avatar</Text>
                </TouchableOpacity>

                {currentPic ? (
                  <TouchableOpacity
                    style={[styles.premiumOption, localStyles.deleteOption]}
                    onPress={onDeleteProfilePic}
                  >
                    <View style={[styles.premiumOptionIcon, localStyles.deleteOptionIcon]}>
                      <MaterialIcon name="delete-outline" size={22} color="#FF453A" />
                    </View>
                    <Text style={[styles.premiumOptionText, localStyles.deleteOptionText]}>
                      Remove Photo
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <TouchableOpacity style={styles.premiumCancelBtn} onPress={onClose}>
                <Text style={styles.premiumCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const localStyles = {
  cameraOptionIcon: {
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
  },
  galleryOptionIcon: {
    backgroundColor: 'rgba(33, 150, 243, 0.1)',
  },
  avatarOptionIcon: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
  },
  deleteOption: {
    borderColor: 'rgba(255, 69, 58, 0.3)',
  },
  deleteOptionIcon: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  deleteOptionText: {
    color: '#FF453A',
  },
};
