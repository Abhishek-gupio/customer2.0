import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Modal, Platform, ActivityIndicator } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import Wifi from './Wifi';

const NetworkBoundary: React.FC<React.PropsWithChildren> = ({ children }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const offlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Get initial network state
    NetInfo.fetch().then(state => {
      const connected =
        !!state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      // Don't show overlay immediately on initial load even if offline
      // User might have just opened the app
      if (!connected) {
        offlineTimerRef.current = setTimeout(() => {
          setShowOverlay(true);
          offlineTimerRef.current = null;
        }, 5000); // 5 second grace period
      }
    });

    // Listen for network state changes
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected =
        !!state.isConnected && state.isInternetReachable !== false;
      setIsConnected(connected);
      
      if (!connected) {
        // Network is down - wait 5 seconds before showing offline screen
        // This prevents brief network hiccups from showing the UI
        if (!offlineTimerRef.current) {
          offlineTimerRef.current = setTimeout(() => {
            setShowOverlay(true);
            offlineTimerRef.current = null;
          }, 5000); // 5 second grace period
        }
      } else {
        // Network is back - clear any pending timer and hide offline screen immediately
        if (offlineTimerRef.current) {
          clearTimeout(offlineTimerRef.current);
          offlineTimerRef.current = null;
        }
        setShowOverlay(false);
      }
    });

    return () => {
      unsubscribe();
      if (offlineTimerRef.current) {
        clearTimeout(offlineTimerRef.current);
      }
    };
  }, []);

  // Show loading while checking initial network state
  if (isConnected === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2A2459" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {children}
      {/* Overlay/modal for No Internet */}
      <Modal
        visible={showOverlay}
        animationType="fade"
        transparent={true}
        statusBarTranslucent={true}
        hardwareAccelerated={true}
      >
        <View style={styles.overlay} pointerEvents="auto">
          <Wifi />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor:
      Platform.OS === 'ios'
        ? 'rgba(247,248,252,0.98)'
        : 'rgba(247,248,252,0.99)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F4F8',
  },
});

export default NetworkBoundary;
