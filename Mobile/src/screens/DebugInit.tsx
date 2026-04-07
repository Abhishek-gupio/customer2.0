import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export default function DebugInitScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>🛸 DEBUG: APP IS ALIVE!</Text>
      <Text style={styles.subtitle}>If you can see this, the core app engine is working perfectly.</Text>
      <Text style={styles.info}>The crash is likely inside the Splash or Main Dashboard logic.</Text>
      
      <TouchableOpacity 
        style={styles.button}
        onPress={() => navigation.replace('SigninFirst')}
      >
        <Text style={styles.buttonText}>TRY GOING TO SIGN-IN</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 8,
  },
  info: {
    fontSize: 14,
    color: '#444',
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: '#000',
    fontWeight: '700',
    letterSpacing: 1,
  },
});
