import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { communityService, type CommunityPost, type FeedType, type ReactionEmoji } from '../../services/communityService';
import { useCommunityStore } from '../../store/communityStore';

const FEED_TABS: { key: FeedType; label: string }[] = [
  { key: 'latest', label: 'Latest' },
  { key: 'trending', label: 'Trending' },
  { key: 'following', label: 'Following' },
];

function PostCard({ post, onReact, onPress }: { post: CommunityPost; onReact: (emoji: ReactionEmoji) => void; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.cardHeader}>
        <View style={styles.avatar}>
          <IconMC name="account" size={wp(5)} color="#FFBF00" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.authorName} numberOfLines={1}>{post.author.fullName ?? 'Vehicle owner'}</Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            {post.community?.name ? `${post.community.name} · ` : ''}
            {formatDistanceToNowStrict(new Date(post.createdAt))} ago
          </Text>
        </View>
      </View>

      {!!post.text && <Text style={styles.postText}>{post.text}</Text>}

      {post.mediaUrls.length > 0 && (
        <Image source={{ uri: post.mediaUrls[0] }} style={styles.media} resizeMode="cover" />
      )}

      <View style={styles.cardFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={() => onReact('👍')}>
          <IconMC name="thumb-up-outline" size={wp(4.2)} color="#888" />
          <Text style={styles.footerText}>{post.reactionCount}</Text>
        </TouchableOpacity>
        <View style={styles.footerAction}>
          <IconMC name="comment-outline" size={wp(4.2)} color="#888" />
          <Text style={styles.footerText}>{post.commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CommunityFeedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId: string | undefined = route.params?.communityId;
  const communityName: string | undefined = route.params?.communityName;
  const version = useCommunityStore((s) => s.version);

  const [feedType, setFeedType] = useState<FeedType>('latest');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    communityService
      .getFeed({ feedType, communityId, limit: 20 })
      .then(setPosts)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [feedType, communityId]);

  useEffect(load, [load, version]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true);
  };

  const handleReact = async (postId: string, emoji: ReactionEmoji) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, reactionCount: p.reactionCount + 1 } : p)));
    try {
      await communityService.reactToPost(postId, emoji);
    } catch {
      load();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>{communityName ?? 'Community'}</Text>
        {!communityId && (
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('CommunitiesDiscover')}>
            <IconMC name="compass-outline" size={wp(5)} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.composeBtn} onPress={() => navigation.navigate('PostComposer', { communityId })}>
          <IconMC name="plus" size={wp(5)} color="#111" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {FEED_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, feedType === tab.key && styles.tabActive]}
            onPress={() => setFeedType(tab.key)}
          >
            <Text style={[styles.tabText, feedType === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : posts.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="post-outline" size={wp(12)} color="#444" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>Be the first to post in your vehicle community.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFBF00" />}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onReact={(emoji) => handleReact(item.id, emoji)}
              onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { flex: 1, fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  iconBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(2),
  },
  composeBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', paddingHorizontal: wp(5), marginBottom: hp(1.5), gap: wp(2) },
  tab: { paddingVertical: hp(0.8), paddingHorizontal: wp(4), borderRadius: 14, backgroundColor: '#141414' },
  tabActive: { backgroundColor: '#FFBF00' },
  tabText: { color: '#888', fontFamily: 'Outfit-Bold', fontSize: wp(3.3) },
  tabTextActive: { color: '#111' },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1) },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), marginTop: hp(1) },
  emptyText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4), gap: hp(1.5) },
  card: { backgroundColor: '#141414', borderRadius: 16, borderWidth: 1, borderColor: '#222', padding: wp(4), marginBottom: hp(1.5) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(1) },
  avatar: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  authorName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.7) },
  metaLine: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.9) },
  postText: { color: '#ddd', fontFamily: 'Outfit-Regular', fontSize: wp(3.6), marginBottom: hp(1), lineHeight: wp(5) },
  media: { width: '100%', height: hp(24), borderRadius: 12, marginBottom: hp(1) },
  cardFooter: { flexDirection: 'row', gap: wp(6), borderTopWidth: 1, borderTopColor: '#1e1e1e', paddingTop: hp(1) },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: wp(1.5) },
  footerText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.2) },
});
