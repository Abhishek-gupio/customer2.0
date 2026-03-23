import React from 'react';
import {
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
} from 'react-native';

interface CircleAvatarProps {
  /** Image source e.g. require('../assets/user.png') or {uri:'...'} */
  source?: ImageSourcePropType;
  /** Diameter of the circle in pixels */
  size?: number;
  /** Border color */
  borderColor?: string;
  /** Border width */
  borderWidth?: number;
  /** Optional initials when no image is present */
  placeholderText?: string;
  /** Press handler */
  onPress?: () => void;
  /** Background color for placeholder */
  placeholderBg?: string;
}

const CircleAvatar: React.FC<CircleAvatarProps> = ({
  source,
  size = 90,
  borderColor = '#4A90E2',
  borderWidth = 3,
  placeholderText,
  onPress,
  placeholderBg = '#E0E0E0',
}) => {
  const Wrapper: React.ElementType = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      style={[
        styles.wrapper,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor,
          borderWidth,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {source ? (
        <Image
          source={source}
          style={{
            width: size - borderWidth * 2,
            height: size - borderWidth * 2,
            borderRadius: (size - borderWidth * 2) / 2,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              backgroundColor: placeholderBg,
              width: size - borderWidth * 2,
              height: size - borderWidth * 2,
              borderRadius: (size - borderWidth * 2) / 2,
            },
          ]}
        >
          {placeholderText && (
            <Text style={styles.placeholderText}>{placeholderText}</Text>
          )}
        </View>
      )}
    </Wrapper>
  );
};

export default CircleAvatar;

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 24,
    color: '#555',
    fontWeight: '600',
  },
});
