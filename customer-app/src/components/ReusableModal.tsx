import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ImageSourcePropType,
  ImageStyle,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useResponsive } from '../hooks/useResponsive';

// Conditionally import vector icons if available
let MaterialIcons: any = null;
let FontAwesome: any = null;
let Ionicons: any = null;
let Feather: any = null;
let Entypo: any = null;
let MaterialCommunityIcons: any = null;

try {
  const MaterialIconsModule = require('react-native-vector-icons/MaterialIcons');
  MaterialIcons = MaterialIconsModule.default || MaterialIconsModule;
  const FontAwesomeModule = require('react-native-vector-icons/FontAwesome');
  FontAwesome = FontAwesomeModule.default || FontAwesomeModule;
  const IoniconsModule = require('react-native-vector-icons/Ionicons');
  Ionicons = IoniconsModule.default || IoniconsModule;
  const FeatherModule = require('react-native-vector-icons/Feather');
  Feather = FeatherModule.default || FeatherModule;
  const EntypoModule = require('react-native-vector-icons/Entypo');
  Entypo = EntypoModule.default || EntypoModule;
  const MaterialCommunityIconsModule = require('react-native-vector-icons/MaterialCommunityIcons');
  MaterialCommunityIcons = MaterialCommunityIconsModule.default || MaterialCommunityIconsModule;
} catch (e) {
  // Vector icons not available, will use Image component
  // This is fine - we'll check before using
}

const defaultRightTickIcon = require('../assets/right_tick_icon.png');
const defaultQuestionMarkIcon = require('../assets/question_mark.png');

interface ButtonConfig {
  text: string;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  variant?: 'primary' | 'secondary';
}

interface VectorIconConfig {
  name: string;
  size?: number;
  color?: string;
  library?: 'MaterialIcons' | 'FontAwesome' | 'Ionicons' | 'Feather' | 'Entypo' | 'MaterialCommunityIcons';
}

interface ReusableModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string; // Additional subtitle text below title
  // Single button (for backward compatibility)
  buttonText?: string;
  onButtonPress?: () => void;
  // Two buttons support
  primaryButton?: ButtonConfig;
  secondaryButton?: ButtonConfig;
  // Image icon (for backward compatibility)
  icon?: ImageSourcePropType;
  // Vector icon support (alternative to image icon)
  vectorIcon?: VectorIconConfig;
  // Preset icon types (quick options)
  iconType?: 'success' | 'question' | 'custom';
  showIcon?: boolean;
  showCloseButton?: boolean;
  showButton?: boolean;
  verticalButtons?: boolean; // Stack buttons vertically instead of horizontally
  // Custom styles
  containerStyle?: ViewStyle;
  titleStyle?: TextStyle;
  subtitleStyle?: TextStyle;
  buttonStyle?: ViewStyle;
  buttonTextStyle?: TextStyle;
  iconStyle?: ImageStyle;
  overlayStyle?: ViewStyle;
}

const ReusableModal: React.FC<ReusableModalProps> = ({
  visible,
  onClose,
  title,
  subtitle,
  // Single button props (backward compatibility)
  buttonText,
  onButtonPress,
  // Two buttons props
  primaryButton,
  secondaryButton,
  icon,
  vectorIcon,
  iconType = 'success', // 'success' (tick), 'question' (question mark), or 'custom'
  showIcon = true,
  showCloseButton = true,
  showButton = true,
  verticalButtons = false,
  containerStyle,
  titleStyle,
  subtitleStyle,
  buttonStyle,
  buttonTextStyle,
  iconStyle,
  overlayStyle,
}) => {
  const { isSmallScreen } = useResponsive();
  
  // Get vector icon component based on library
  let VectorIconComponent: any = null;
  let useVectorIcon = false;
  
  if (vectorIcon) {
    const iconLibrary = vectorIcon.library || 'MaterialIcons';
    switch (iconLibrary) {
      case 'MaterialIcons':
        if (MaterialIcons) {
          VectorIconComponent = MaterialIcons;
          useVectorIcon = true;
        }
        break;
      case 'FontAwesome':
        if (FontAwesome) {
          VectorIconComponent = FontAwesome;
          useVectorIcon = true;
        }
        break;
      case 'Ionicons':
        if (Ionicons) {
          VectorIconComponent = Ionicons;
          useVectorIcon = true;
        }
        break;
      case 'Feather':
        if (Feather) {
          VectorIconComponent = Feather;
          useVectorIcon = true;
        }
        break;
      case 'Entypo':
        if (Entypo) {
          VectorIconComponent = Entypo;
          useVectorIcon = true;
        }
        break;
      case 'MaterialCommunityIcons':
        if (MaterialCommunityIcons) {
          VectorIconComponent = MaterialCommunityIcons;
          useVectorIcon = true;
        }
        break;
      default:
        // Fallback to MaterialIcons if available
        if (MaterialIcons) {
          VectorIconComponent = MaterialIcons;
          useVectorIcon = true;
        }
    }
  }
  
  // Select default icon based on iconType if no custom icon is provided
  let defaultIcon = defaultRightTickIcon;
  if (iconType === 'question' && !icon && !useVectorIcon) {
    defaultIcon = defaultQuestionMarkIcon;
  } else if (iconType === 'success' && !icon && !useVectorIcon) {
    defaultIcon = defaultRightTickIcon;
  }
  
  const displayIcon = icon || defaultIcon;

  // Determine if we have two buttons
  const hasTwoButtons = !!(primaryButton && secondaryButton);
  const hasSingleButton = !hasTwoButtons && (buttonText || primaryButton);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={[styles.modalOverlay, overlayStyle]}>
        <View style={[
          styles.modalContainer,
          isSmallScreen && styles.modalContainerSmall,
          containerStyle,
        ]}>
          {/* Close Button */}
          {showCloseButton && (
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          )}

          {/* Icon - Conditionally render vector icon or image icon */}
          {showIcon && (
            <>
              {useVectorIcon && VectorIconComponent && vectorIcon ? (
                <View style={[styles.iconContainer, iconStyle]}>
                  <VectorIconComponent
                    name={vectorIcon.name}
                    size={vectorIcon.size || wp(18)}
                    color={vectorIcon.color || '#1F1B4E'}
                  />
                </View>
              ) : (
                <Image 
                  source={displayIcon} 
                  style={[
                    styles.successIcon,
                    iconStyle,
                  ]} 
                />
              )}
            </>
          )}

          {/* Title/Message */}
          {title && (
            <Text style={[
              styles.modalTitle,
              isSmallScreen && styles.modalTitleSmall,
              titleStyle,
            ]}>
              {title}
            </Text>
          )}

          {/* Subtitle (optional) */}
          {subtitle && (
            <Text style={[
              styles.modalSubtitle,
              isSmallScreen && styles.modalSubtitleSmall,
              subtitleStyle,
            ]}>
              {subtitle}
            </Text>
          )}

          {/* Buttons */}
          {showButton && (
            <View style={[
              styles.buttonContainer,
              hasTwoButtons && (verticalButtons ? styles.twoButtonContainerVertical : styles.twoButtonContainer),
            ]}>
              {/* Two Buttons */}
              {hasTwoButtons ? (
                <>
                  {/* Primary Button (Top when vertical, Right when horizontal) */}
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalPrimaryButton,
                      isSmallScreen && styles.modalButtonSmall,
                      verticalButtons && styles.modalButtonVertical,
                      primaryButton.style,
                    ]}
                    onPress={primaryButton.onPress}
                  >
                    <Text style={[
                      styles.modalPrimaryButtonText,
                      isSmallScreen && styles.modalButtonTextSmall,
                      primaryButton.textStyle,
                    ]}>
                      {primaryButton.text}
                    </Text>
                  </TouchableOpacity>

                  {/* Secondary Button (Bottom when vertical, Left when horizontal) */}
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      styles.modalSecondaryButton,
                      isSmallScreen && styles.modalButtonSmall,
                      verticalButtons && styles.modalButtonVertical,
                      secondaryButton.style,
                    ]}
                    onPress={secondaryButton.onPress}
                  >
                    <Text style={[
                      styles.modalSecondaryButtonText,
                      isSmallScreen && styles.modalButtonTextSmall,
                      secondaryButton.textStyle,
                    ]}>
                      {secondaryButton.text}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Single Button (for backward compatibility) */
                <TouchableOpacity
                  style={[
                    styles.modalExitButton,
                    isSmallScreen && styles.modalExitButtonSmall,
                    buttonStyle,
                    primaryButton?.style,
                  ]}
                  onPress={onButtonPress || primaryButton?.onPress || onClose}
                >
                  <Text style={[
                    styles.modalExitButtonText,
                    isSmallScreen && styles.modalExitButtonTextSmall,
                    buttonTextStyle,
                    primaryButton?.textStyle,
                  ]}>
                    {buttonText || primaryButton?.text || 'Exit'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: wp(6),
    paddingTop: wp(8),
    width: wp(90),
    maxWidth: wp(90),
    alignItems: 'center',
    position: 'relative',
  },
  modalContainerSmall: {
    padding: wp(5),
    paddingTop: wp(6),
    width: wp(85),
    borderRadius: 16,
  },
  closeButton: {
    position: 'absolute',
    top: wp(4),
    right: wp(4),
    width: wp(8),
    height: wp(8),
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: wp(7),
    color: '#000000',
    fontWeight: '300',
    lineHeight: wp(8),
  },
  iconContainer: {
    marginBottom: hp(2),
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: wp(15),
    height: wp(15),
    marginBottom: hp(2),
    resizeMode: 'contain',
  },
  modalTitle: {
    fontSize: wp(5),
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  modalTitleSmall: {
    fontSize: wp(4.5),
    marginBottom: hp(0.8),
  },
  modalSubtitle: {
    fontSize: wp(3.8),
    fontWeight: '400',
    color: '#666666',
    fontFamily: 'Poppins-Regular',
    textAlign: 'center',
    marginBottom: hp(4),
  },
  modalSubtitleSmall: {
    fontSize: wp(3.5),
    marginBottom: hp(3),
  },
  modalExitButton: {
    backgroundColor: '#FFBF00',
    borderRadius: 10,
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(10),
    minWidth: wp(35),
    alignItems: 'center',
  },
  modalExitButtonSmall: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(8),
    minWidth: wp(30),
    borderRadius: 8,
  },
  modalExitButtonText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
  },
  modalExitButtonTextSmall: {
    fontSize: wp(4),
  },
  // Two Buttons Container
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  twoButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: wp(3),
    paddingHorizontal: wp(2),
  },
  twoButtonContainerVertical: {
    flexDirection: 'column',
    justifyContent: 'center',
    gap: hp(1.5),
    paddingHorizontal: wp(2),
  },
  // Button Base Styles
  modalButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonVertical: {
    width: '100%',
    flex: 0,
  },
  modalButtonSmall: {
    paddingVertical: hp(1),
    paddingHorizontal: wp(4),
    borderRadius: 8,
  },
  // Primary Button (Yellow/Right)
  modalPrimaryButton: {
    backgroundColor: '#FFBF00',
  },
  modalPrimaryButtonText: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: '#000000',
    fontFamily: 'Poppins-SemiBold',
  },
  // Secondary Button (White with border/Left)
  modalSecondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },
  modalSecondaryButtonText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#1F1B4E',
    fontFamily: 'Poppins-SemiBold',
  },
  modalButtonTextSmall: {
    fontSize: wp(4),
    fontWeight: '600',
  },
});

export default ReusableModal;
