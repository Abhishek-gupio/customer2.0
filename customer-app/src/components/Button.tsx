import React from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  containerStyle?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
  loading?: boolean;
  image?: any;
}

const Spinner: React.FC<{ color?: string }> = ({ color = '#4D1C96' }) => {
  const spinValue = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [spinValue]);
  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  return (
    <Animated.View
      style={{
        width: 18,
        height: 18,
        borderWidth: 2,
        borderColor: color,
        borderTopColor: 'transparent',
        borderRadius: 9,
        marginRight: 8,
        transform: [{ rotate: spin }],
      }}
    />
  );
};

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  containerStyle,
  textStyle,
  disabled = false,
  loading = false,
  image,
}) => {
  return (
    <TouchableOpacity
      style={[styles.container, containerStyle, disabled && styles.disabled]}
      onPress={onPress}
      activeOpacity={0.7}
      disabled={disabled}
    >
      <React.Fragment>
        <Animated.View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading && (
            <Spinner
              color={
                typeof textStyle?.color === 'string'
                  ? textStyle.color
                  : '#4D1C96'
              }
            />
          )}
          <Text style={[styles.text, textStyle]}>{title}</Text>
        </Animated.View>
      </React.Fragment>
    </TouchableOpacity>
  );
};

export default Button;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#3730A5', // default primary color
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5, // slightly dimmed
    // backgroundColor: 'rgba(0,0,0,0.05)', // light transparent overlay
    // borderRadius: 8,              // softer edges
  },
});
