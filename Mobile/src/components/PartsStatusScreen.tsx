import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useEffect, useRef } from 'react';
import {  Animated } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const IconRenderer = ({ name, color, size, iconSet }: any) => {
  switch (iconSet) {
    case 'Ionicons':
      return <Ionicons name={name} size={size} color={color} />;
    default:
      return (
        <MaterialCommunityIcons name={name} size={size} color={color} />
      );
  }
};

export const PartStatusCard = ({
  title,
  subtitle,
  percentage,
  statusText,
  color,
  icon,
  iconSet,
}: any) => {
  const animatedWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: Math.max(percentage, 4),
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [percentage]);

  const widthInterpolated = animatedWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={[styles.iconWrap, { borderColor: color }]}>
            <IconRenderer
              name={icon}
              color={color}
              size={wp(5.5)}
              iconSet={iconSet}
            />
          </View>

          <View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
        </View>

        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.percent, { color }]}>{percentage}%</Text>
          <Text style={[styles.status, { color }]}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.progressBg}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: widthInterpolated,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <View>
        {
          percentage <= 2 && (
            <View style={styles.critical}>
            <Icon name="warning" size={wp(5)} color="#eac511" />
            <Text style={{ color: '#EF4444', marginTop: hp(0.5) }}>
              Critical - Consider replacing soon
            </Text>
            </View>
          )
        }
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0F1115',
    borderRadius: wp(5),
    padding: wp(4),
    marginBottom: hp(2),
    borderWidth: wp(0.3),
    borderColor: '#676464',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(1.5),
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  iconWrap: {
    height: wp(10),
    width: wp(10),
    borderRadius: wp(5),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#fff',
    fontSize: wp(4.2),
    fontWeight: '600',
  },
  subtitle: {
    color: '#9CA3AF',
    marginTop: hp(0.5),
  },
  percent: {
    fontSize: wp(6),
    fontWeight: '700',
  },
  status: {
    fontSize: wp(3.5),
    marginTop: hp(0.3),
  },
  progressBg: {
    height: hp(0.8),
    backgroundColor: '#2A2D34',
    borderRadius: hp(1),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: hp(1),
  },
  critical: {
    marginTop: hp(2),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: wp(3),
    padding: wp(3),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: wp(2),
    borderWidth: wp(0.1),
    borderColor: '#EF4444',
  },

});