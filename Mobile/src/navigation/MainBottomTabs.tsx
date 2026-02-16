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
import Search from '../screens/Main/Search';
import AIAssistant from '../screens/Main/AIAssistant';
import Alerts from '../screens/Main/Alerts';
import History from '../screens/Main/History';

const Tab = createBottomTabNavigator<MainTabParamList>();

const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  Home: 'home',
  Search: 'search',
  AIAssistant: 'robot',
  Alerts: 'bell',
  History: 'history',
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
        activeOpacity={0.9}
        onPress={(e) => onPress?.(e)}
        style={styles.centerButton}
        accessibilityRole="button"
        accessibilityLabel="AI Assistant"
      >
        <View style={styles.centerButtonInner}>
          <Icon name="magic" size={24} color="#000" />
        </View>
      </TouchableOpacity>
    </View>
  );
}

export function MainBottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: '#FFBF00',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS.Home} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Search"
        component={Search}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS.Search} size={size ?? 24} color={color} />
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
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS.Alerts} size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="History"
        component={History}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Icon name={TAB_ICONS.History} size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#0a0a0a',
    borderTopColor: 'rgba(255,255,255,0.1)',
    borderTopWidth: 1,
    paddingTop: hp(1.5),
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -hp(3),
  },
  centerButton: {
    width: wp(18),
    height: wp(18),
    borderRadius: wp(9),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e6ac00',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  centerButtonInner: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
