import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FastImage from 'react-native-fast-image';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import BackButton from '../../components/BackButton';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import { useTheme, ThemeColors } from '../../theme/ThemeContext';
import { getYouTubeVideoId, openYouTubeExternally } from './utils/youtubeHelpers';

const FALLBACK_NEWS_IMAGE =
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=800';

/** How many cards to reveal per batch as the user scrolls — keeps the initial render light and scrolling smooth. */
const PAGE_SIZE = 8;

export default function TrendingListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { type, title, items } = route.params as { type: 'videos' | 'news'; title: string; items: any[] };
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const visibleItems = useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);
  const hasMore = visibleCount < items.length;

  const handleEndReached = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    // Small delay so the next batch fades in smoothly instead of popping in instantly.
    setTimeout(() => {
      setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, items.length));
      setLoadingMore(false);
    }, 300);
  }, [loadingMore, hasMore, items.length]);

  const handlePress = (item: any) => {
    if (type === 'videos') {
      const videoId = getYouTubeVideoId(item?.url);
      if (videoId) openYouTubeExternally(item.url, videoId);
    } else if (item?.url) {
      Linking.openURL(item.url).catch(() => {});
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        data={visibleItems}
        keyExtractor={(item, index) => String(item?.id ?? index)}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        initialNumToRender={PAGE_SIZE}
        maxToRenderPerBatch={PAGE_SIZE}
        windowSize={7}
        removeClippedSubviews
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color="#5F9EA0" />
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={() => handlePress(item)}>
            <View style={styles.thumbnailWrap}>
              <FastImage
                source={{
                  uri: type === 'videos' ? item?.thumbnail : item?.image || FALLBACK_NEWS_IMAGE,
                  priority: FastImage.priority.normal,
                }}
                style={styles.thumbnail}
                resizeMode={FastImage.resizeMode.cover}
              />
              {type === 'videos' && (
                <View style={styles.playOverlay}>
                  <MaterialIcon name="play-circle" size={40} color="#fff" />
                </View>
              )}
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle} numberOfLines={2}>
                {item?.title}
              </Text>
              <Text style={styles.cardMeta} numberOfLines={1}>
                {type === 'videos' ? [item?.tag, item?.views].filter(Boolean).join(' • ') : [item?.source, item?.time].filter(Boolean).join(' • ')}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Nothing to show right now.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: wp(5),
      paddingTop: hp(1.5),
      paddingBottom: hp(1.5),
    },
    title: {
      fontSize: wp(5.5),
      fontFamily: 'Outfit-Black',
      color: colors.textPrimary,
      marginLeft: wp(3),
      flexShrink: 1,
    },
    listContent: {
      paddingHorizontal: wp(5),
      paddingBottom: hp(4),
    },
    card: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderRadius: 16,
      marginBottom: hp(1.6),
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    thumbnailWrap: {
      width: wp(32),
      height: wp(22),
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    playOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.25)',
    },
    cardInfo: {
      flex: 1,
      paddingHorizontal: wp(3.5),
      paddingVertical: hp(1.2),
      justifyContent: 'center',
    },
    cardTitle: {
      color: colors.textPrimary,
      fontSize: wp(3.7),
      fontFamily: 'Outfit-SemiBold',
      marginBottom: hp(0.5),
    },
    cardMeta: {
      color: colors.textSecondary,
      fontSize: wp(3),
      fontFamily: 'Outfit-Regular',
    },
    footerLoader: {
      paddingVertical: hp(2.5),
      alignItems: 'center',
    },
    emptyWrap: {
      paddingTop: hp(8),
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontFamily: 'Outfit-Regular',
      fontSize: wp(3.6),
    },
  });
}
