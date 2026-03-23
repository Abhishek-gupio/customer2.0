import React, { useState, useRef } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import { heightPercentageToDP as hp } from 'react-native-responsive-screen';

/**
 * Service ad banner: video or static, like big apps (muted loop).
 * - videoSource: require('./video.mp4') or { uri: 'https://...' } or null for static.
 */
export type ServiceAdVideoSource = { uri: string } | number | null;

const DEFAULT_VIDEO = require('../assets/videos/vehicle_health.mp4') as number;

type ServiceAdBannerProps = {
  videoSource?: ServiceAdVideoSource;
  onPress?: () => void;
};

export default function ServiceAdBanner({
  videoSource = DEFAULT_VIDEO,
  onPress,
}: ServiceAdBannerProps) {
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<any>(null);

  const showVideo = videoSource != null && !videoError;
  const source =
    typeof videoSource === 'number'
      ? (videoSource as any)
      : videoSource != null
        ? (videoSource as { uri: string })
        : null;

  return (
    <TouchableOpacity
      style={styles.banner}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {showVideo && source != null && (
        <Video
          ref={videoRef}
          source={source}
          style={styles.video}
          resizeMode="cover"
          repeat
          muted
          paused={false}
          onError={() => setVideoError(true)}
          ignoreSilentSwitch="ignore"
        />
      )}
      {(!showVideo || videoError) && (
        <LinearGradient
          colors={['#1a1a1a', '#252525']}
          style={StyleSheet.absoluteFill}
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    width: '100%',
    height: hp(18),
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
});
