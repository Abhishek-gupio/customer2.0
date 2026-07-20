import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { styles } from '../homeStyles';

type TrendingNewsSectionProps = {
  news: any[];
  loading: boolean;
  onNewsPress: (url: string) => void;
};

export const TrendingNewsSection = React.memo(function TrendingNewsSection({
  news,
  loading,
  onNewsPress,
}: TrendingNewsSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending News</Text>
        {loading ? <ActivityIndicator size="small" color="#FFBF00" /> : null}
      </View>
      {loading && news.length === 0 ? (
        <View style={styles.discoveryPlaceholder}>
          <View style={styles.discoveryLoadingRow}>
            <ActivityIndicator size="small" color="#FFBF00" />
            <Text style={styles.discoveryPlaceholderText}>
              Loading news\u2026
            </Text>
          </View>
        </View>
      ) : news.length === 0 ? (
        <View style={styles.discoveryPlaceholder}>
          <Text style={styles.discoveryPlaceholderText}>
            No news right now. Check back soon.
          </Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          contentContainerStyle={styles.videoListContent}
        >
          {news.map((item, index) => (
            <TouchableOpacity
              key={String(item?.id ?? index)}
              style={styles.videoCard}
              onPress={() => onNewsPress(item?.url)}
            >
              {item?.source ? (
                <View style={styles.videoTag}>
                  <Text style={styles.tagText}>{item.source}</Text>
                </View>
              ) : null}
              <View style={styles.videoThumbnail}>
                <FastImage
                  source={{
                    uri:
                      item?.image ||
                      'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800',
                    priority: FastImage.priority.normal,
                  }}
                  style={styles.thumbnailImage}
                  resizeMode={FastImage.resizeMode.cover}
                />
              </View>
              <View style={styles.videoCardInfo}>
                <Text style={styles.videoCardTitle} numberOfLines={2}>
                  {item?.title}
                </Text>
                <View style={styles.videoCardFooter}>
                  <Text style={styles.videoCardDetails}>{item?.time}</Text>
                  <View style={styles.latestBadge}>
                    <Text style={styles.latestLabel}>LATEST</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
});
