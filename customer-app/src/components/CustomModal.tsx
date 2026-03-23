import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  DimensionValue,
  TextStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import Modal from 'react-native-modal';

type CustomModalProps = {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  variant?: 'center' | 'bottom-sheet';
  titleStyle?: TextStyle;
  /** Common modal content style override */
  modalContentStyle?: ViewStyle;
  /** Platform-specific overrides */
  iosModalContentStyle?: ViewStyle;
  androidModalContentStyle?: ViewStyle;
  /** Hide the close button */
  hideCloseButton?: boolean;
  /** Disable backdrop press to close */
  disableBackdropPress?: boolean;
};

const CustomModal: React.FC<CustomModalProps> = ({
  isVisible,
  onClose,
  children,
  title,
  width = '90%',
  height = 'auto',
  variant,
  titleStyle,
  modalContentStyle,
  iosModalContentStyle,
  androidModalContentStyle,
  hideCloseButton = false,
  disableBackdropPress = false,
}) => {
  const screenWidth = Dimensions.get('window').width;
  const SMALL_PHONE_BREAKPOINT = 320;

  const isBottomSheet = variant
    ? variant === 'bottom-sheet'
    : screenWidth < SMALL_PHONE_BREAKPOINT;

  return (
    <Modal
      isVisible={isVisible}
      onBackdropPress={disableBackdropPress ? undefined : onClose}
      onSwipeComplete={disableBackdropPress ? undefined : onClose}
      swipeDirection={disableBackdropPress ? undefined : (isBottomSheet ? 'down' : undefined)}
      useNativeDriver={false}
      hideModalContentWhileAnimating={true}
      backdropTransitionOutTiming={0}
      style={
        isBottomSheet ? styles.bottomSheetContainer : styles.centerContainer
      }
    >
      <View
        style={[
          styles.modalContent,
          { width, height },
          modalContentStyle, // base overrides
          Platform.OS === 'ios'
            ? iosModalContentStyle
            : androidModalContentStyle, // ✅ platform-specific
          isBottomSheet ? styles.bottomSheetContent : null,
        ]}
      >
        {/* Close Button */}
        {!hideCloseButton && (
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        )}

        {title && <Text style={[styles.title, titleStyle]}>{title}</Text>}

        <View style={styles.body}>{children}</View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centerContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    margin: 20, // Add margin to maintain space from screen edges
  },
  bottomSheetContainer: {
    justifyContent: 'flex-end',
    margin: 0,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
  },
  bottomSheetContent: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    width: '100%',
  },
  closeButton: {
    position: 'absolute',
    right: 15,
    top: 10,
    zIndex: 1,
  },
  closeText: {
    fontSize: 11,
    color: '#8B8B8B',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  body: {
    marginTop: 10,
  },
});

export default CustomModal;
