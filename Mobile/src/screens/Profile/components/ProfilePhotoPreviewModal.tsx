import React from 'react';
import {
  Animated,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { GestureHandlerRootView, PinchGestureHandler } from 'react-native-gesture-handler';
import Icon from 'react-native-vector-icons/FontAwesome5';

type ProfilePhotoPreviewModalProps = {
  styles: any;
  visible: boolean;
  profilePicUri?: string;
  zoomScale: Animated.Value;
  onPinchEvent: any;
  onPinchStateChange: (event: any) => void;
  onClose: () => void;
};

export const ProfilePhotoPreviewModal = React.memo(function ProfilePhotoPreviewModal({
  styles,
  visible,
  profilePicUri,
  zoomScale,
  onPinchEvent,
  onPinchStateChange,
  onClose,
}: ProfilePhotoPreviewModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={localStyles.flex}>
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.previewOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.previewContent}>
                <PinchGestureHandler
                  onGestureEvent={onPinchEvent}
                  onHandlerStateChange={onPinchStateChange}
                >
                  <Animated.Image
                    source={{ uri: profilePicUri }}
                    style={[styles.previewImage, { transform: [{ scale: zoomScale }] }]}
                    resizeMode="contain"
                  />
                </PinchGestureHandler>
              </View>
            </TouchableWithoutFeedback>
            <TouchableOpacity style={styles.previewCloseBtn} onPress={onClose} activeOpacity={0.8}>
              <Icon name="times" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </TouchableWithoutFeedback>
      </GestureHandlerRootView>
    </Modal>
  );
});

const localStyles = {
  flex: {
    flex: 1,
  },
};
