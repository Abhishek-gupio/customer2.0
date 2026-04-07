import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';
import { State } from 'react-native-gesture-handler';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import type { SelectedVideo } from '../types/home';

export function useFloatingVideo() {
  const [selectedVideo, setSelectedVideo] = useState<SelectedVideo | null>(
    null,
  );
  const [isVideoDragging, setIsVideoDragging] = useState(false);
  const [isVideoExpanded, setIsVideoExpanded] = useState(false);
  const videoBaseX = useRef(new Animated.Value(0)).current;
  const videoBaseY = useRef(new Animated.Value(0)).current;
  const videoDragX = useRef(new Animated.Value(0)).current;
  const videoDragY = useRef(new Animated.Value(0)).current;
  const videoModalOffset = useRef({ x: 0, y: 0 });
  const lastMiniVideoOffset = useRef({ x: 0, y: 0 });
  const isVideoExpandedRef = useRef(false);
  const windowSize = Dimensions.get('window');
  const miniVideoCardWidth = wp(58);
  const miniVideoCardHeight = (miniVideoCardWidth * 9) / 16 + hp(4.8);
  const expandedVideoCardWidth = wp(88);
  const expandedVideoCardHeight = hp(44) + hp(4.8);
  const miniBaseLeft = Math.max(
    wp(2),
    windowSize.width - miniVideoCardWidth - wp(3),
  );
  const miniBaseTop = Math.max(
    hp(12),
    windowSize.height - miniVideoCardHeight - hp(13),
  );
  const expandedBaseLeft = Math.max(
    wp(4),
    (windowSize.width - expandedVideoCardWidth) / 2,
  );
  const expandedBaseTop = Math.max(
    hp(8),
    (windowSize.height - expandedVideoCardHeight) / 2,
  );

  const clampVideoOffset = useCallback(
    (x: number, y: number, expanded: boolean) => {
      const baseLeft = expanded ? expandedBaseLeft : miniBaseLeft;
      const baseTop = expanded ? expandedBaseTop : miniBaseTop;
      const cardWidth = expanded ? expandedVideoCardWidth : miniVideoCardWidth;
      const cardHeight = expanded
        ? expandedVideoCardHeight
        : miniVideoCardHeight;
      const minX = wp(2) - baseLeft;
      const maxX = windowSize.width - cardWidth - wp(2) - baseLeft;
      const minY = hp(2) - baseTop;
      const maxY = windowSize.height - cardHeight - hp(6) - baseTop;

      return {
        x: Math.min(Math.max(x, minX), Math.max(minX, maxX)),
        y: Math.min(Math.max(y, minY), Math.max(minY, maxY)),
      };
    },
    [
      expandedBaseLeft,
      expandedBaseTop,
      expandedVideoCardHeight,
      expandedVideoCardWidth,
      miniBaseLeft,
      miniBaseTop,
      miniVideoCardHeight,
      miniVideoCardWidth,
      windowSize.height,
      windowSize.width,
    ],
  );

  const snapMiniVideoOffset = useCallback(
    (x: number, y: number) => {
      const clampedOffset = clampVideoOffset(x, y, false);
      const minX = wp(2) - miniBaseLeft;
      const maxX = windowSize.width - miniVideoCardWidth - wp(2) - miniBaseLeft;
      const snapX =
        Math.abs(clampedOffset.x - minX) < Math.abs(clampedOffset.x - maxX)
          ? minX
          : maxX;

      return {
        x: snapX,
        y: clampedOffset.y,
      };
    },
    [clampVideoOffset, miniBaseLeft, miniVideoCardWidth, windowSize.width],
  );

  const animateVideoToOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      Animated.parallel([
        Animated.spring(videoBaseX, {
          toValue: nextOffset.x,
          useNativeDriver: true,
          tension: 72,
          friction: 10,
        }),
        Animated.spring(videoBaseY, {
          toValue: nextOffset.y,
          useNativeDriver: true,
          tension: 72,
          friction: 10,
        }),
      ]).start();
    },
    [videoBaseX, videoBaseY],
  );

  const videoDragGestureEvent = useMemo(
    () =>
      Animated.event(
        [
          {
            nativeEvent: { translationX: videoDragX, translationY: videoDragY },
          },
        ],
        { useNativeDriver: true },
      ),
    [videoDragX, videoDragY],
  );

  const handleVideoGestureStateChange = useCallback(
    (event: any) => {
      const { nativeEvent } = event;
      const translationX = nativeEvent.translationX ?? 0;
      const translationY = nativeEvent.translationY ?? 0;

      if (nativeEvent.state === State.BEGAN) {
        videoBaseX.stopAnimation(value => {
          videoModalOffset.current.x = value;
        });
        videoBaseY.stopAnimation(value => {
          videoModalOffset.current.y = value;
        });
        videoDragX.setValue(0);
        videoDragY.setValue(0);
        setIsVideoDragging(true);
        return;
      }

      if (nativeEvent.oldState !== State.ACTIVE) {
        return;
      }

      const nextOffset = isVideoExpandedRef.current
        ? clampVideoOffset(
            videoModalOffset.current.x + translationX,
            videoModalOffset.current.y + translationY,
            true,
          )
        : snapMiniVideoOffset(
            videoModalOffset.current.x + translationX,
            videoModalOffset.current.y + translationY,
          );

      videoModalOffset.current = nextOffset;
      videoDragX.setValue(0);
      videoDragY.setValue(0);
      setIsVideoDragging(false);
      animateVideoToOffset(nextOffset);
    },
    [
      animateVideoToOffset,
      clampVideoOffset,
      snapMiniVideoOffset,
      videoBaseX,
      videoBaseY,
      videoDragX,
      videoDragY,
    ],
  );

  const toggleVideoExpanded = useCallback(() => {
    setIsVideoDragging(false);

    if (isVideoExpanded) {
      videoModalOffset.current = lastMiniVideoOffset.current;
      videoBaseX.setValue(lastMiniVideoOffset.current.x);
      videoBaseY.setValue(lastMiniVideoOffset.current.y);
      videoDragX.setValue(0);
      videoDragY.setValue(0);
      setIsVideoExpanded(false);
      return;
    }

    lastMiniVideoOffset.current = videoModalOffset.current;
    videoModalOffset.current = { x: 0, y: 0 };
    videoBaseX.setValue(0);
    videoBaseY.setValue(0);
    videoDragX.setValue(0);
    videoDragY.setValue(0);
    setIsVideoExpanded(true);
  }, [isVideoExpanded, videoBaseX, videoBaseY, videoDragX, videoDragY]);

  const closeSelectedVideo = useCallback(() => {
    setSelectedVideo(null);
  }, []);

  useEffect(() => {
    isVideoExpandedRef.current = isVideoExpanded;
  }, [isVideoExpanded]);

  useEffect(() => {
    if (selectedVideo) {
      videoModalOffset.current = { x: 0, y: 0 };
      lastMiniVideoOffset.current = { x: 0, y: 0 };
      setIsVideoExpanded(false);
      videoBaseX.setValue(0);
      videoBaseY.setValue(0);
      videoDragX.setValue(0);
      videoDragY.setValue(0);
    }
  }, [selectedVideo, videoBaseX, videoBaseY, videoDragX, videoDragY]);

  return {
    selectedVideo,
    setSelectedVideo,
    closeSelectedVideo,
    isVideoDragging,
    isVideoExpanded,
    miniBaseLeft,
    miniBaseTop,
    miniVideoCardWidth,
    expandedBaseLeft,
    expandedBaseTop,
    expandedVideoCardWidth,
    videoBaseX,
    videoBaseY,
    videoDragX,
    videoDragY,
    videoDragGestureEvent,
    handleVideoGestureStateChange,
    toggleVideoExpanded,
  };
}
