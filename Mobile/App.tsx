import React from 'react';
import { SafeAreaView, Text, StatusBar } from 'react-native';

const App = () => {
  return (
    <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <StatusBar barStyle="dark-content" />
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>Hello Android Release!</Text>
    </SafeAreaView>
  );
};

export default App;
