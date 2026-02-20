import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import Video from 'react-native-video';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';

const VIDEO_DURATION_MS = 8000;

const VIDEOS = [
  require('../assets/videos/document_locker.mp4'),
  require('../assets/videos/expense_tracker.mp4'),
  require('../assets/videos/vehicle_health.mp4'),
];

type HomeVideoProps = {
  onProfilePress?: () => void;
  onHelpPress?: () => void;
};

export default function HomeVideo({
  onProfilePress,
  onHelpPress,
}: HomeVideoProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % VIDEOS.length);
    }, VIDEO_DURATION_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <View style={styles.wrapper}>
      <Video
        key={currentIndex}
        source={VIDEOS[currentIndex] as any}
        style={styles.video}
        resizeMode="cover"
        repeat
        muted
        paused={false}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.iconButtonLeft}
          onPress={onProfilePress}
        >
          <Icon name="user-circle" size={wp(7)} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.iconButtonRight}
          onPress={onHelpPress}
        >
          <Icon name="question-circle" size={wp(7)} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: hp(28),
    backgroundColor: '#000',
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingTop: hp(1.5),
    paddingHorizontal: wp(5),
  },
  iconButtonLeft: {
    padding: wp(2),
  },
  iconButtonRight: {
    padding: wp(2),
  },
});
