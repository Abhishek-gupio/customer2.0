import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { getNetworkOnlineState, subscribeNetworkState } from '../services/api';

export default function NetworkBanner() {
  const [online, setOnline] = useState(getNetworkOnlineState());
  const [slide] = useState(() => new Animated.Value(online ? -56 : 0));

  useEffect(() => {
    const unsub = subscribeNetworkState((next) => {
      setOnline(next);
      Animated.timing(slide, {
        toValue: next ? -56 : 0,
        duration: 220,
        useNativeDriver: true,
      }).start();
    });
    return unsub;
  }, [slide]);

  if (online) return null;

  return (
    <Animated.View style={[styles.banner, { transform: [{ translateY: slide }] }]}>
      <Text style={styles.text}>You are offline. Cached data is shown.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: '#991b1b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
