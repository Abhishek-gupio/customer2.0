import React from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';

type ProfileMenuRowProps = {
  styles: any;
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  isLast?: boolean;
  badgeCount?: number;
};

export const ProfileMenuRow = React.memo(function ProfileMenuRow({
  styles,
  icon,
  label,
  onPress,
  color = '#aaa',
  bgColor = '#000',
  borderColor = 'rgba(255,255,255,0.1)',
  isLast = false,
  badgeCount = 0,
}: ProfileMenuRowProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View
        style={[
          styles.menuRow,
          !isLast && styles.menuRowBorder,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={[styles.menuIconWrap, { backgroundColor: bgColor, borderColor }]}>
          <Icon name={icon} size={wp(4.2)} color={color} />
        </View>
        <Text style={[styles.menuLabel, label === 'Logout' && localStyles.logoutLabel]}>{label}</Text>
        {badgeCount > 0 ? (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{badgeCount}</Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={wp(3)} color="#333" />
      </Animated.View>
    </TouchableOpacity>
  );
});

const localStyles = StyleSheet.create({
  logoutLabel: {
    color: '#F44336',
  },
});
