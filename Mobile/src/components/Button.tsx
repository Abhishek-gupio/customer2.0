import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
  TextStyle,
  type StyleProp,
} from 'react-native';

export type LoaderButtonProps = {
  title: string;
  loading?: boolean;
  loadingTitle?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  loadingTitleStyle?: StyleProp<TextStyle>;
  indicatorColor?: string;
};

export default function LoaderButton({
  title,
  loading = false,
  loadingTitle,
  onPress,
  disabled = false,
  style,
  titleStyle,
  loadingTitleStyle,
  indicatorColor = '#000000',
}: LoaderButtonProps) {
  const isDisabled = loading || disabled;
  const resolvedLoadingTitle = loadingTitle?.trim();

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      style={[styles.button, style, isDisabled && styles.buttonDisabled]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <View style={styles.loadingContent}>
          <ActivityIndicator color={indicatorColor} size="small" />
          {resolvedLoadingTitle ? (
            <Text style={[styles.loadingTitle, loadingTitleStyle]}>{resolvedLoadingTitle}</Text>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.title, titleStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: 16,
    color: '#000000',
    marginLeft: 10,
    letterSpacing: 0,
  },
  title: {
    fontFamily: 'Outfit-Black',
    fontSize: 18,
    color: '#000000',
    letterSpacing: 0,
    fontWeight: '900',
  },
});
