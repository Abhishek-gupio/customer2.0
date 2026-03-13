import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import type { MainTabParamList } from './types';
import Home from '../screens/Main/Home';
import { ServiceNavigator } from './ServiceNavigator';
import AIAssistant from '../screens/Main/AIAssistant';
import Alerts from '../screens/Main/Alerts';
import History from '../screens/Main/History';
import HeyGupioOverlay from '../components/HeyGupioOverlay';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: 'home',
  Services: 'th-large',
  AIAssistant: 'robot',
  Alerts: 'bell',
  History: 'clock',
};

function CenterTabButton({
  onPress,
}: {
  children?: React.ReactNode;
  onPress?: (e: unknown) => void;
  accessibilityState?: { selected?: boolean };
}) {
  return (
    <View style={styles.centerWrapper}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={(e) => onPress?.(e)}
        style={styles.centerButton}
        accessibilityRole="button"
        accessibilityLabel="AI Assistant"
      >
        <View style={styles.iconCentering}>
          <Icon name="magic" size={16} color="#000" />
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
          name="Services"
          component={ServiceNavigator}
          options={{
            tabBarLabel: 'Services',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.Services} size={18} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="AIAssistant"
          component={AIAssistant}
          options={{
            tabBarLabel: () => null,
            tabBarIcon: () => null,
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
          name="Alerts"
          component={Alerts}
          options={{
            tabBarLabel: 'Alerts',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.Alerts} size={18} color={color} />
            ),
          }}
        />
        <Tab.Screen
          name="History"
          component={History}
          options={{
            tabBarLabel: 'History',
            tabBarIcon: ({ color }) => (
              <Icon name={TAB_ICONS.History} size={18} color={color} />
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
  centerButton: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: '#fff',
    marginTop: -hp(0.6),
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  iconCentering: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    paddingTop: 2, // Added slight top margin/offset for the icon
  },
});
