import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function AIAssistant() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>AI Assistant</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
});
