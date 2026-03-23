import React from 'react';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import { View, Text, ImageBackground, StatusBar, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Button from '../components/Button';
const bg = require('../assets/Welcome.png');
const logo = require('../assets/gupio_logo.png');

const Wellcome = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('Wellcome');
  if (error) return ErrorBoundaryUI;
  const navigation = useNavigation();
  const onPress = () => {
    navigation.navigate('Login' as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <StatusBar
        barStyle="light-content" // white icons over dark photo
        translucent // draw under status bar on Android
        backgroundColor="transparent" 
      />

      <ImageBackground
        source={bg}
        resizeMode="cover"
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <View
          style={{
            position: 'absolute',
            top: '27%',
            left: 0,
            right: 0,
            padding: 0,
          }}
        >
          <Text
            style={{
              fontFamily: 'Poppins-Bold',
              fontWeight: '700',
              fontSize: 30,
              lineHeight: 30,
              letterSpacing: 0,
              textAlign: 'center',
              color: '#FFBF00',
              alignSelf: 'center',
            }}
          >
            Welcome to
          </Text>
        </View>

        <View
          style={{
            position: 'absolute',
            top: '27%',
            left: 0,
            right: 0,
            padding: 0,
          }}
        >
          <Image
            source={logo}
            resizeMode="contain"
            style={{
              width: '50%',
              alignSelf: 'center',
              aspectRatio: 1,
            }}
          ></Image>
        </View>
        <Button
          title="Sign In"
          onPress={onPress}
          containerStyle={{
            backgroundColor: '#FFBF00',
            borderRadius: 10,
            width: 'auto',
            position: 'absolute',
            top: '67%',
            paddingHorizontal: 60,
            paddingVertical: 8,
          }}
          textStyle={{
            fontSize: 20,
            fontWeight: '600',
            color: '#4D1C96',
            textAlign: 'center',
          }}
        />
      </ImageBackground>
    </View>
  );
};

export default Wellcome;
