/**
 * Gupio Mobile App - Mini Project
 * Using Gicon.png asset with Button component
 *
 * @format
 */

import React from 'react';
import { StatusBar, StyleSheet, useColorScheme, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Button } from './src/components/Button';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  const handleButtonPress = () => {
    console.log('Gupio Button Pressed!');
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      <View style={styles.content}>
        <Button
          title="Gupio Services"
          onPress={handleButtonPress}
          iconSize={32}
        />
        <Button
          title="Your Vehicle Partner"
          onPress={handleButtonPress}
          iconSize={28}
          style={styles.secondaryButton}
          textStyle={styles.secondaryText}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 20,
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  secondaryText: {
    color: '#fff',
  },
});

export default App;
