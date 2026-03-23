import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  Pressable,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { StackNavigationProp } from '@react-navigation/stack';
import { useScreenErrorBoundary } from '../components/useScreenErrorBoundary';
import { useHistory } from '../hooks/useHistory';
import { HistoryRecord } from '../services/historyApi';

type RootStackParamList = {
  Media: undefined;
  Home: undefined;
};

interface MediaItem {
  id: string;
  type: 'photo' | 'video';
  url: string;
  label: string;
  vehicleNumber: string;
  pickupTime: string;
}

const Media: React.FC = () => {
  const { error, ErrorBoundaryUI } = useScreenErrorBoundary('Media');
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { data, loading, error: historyError, refetch } = useHistory();
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  if (error) return ErrorBoundaryUI;

  // Refetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  // Transform history records into media items
  const mediaItems: MediaItem[] = useMemo(() => {
    const items: MediaItem[] = [];
    
    data.forEach((record: HistoryRecord) => {
      const vehicleNumber = record.vehicle.vehicleNumber;
      const pickupTime = new Date(record.pickup.pickupTime).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });

      if (record.pickup.meterPhotoUrl) {
        items.push({
          id: `${record.id}-meter`,
          type: 'photo',
          url: record.pickup.meterPhotoUrl,
          label: 'Meter Photo',
          vehicleNumber,
          pickupTime,
        });
      }

      if (record.pickup.vehiclePhotoUrl) {
        items.push({
          id: `${record.id}-vehicle-photo`,
          type: 'photo',
          url: record.pickup.vehiclePhotoUrl,
          label: 'Vehicle Photo',
          vehicleNumber,
          pickupTime,
        });
      }

      if (record.pickup.vehicleVideoUrl) {
        items.push({
          id: `${record.id}-vehicle-video`,
          type: 'video',
          url: record.pickup.vehicleVideoUrl,
          label: 'Vehicle Video',
          vehicleNumber,
          pickupTime,
        });
      }
    });

    return items;
  }, [data]);

  const handleMediaPress = (item: MediaItem) => {
    setSelectedMedia(item);
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setSelectedMedia(null);
  };

  const renderMediaItem = ({ item }: { item: MediaItem }) => (
    <TouchableOpacity
      style={styles.mediaCard}
      onPress={() => handleMediaPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.thumbnailContainer}>
        {item.type === 'photo' ? (
          <Image
            source={{ uri: item.url }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.videoThumbnail}>
            <View style={styles.playButtonOverlay}>
              <View style={styles.playButton}>
                <Text style={styles.playIcon}>▶</Text>
              </View>
            </View>
            <Image
              source={{ uri: item.url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </View>
        )}
      </View>
      <View style={styles.mediaInfo}>
        <Text style={styles.mediaLabel} numberOfLines={1}>
          {item.label}
        </Text>
        <Text style={styles.vehicleNumber} numberOfLines={1}>
          {item.vehicleNumber}
        </Text>
        <Text style={styles.pickupTime} numberOfLines={1}>
          {item.pickupTime}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator
            size="large"
            color="#5E5CD5"
            style={{ marginTop: hp('5%') }}
          />
          <Text style={styles.loadingText}>Loading media...</Text>
        </View>
      );
    }

    if (historyError) {
      return (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {historyError}</Text>
          <Pressable
            onPress={() => refetch()}
            style={styles.retryButton}
            android_ripple={{ color: '#00000010' }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyText}>No media available</Text>
        <Text style={styles.emptySubText}>
          Vehicle photos and videos will appear here once your vehicle is picked up
        </Text>
      </View>
    );
  };

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="#FFFFFF"
        translucent={false}
      />

      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={goBack}
            style={styles.backButton}
            android_ripple={{ color: '#00000010', radius: 22 }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={styles.backArrow}>‹</Text>
          </Pressable>

          <Text style={styles.title}>Media</Text>
        </View>

        {mediaItems.length > 0 ? (
          <FlatList
            data={mediaItems}
            renderItem={renderMediaItem}
            keyExtractor={(item) => item.id}
            numColumns={2}
            contentContainerStyle={styles.listContent}
            columnWrapperStyle={styles.row}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={11}
            removeClippedSubviews={true}
            nestedScrollEnabled={Platform.OS === 'android'}
          />
        ) : (
          renderEmptyState()
        )}

        {/* Media Modal */}
        <Modal
          visible={modalVisible}
          transparent={true}
          animationType="fade"
          onRequestClose={closeModal}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalContent}>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={closeModal}
                  activeOpacity={0.7}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>

                {selectedMedia && (
                  <View style={styles.mediaViewer}>
                    <Text style={styles.modalLabel}>{selectedMedia.label}</Text>
                    <Text style={styles.modalVehicleNumber}>
                      {selectedMedia.vehicleNumber}
                    </Text>

                    {selectedMedia.type === 'photo' ? (
                      <Image
                        source={{ uri: selectedMedia.url }}
                        style={styles.fullMedia}
                        resizeMode="contain"
                      />
                    ) : (
                      <View style={styles.videoContainer}>
                        <WebView
                          source={{
                            html: `
                              <!DOCTYPE html>
                              <html>
                                <head>
                                  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                                  <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:;">
                                  <style>
                                    * {
                                      margin: 0;
                                      padding: 0;
                                      box-sizing: border-box;
                                    }
                                    html, body {
                                      width: 100%;
                                      height: 100%;
                                      background-color: #000;
                                      overflow: hidden;
                                      display: flex;
                                      justify-content: center;
                                      align-items: center;
                                    }
                                    .video-wrapper {
                                      width: 100%;
                                      height: 100%;
                                      display: flex;
                                      justify-content: center;
                                      align-items: center;
                                      background-color: #000;
                                      position: relative;
                                    }
                                    video {
                                      width: 100%;
                                      height: 100%;
                                      object-fit: contain;
                                      background-color: #000;
                                      display: block;
                                    }
                                  </style>
                                </head>
                                <body>
                                  <div class="video-wrapper">
                                    <video 
                                      id="videoPlayer"
                                      controls 
                                      autoplay 
                                      playsinline 
                                      webkit-playsinline="true"
                                      x5-playsinline="true"
                                      x5-video-player-type="h5"
                                      x5-video-player-fullscreen="true"
                                      preload="auto"
                                      crossorigin="anonymous"
                                    >
                                      <source src="${selectedMedia.url}" type="video/mp4">
                                      <source src="${selectedMedia.url}">
                                    </video>
                                  </div>
                                  <script>
                                    (function() {
                                      var video = document.getElementById('videoPlayer');
                                      if (video) {
                                        video.addEventListener('loadstart', function() {
                                          console.log('Video load started');
                                        });
                                        video.addEventListener('loadeddata', function() {
                                          console.log('Video data loaded');
                                          video.style.backgroundColor = '#000';
                                        });
                                        video.addEventListener('loadedmetadata', function() {
                                          console.log('Video metadata loaded');
                                          video.style.backgroundColor = '#000';
                                          try {
                                            video.play().catch(function(error) {
                                              console.log('Auto-play prevented:', error);
                                            });
                                          } catch(e) {
                                            console.log('Play error:', e);
                                          }
                                        });
                                        video.addEventListener('canplay', function() {
                                          console.log('Video can play');
                                          video.style.backgroundColor = '#000';
                                        });
                                        video.addEventListener('error', function(e) {
                                          console.log('Video error:', e);
                                        });
                                        // Force video to be visible
                                        video.style.display = 'block';
                                        video.style.visibility = 'visible';
                                        video.style.opacity = '1';
                                      }
                                    })();
                                  </script>
                                </body>
                              </html>
                            `,
                          }}
                          style={styles.fullMedia}
                          allowsFullscreenVideo={true}
                          mediaPlaybackRequiresUserAction={false}
                          javaScriptEnabled={true}
                          domStorageEnabled={true}
                          startInLoadingState={true}
                          scalesPageToFit={false}
                          allowsInlineMediaPlayback={true}
                          bounces={false}
                          scrollEnabled={false}
                          originWhitelist={['*']}
                          mixedContentMode="always"
                          cacheEnabled={false}
                          incognito={false}
                          onLoadStart={() => {
                            console.log('WebView load started');
                          }}
                          onLoadEnd={() => {
                            console.log('WebView load ended');
                          }}
                          onError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.warn('WebView error: ', nativeEvent);
                          }}
                          onHttpError={(syntheticEvent) => {
                            const { nativeEvent } = syntheticEvent;
                            console.warn('WebView HTTP error: ', nativeEvent);
                          }}
                        />
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  
  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    alignContent: 'center',
    paddingHorizontal: wp('5.5%'),
    height: hp('7%'),
    backgroundColor: '#FFFFFF',
    borderBottomWidth: wp('0.2%'),
    borderBottomColor: '#E5E5EA',
  },
  backButton: {
    width: wp('5%'),
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    paddingTop: hp('0.6%'),
    paddingLeft: wp('1%'),
  },
  backArrow: {
    fontSize: hp('4%'),
    fontWeight: '700',
    color: '#000',
    includeFontPadding: false,
    paddingTop: Platform.OS === 'ios' ? hp('0.2%') : hp(0),
    lineHeight: Math.round(hp('3.6%')),
  },
  title: {
    marginLeft: wp('1%'),
    fontSize: hp('2.4%'),
    fontWeight: '700',
    color: '#000',
    textAlign: 'left',
    includeFontPadding: false,
    lineHeight: Math.round(hp('3.6%')),
  },
  listContent: {
    paddingTop: hp('2%'),
    paddingBottom: hp('3%'),
    paddingHorizontal: wp('3%'),
  },
  row: {
    justifyContent: 'space-between',
  },
  mediaCard: {
    width: wp('45%'),
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: hp('2%'),
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  thumbnailContainer: {
    width: '100%',
    height: hp('20%'),
    backgroundColor: '#F5F5F5',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 1,
  },
  playButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    color: '#4D1C96',
    marginLeft: 3,
  },
  mediaInfo: {
    padding: wp('3%'),
  },
  mediaLabel: {
    fontSize: hp('1.8%'),
    fontWeight: '600',
    color: '#000000',
    marginBottom: hp('0.5%'),
  },
  vehicleNumber: {
    fontSize: hp('1.6%'),
    color: '#666666',
    marginBottom: hp('0.3%'),
  },
  pickupTime: {
    fontSize: hp('1.4%'),
    color: '#999999',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: wp('5%'),
  },
  loadingText: {
    marginTop: hp('2%'),
    fontSize: hp('1.8%'),
    color: '#666',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: hp('2%'),
    color: '#999',
    fontWeight: '500',
    marginBottom: hp('1%'),
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: hp('1.6%'),
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: wp('5%'),
  },
  errorText: {
    fontSize: hp('1.8%'),
    color: '#E74C3C',
    fontWeight: '500',
    marginBottom: hp('2%'),
    textAlign: 'center',
  },
  retryButton: {
    marginTop: hp('2%'),
    paddingHorizontal: wp('5%'),
    paddingVertical: hp('1.2%'),
    backgroundColor: '#5E5CD5',
    borderRadius: wp('2%'),
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: hp('1.6%'),
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '95%',
    height: '90%',
    backgroundColor: '#000000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  mediaViewer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp('5%'),
  },
  modalLabel: {
    color: '#FFFFFF',
    fontSize: hp('2%'),
    fontWeight: '600',
    marginBottom: hp('0.5%'),
    textAlign: 'center',
  },
  modalVehicleNumber: {
    color: '#FFFFFF',
    fontSize: hp('1.6%'),
    marginBottom: hp('2%'),
    textAlign: 'center',
    opacity: 0.8,
  },
  fullMedia: {
    width: '100%',
    height: '80%',
    backgroundColor: '#000000',
  },
  videoContainer: {
    width: '100%',
    height: '80%',
    backgroundColor: '#000000',
    position: 'relative',
  },
});

export default Media;
