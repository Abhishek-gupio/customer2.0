import React, { useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Animated,
  Image,
} from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import LinearGradient from 'react-native-linear-gradient';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import type { MainTabParamList } from './types';
import Home from '../screens/Main/Home';
import { ServiceNavigator } from './ServiceNavigator';
import AIAssistant from '../screens/Main/AIAssistant';
import Odometer from '../screens/Main/Odometer'; 
import HeyGupioOverlay from '../components/HeyGupioOverlay';
import GupioGarageApp from '../screens/Vehicles/GupioGarageApp';

const GupioLogoAI = require('../assets/images/gupio-logo-ai.png') as any;

const AI_GRADIENT = ['#4f46e5', '#7c3aed', '#06b6d4', '#4f46e5'] as const;
const FLOW_DURATION_MS = 3000;
const AGENT_PULSE_MS = 5600;

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: 'home',
  my_garage: 'car',
  Services: 'th-large',
  AIAssistant: 'robot',
  Odometer: 'tachometer-alt',
};

function CenterTabButton({
  onPress,
}: {
  children?: React.ReactNode;
  onPress?: (e: unknown) => void;
  accessibilityState?: { selected?: boolean };
}) {
  const flowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(flowAnim, {
        toValue: 1,
        duration: FLOW_DURATION_MS,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [flowAnim]);

  const rotate = flowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={styles.centerWrapper}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={(e) => onPress?.(e)}
        style={styles.centerButtonOuter}
        accessibilityRole="button"
        accessibilityLabel="AI Assistant"
      >
        <View style={styles.centerButtonGlow} />
        <View style={styles.centerButton}>
          <Animated.View
            style={[
              styles.flowGradientWrap,
              { transform: [{ rotate }] },
            ]}
          >
            <LinearGradient
              colors={[...AI_GRADIENT]}
              style={styles.flowGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
          </Animated.View>
          <View style={styles.centerButtonIconWrap}>
            <Image 
              source={GupioLogoAI} 
              style={{ width: wp(7.5), height: wp(7.5) }} 
              resizeMode="contain"
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function MainBottomTabs() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0a0a0a' }}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: '#fff',
          tabBarInactiveTintColor: '#666',
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarShowLabel: true,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tab.Screen
          name="Home"
          component={Home}
          options={{
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.Home} size={18} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="my_garage"
          component={GupioGarageApp}
          options={{
            tabBarLabel: 'My Garage',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.my_garage} size={18} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="AIAssistant"
          component={AIAssistant}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => null,
            tabBarStyle: { display: 'none' },
            tabBarButton: (props) => (
              <CenterTabButton
                onPress={props.onPress as (e: unknown) => void}
                accessibilityState={props.accessibilityState}
              >
                {props.children}
              </CenterTabButton>
            ),
          }}
        />
        <Tab.Screen
          name="Services"
          component={ServiceNavigator}
          options={{
            tabBarLabel: 'Services',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.Services} size={18} color={color} />
            ),
          }}
          listeners={({ navigation }) => ({
            tabPress: () => {
              (navigation as any).navigate('Services', { screen: 'ServicesHome' });
            },
          })}
        />
        <Tab.Screen
          name="Odometer"
          component={Odometer}
          options={{
            tabBarLabel: 'Odometer',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.Odometer} size={18} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
      <HeyGupioOverlay />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111',
    borderTopWidth: 1,
    borderTopColor: '#222',
    height: Platform.OS === 'ios' ? hp(10) : hp(8),
    paddingBottom: Platform.OS === 'ios' ? hp(3.5) : hp(1.5),
    paddingTop: hp(1),
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 0,
  },
  tabBarLabel: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: hp(0.2),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  centerWrapper: {
    width: wp(20),
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    zIndex: 10,
  },
  centerButtonOuter: {
    marginTop: -hp(0.6),
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerButtonGlow: {
    position: 'absolute',
    width: wp(13),
    height: wp(13),
    borderRadius: wp(6.5),
    backgroundColor: 'transparent',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 14,
    elevation: 8,
  },
  centerButton: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowGradientWrap: {
    position: 'absolute',
    width: wp(22),
    height: wp(22),
    left: wp(-5),
    top: wp(-5),
  },
  flowGradient: {
    width: '100%',
    height: '100%',
    borderRadius: wp(11),
  },
  centerButtonIconWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});