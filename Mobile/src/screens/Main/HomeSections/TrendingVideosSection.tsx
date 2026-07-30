import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type TrendingVideosSectionProps = {
  videos: any[];
  loading: boolean;
  selectedVideoId?: string | null;
  onVideoPress: (url: unknown, title: unknown) => void;
  getYouTubeVideoId: (url: unknown) => string | null;
  onViewMorePress?: () => void;
};

export const TrendingVideosSection = React.memo(function TrendingVideosSection({
  videos,
  loading,
  selectedVideoId,
  onVideoPress,
  getYouTubeVideoId,
  onViewMorePress,
}: TrendingVideosSectionProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Videos</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#5F9EA0" />
        ) : videos.length > 0 && onViewMorePress ? (
          <TouchableOpacity style={styles.viewAllRow} onPress={onViewMorePress}>
            <Text style={styles.viewAllText}>View more</Text>
            <MaterialIcon name="chevron-right" size={16} color="#ccc" />
          </TouchableOpacity>
        ) : null}
      </View>
      {loading && videos.length === 0 ? (
        <View style={styles.discoveryPlaceholder}>
          <View style={styles.discoveryLoadingRow}>
            <ActivityIndicator size="small" color="#5F9EA0" />
            <Text style={styles.discoveryPlaceholderText}>
              Loading videos\u2026
            </Text>
          </View>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.discoveryPlaceholder}>
          <Text style={styles.discoveryPlaceholderText}>
            No videos right now. Check back soon.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.videoListContent}
        >
          {videos.map((item, index) => {
            const videoId = getYouTubeVideoId(item?.url);
            const isActive = selectedVideoId === videoId;

            return (
              <TouchableOpacity
                key={String(item?.id ?? index)}
                style={[
                  styles.videoCard,
                  isActive ? styles.videoCardActive : undefined,
                ]}
                onPress={() => onVideoPress(item?.url, item?.title)}
              >
                {item?.tag ? (
                  <View style={styles.videoTag}>
                    <Text style={styles.tagText}>{item.tag}</Text>
                  </View>
                ) : null}
                <View style={styles.videoThumbnail}>
                  <FastImage
                    source={{
                      uri: item?.thumbnail,
                      priority: FastImage.priority.normal,
                    }}
                    style={styles.thumbnailImage}
                    resizeMode={FastImage.resizeMode.cover}
                  />
                  <View style={styles.playButtonOverlay}>
                    <MaterialIcon
                      name={isActive ? 'pause-circle' : 'play-circle'}
                      size={50}
                      color="#fff"
                    />
                  </View>
                  <Text style={styles.viewCount}>{item?.views}</Text>
                </View>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item?.title}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
});
