import React, { useCallback, useMemo } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { PanGestureHandler } from 'react-native-gesture-handler';
import { WebView } from 'react-native-webview';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';
import type { SelectedVideo } from '../types/home';
import { openYouTubeExternally } from '../utils/youtubeHelpers';

type FloatingVideoPlayerProps = {
  selectedVideo: SelectedVideo | null;
  isVideoDragging: boolean;
  isVideoExpanded: boolean;
  miniBaseTop: number;
  miniBaseLeft: number;
  miniVideoCardWidth: number;
  expandedBaseTop: number;
  expandedBaseLeft: number;
  expandedVideoCardWidth: number;
  videoBaseX: Animated.Value;
  videoBaseY: Animated.Value;
  videoDragX: Animated.Value;
  videoDragY: Animated.Value;
  videoDragGestureEvent: any;
  handleVideoGestureStateChange: (event: any) => void;
  onToggleExpanded: () => void;
  onClose: () => void;
};

export const FloatingVideoPlayer = React.memo(function FloatingVideoPlayer({
  selectedVideo,
  isVideoDragging,
  isVideoExpanded,
  miniBaseTop,
  miniBaseLeft,
  miniVideoCardWidth,
  expandedBaseTop,
  expandedBaseLeft,
  expandedVideoCardWidth,
  videoBaseX,
  videoBaseY,
  videoDragX,
  videoDragY,
  videoDragGestureEvent,
  handleVideoGestureStateChange,
  onToggleExpanded,
  onClose,
}: FloatingVideoPlayerProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const handleShouldStartLoad = useCallback(
    (request: any) => {
      if (!selectedVideo) {
        return false;
      }

      const requestUrl = request.url;
      const lowerRequestUrl = requestUrl.toLowerCase();

      if (
        lowerRequestUrl.startsWith('vnd.youtube') ||
        lowerRequestUrl.startsWith('intent://') ||
        lowerRequestUrl.startsWith('youtube://')
      ) {
        openYouTubeExternally(requestUrl, selectedVideo.id);
        return false;
      }

      if (
        requestUrl === 'about:blank' ||
        requestUrl === selectedVideo.embedUrl
      ) {
        return true;
      }

      const isBlockedYouTubeNavigation =
        lowerRequestUrl.includes('youtube.com/watch') ||
        lowerRequestUrl.includes('youtube.com/shorts/') ||
        lowerRequestUrl.includes('youtube.com/live/') ||
        lowerRequestUrl.includes('youtube.com/channel/') ||
        lowerRequestUrl.includes('youtube.com/c/') ||
        lowerRequestUrl.includes('youtube.com/@') ||
        lowerRequestUrl.includes('youtube.com/results') ||
        lowerRequestUrl.includes('youtube.com/feed/') ||
        lowerRequestUrl.includes('youtube.com/playlist') ||
        lowerRequestUrl.includes('youtube.com/redirect') ||
        lowerRequestUrl.includes('youtube.com/attribution_link') ||
        lowerRequestUrl.includes('m.youtube.com/') ||
        lowerRequestUrl.includes('youtu.be/');

      if (isBlockedYouTubeNavigation) {
        openYouTubeExternally(requestUrl, selectedVideo.id);
        return false;
      }

      return (
        lowerRequestUrl.includes(`/embed/${selectedVideo.id}`) ||
        lowerRequestUrl.includes('youtube.com/embed/') ||
        lowerRequestUrl.includes('youtube-nocookie.com/embed/') ||
        lowerRequestUrl.includes('youtube.com/iframe_api') ||
        lowerRequestUrl.includes('youtube.com/s/player/') ||
        lowerRequestUrl.includes('youtube.com/youtubei/') ||
        lowerRequestUrl.includes('googlevideo.com/') ||
        lowerRequestUrl.includes('ytimg.com/') ||
        lowerRequestUrl.includes('gstatic.com/') ||
        lowerRequestUrl.includes('googleusercontent.com/')
      );
    },
    [selectedVideo],
  );

  if (!selectedVideo) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={styles.videoModalOverlay}>
      <Animated.View
        renderToHardwareTextureAndroid={true}
        shouldRasterizeIOS={true}
        style={[
          styles.videoModalCard,
          isVideoExpanded ? styles.videoModalCardExpanded : null,
          !isVideoExpanded && isVideoDragging
            ? styles.videoModalCardDragging
            : null,
          {
            top: isVideoExpanded ? expandedBaseTop : miniBaseTop,
            left: isVideoExpanded ? expandedBaseLeft : miniBaseLeft,
            width: isVideoExpanded
              ? expandedVideoCardWidth
              : miniVideoCardWidth,
            transform: [
              { translateX: Animated.add(videoBaseX, videoDragX) },
              { translateY: Animated.add(videoBaseY, videoDragY) },
            ],
          },
        ]}
      >
        <View style={styles.inlinePlayerHeader}>
          <PanGestureHandler
            activeOffsetX={[-4, 4]}
            activeOffsetY={[-4, 4]}
            avgTouches
            onGestureEvent={videoDragGestureEvent}
            onHandlerStateChange={handleVideoGestureStateChange}
          >
            <Animated.View style={styles.videoModalDragHeader}>
              <View style={styles.videoModalDragHandle} />
              <Text style={styles.inlinePlayerTitle} numberOfLines={1}>
                {selectedVideo.title}
              </Text>
            </Animated.View>
          </PanGestureHandler>
          <View style={styles.inlinePlayerActions}>
            <TouchableOpacity
              style={styles.inlinePlayerClose}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialIcon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View
          pointerEvents={isVideoDragging ? 'none' : 'auto'}
          style={
            isVideoExpanded
              ? styles.inlinePlayerFrameExpanded
              : styles.inlinePlayerFrame
          }
        >
          <WebView
            key={selectedVideo.embedUrl}
            source={{
              uri: selectedVideo.embedUrl,
              headers: {
                Referer: 'https://gupio.in/',
                Origin: 'https://gupio.in',
              },
            }}
            style={styles.inlinePlayer}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            allowsInlineMediaPlayback={true}
            mediaPlaybackRequiresUserAction={false}
            scrollEnabled={false}
            originWhitelist={['*']}
            overScrollMode="never"
            bounces={false}
            javaScriptCanOpenWindowsAutomatically={false}
            setSupportMultipleWindows={false}
            allowsFullscreenVideo={false}
            androidLayerType="hardware"
            onShouldStartLoadWithRequest={handleShouldStartLoad}
            onError={event => console.warn('Inline player error', event)}
          />
          <TouchableOpacity
            style={styles.videoExpandOverlayButton}
            onPress={onToggleExpanded}
            activeOpacity={0.85}
          >
            <MaterialIcon
              name={isVideoExpanded ? 'fullscreen-exit' : 'fullscreen'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
});
