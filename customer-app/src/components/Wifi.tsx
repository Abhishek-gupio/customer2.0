import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  Animated,
} from 'react-native';
import Button from './Button';

const wifi = require('../assets/wifi.png');

const CircularDotsLoader = () => {
  const DOTS = 8;
  const dots = Array.from(
    { length: DOTS },
    () => useState(new Animated.Value(0.3))[0],
  );

  useEffect(() => {
    const animateDots = () => {
      const animations = dots.map((dot, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(index * 120),
            Animated.timing(dot, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(dot, {
              toValue: 0.3,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
          { iterations: -1 },
        );
      });
      Animated.parallel(animations).start();
    };
    animateDots();
  }, []);

  const radius = 25;
  const centerX = 40,
    centerY = 34;
  return (
    <View style={styles.circularLoader}>
      {dots.map((dot, index) => {
        const angle = ((2 * Math.PI) / DOTS) * index;
        const x = centerX + radius * Math.cos(angle) - 8;
        const y = centerY + radius * Math.sin(angle) - 4;
        const rotate = `${(angle * 180) / Math.PI}deg`;
        return (
          <Animated.View
            key={index}
            style={[
              styles.circularDot,
              {
                left: x,
                top: y,
                opacity: dot,
                transform: [{ rotate }],
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const Wifi = () => {
  const [isRetrying, setIsRetrying] = useState(false);
  const handleRetry = () => {
    setIsRetrying(true);
    setTimeout(() => setIsRetrying(false), 3000);
  };
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F7F8FC" />
      <View style={styles.iconContainer}>
        {isRetrying ? (
          <CircularDotsLoader />
        ) : (
          <Image source={wifi} style={styles.wifiImage} resizeMode="contain" />
        )}
      </View>
      <Text style={styles.title}>Connection Lost</Text>
      <Text style={styles.subtitle}>
        Please check your internet connection and try again.
      </Text>
      <Button
        title={isRetrying ? 'Retrying...' : 'Try Again'}
        onPress={handleRetry}
        containerStyle={{
          ...styles.button,
          ...(isRetrying && styles.buttonRetrying),
        }}
        textStyle={{
          ...styles.buttonText,
          color: isRetrying ? '#1F1B4E' : '#FFFFFF',
        }}
        disabled={isRetrying}
      />
    </View>
  );
};

export default Wifi;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FC',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  iconContainer: {
    marginBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: 68,
    position: 'relative',
  },
  wifiImage: {
    width: 80,
    height: 68,
  },
  circularLoader: {
    width: 80,
    height: 68,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularDot: {
    position: 'absolute',
    width: 16,
    height: 8,
    backgroundColor: '#000',
    borderRadius: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#322D84',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#322D84',
    textAlign: 'center',
    lineHeight: 24,
    width: 260,
    marginBottom: 40,
  },
  button: {
    backgroundColor: '#433BC9',
    borderRadius: 20,
    width: 185,
    height: 55,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRetrying: {
    backgroundColor: '#A5A5D6',
  },
  buttonText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
