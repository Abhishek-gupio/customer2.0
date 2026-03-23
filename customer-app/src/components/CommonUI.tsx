import React from 'react';
import {
  View,
  ImageBackground,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageSourcePropType,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface WaveLayoutProps {
  /** Content inside the blue wave */
  topContent?: React.ReactNode;
  /** Content in the bottom section */
  bottomContent?: React.ReactNode;
  /** Extra styling for the top content container */
  topContainerStyle?: StyleProp<ViewStyle>;
  /** Extra styling for the bottom content container */
  bottomContainerStyle?: StyleProp<ViewStyle>;
  /** Optional custom wave image */
  image?: ImageSourcePropType;
  /** Platform-specific adjustments (overrides defaults) */
  topPlatformAdjust?: StyleProp<ViewStyle>;
  bottomPlatformAdjust?: StyleProp<ViewStyle>;
  /** Extra styling for the whole wave background section */
  waveSectionStyle?: StyleProp<ViewStyle>;
}

const WaveLayout: React.FC<WaveLayoutProps> = ({
  topContent,
  bottomContent,
  topContainerStyle,
  bottomContainerStyle,
  image,
  topPlatformAdjust,
  bottomPlatformAdjust,
  waveSectionStyle,
}) => {
  return (
    <View style={styles.root}>
      {/* Top wave section */}
      <ImageBackground
        source={image || require('../assets/Rectangle24035.png')}
        resizeMode="stretch"
        style={[styles.waveSection, waveSectionStyle]}
      >
        <SafeAreaView
          style={[
            styles.topInner,
            styles.defaultTopPlatformAdjust,
            topPlatformAdjust,
            topContainerStyle,
          ]}
        >
          {topContent}
        </SafeAreaView>
      </ImageBackground>

      {/* Bottom white section */}
      <SafeAreaView
        style={[
          styles.bottomSection,
          styles.defaultBottomPlatformAdjust,
          bottomPlatformAdjust,
          bottomContainerStyle,
        ]}
      >
        {bottomContent}
      </SafeAreaView>
    </View>
  );
};

export default WaveLayout;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F3F4F9',
    width: '100%',
    height: '100%',
  },
  waveSection: {
    width: '100%',
    minHeight: '25%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topInner: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bottomSection: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 5,
  },
  defaultTopPlatformAdjust:
    Platform.OS === 'android' ? { paddingTop: 40 } : { paddingTop: 0 },
  defaultBottomPlatformAdjust:
    Platform.OS === 'android' ? { paddingBottom: 20 } : { paddingBottom: 0 },
});
