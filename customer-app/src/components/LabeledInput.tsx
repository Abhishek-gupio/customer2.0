import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  ImageStyle,
  Platform,
} from 'react-native';

type StylePropType = ViewStyle | TextStyle | ImageStyle;

interface LabeledInputProps extends TextInputProps {
  label: string;
  leftIcon?: React.ReactNode;

  // base styles
  containerStyle?: StylePropType;
  labelStyle?: StylePropType;
  inputWrapperStyle?: StylePropType;
  inputStyle?: StylePropType;
  iconContainerStyle?: StylePropType;

  // platform-specific overrides
  iosStyles?: {
    containerStyle?: StylePropType;
    labelStyle?: StylePropType;
    inputWrapperStyle?: StylePropType;
    inputStyle?: StylePropType;
    iconContainerStyle?: StylePropType;
  };
  androidStyles?: {
    containerStyle?: StylePropType;
    labelStyle?: StylePropType;
    inputWrapperStyle?: StylePropType;
    inputStyle?: StylePropType;
    iconContainerStyle?: StylePropType;
  };
}

const LabeledInput: React.FC<LabeledInputProps> = ({
  label,
  leftIcon,
  containerStyle,
  labelStyle,
  inputWrapperStyle,
  inputStyle,
  iconContainerStyle,
  iosStyles,
  androidStyles,
  ...textInputProps
}) => {
  const platformStyles = Platform.OS === 'ios' ? iosStyles : androidStyles;

  return (
    <View
      style={[styles.container, containerStyle, platformStyles?.containerStyle]}
    >
      <Text style={[styles.label, labelStyle, platformStyles?.labelStyle]}>
        {label}
      </Text>

      <View
        style={[
          styles.inputWrapper,
          inputWrapperStyle,
          platformStyles?.inputWrapperStyle,
        ]}
      >
        {leftIcon ? (
          <View
            style={[
              styles.iconContainer,
              iconContainerStyle,
              platformStyles?.iconContainerStyle,
            ]}
          >
            {leftIcon}
          </View>
        ) : null}

        <TextInput
          style={[styles.input, inputStyle, platformStyles?.inputStyle]}
          placeholderTextColor="#A0A0A0"
          {...textInputProps}
        />
      </View>
    </View>
  );
};

export default LabeledInput;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginVertical: 10,
  },
  label: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 6,
    fontWeight: '500',

  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderColor: '#E0E0E0',
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    height: 48,
  },
  iconContainer: {
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
  },
});
