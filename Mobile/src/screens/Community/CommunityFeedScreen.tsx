import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Share,
  Platform,
  Dimensions,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { formatDistanceToNowStrict } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import {
  communityService,
  type CommunityPost,
  type Community,
  type FeedType,
  type ReactionEmoji,
} from '../../services/communityService';
import { getProfile, type ProfileResponse } from '../../services/profileService';
import { useCommunityStore } from '../../store/communityStore';
import { getAbsoluteUrl } from '../../config';
import { colors } from '../../theme';

const FEED_TABS: { key: string; label: string }[] = [
  { key: 'latest', label: 'For You' },
  { key: 'trending', label: 'Trending' },
  { key: 'following', label: 'Following' },
  { key: 'explore', label: 'Explore' },
  { key: 'carUpdates', label: 'Car Updates' },
];

const SLIDE_WIDTH = Dimensions.get('window').width - wp(10); // Matches card padding of wp(5) on each side

function CommunityStatsScroll({ community }: { community: Community | null }) {
  const stats = [
    {
      id: 'members',
      icon: 'account-group',
      color: '#8b5cf6',
      bg: 'rgba(139, 92, 246, 0.12)',
      border: 'rgba(139, 92, 246, 0.25)',
      count: community ? `${(community.memberCount / 1000).toFixed(1)}K` : '12.8K',
      label: 'Members',
      footer: '+280 this week',
    },
    {
      id: 'discussions',
      icon: 'chat-processing-outline',
      color: '#3b82f6',
      bg: 'rgba(59, 130, 246, 0.12)',
      border: 'rgba(59, 130, 246, 0.25)',
      count: community ? community.postCount.toString() : '346',
      label: 'Discussions',
      footer: '+18 today',
    },
    {
      id: 'active',
      icon: 'fire',
      color: '#f97316',
      bg: 'rgba(249, 115, 22, 0.12)',
      border: 'rgba(249, 115, 22, 0.25)',
      count: '2.4K',
      label: 'Active',
      footer: '+120 this week',
    },
    {
      id: 'contributors',
      icon: 'trophy-outline',
      color: '#10b981',
      bg: 'rgba(16, 185, 129, 0.12)',
      border: 'rgba(16, 185, 129, 0.25)',
      count: '320',
      label: 'Top Contributors',
      footer: 'View leaderboard',
    },
  ];

  return (
    <View style={styles.statsScrollContainer}>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={stats}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.statsScrollContent}
        renderItem={({ item }) => (
          <View style={[styles.statsCard, { borderColor: item.border }]}>
            <View style={styles.statsCardTop}>
              <View style={[styles.statsIconWrapper, { backgroundColor: item.bg }]}>
                <IconMC name={item.icon} size={wp(5)} color={item.color} />
              </View>
            </View>
            <Text style={styles.statsCount}>{item.count}</Text>
            <Text style={styles.statsLabel}>{item.label}</Text>
            <Text style={styles.statsFooter}>{item.footer}</Text>
          </View>
        )}
      />
    </View>
  );
}

function WhatsAppChannelBanner({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.whatsappBannerContainer}>
      <TouchableOpacity style={styles.whatsappCloseBtn} onPress={onClose} activeOpacity={0.7}>
        <IconMC name="close" size={wp(4.2)} color="#888" />
      </TouchableOpacity>

      <View style={styles.whatsappContentRow}>
        <View style={styles.whatsappIconBox}>
          <IconMC name="bullhorn" size={wp(5.8)} color="#8b5cf6" />
        </View>

        <View style={styles.whatsappTextCol}>
          <Text style={styles.whatsappSubTitle}>Join our exclusive</Text>
          <Text style={styles.whatsappTitle}>WhatsApp Channel!</Text>
          <Text style={styles.whatsappDesc}>
            Get the latest updates, tips & offers delivered straight to you.
          </Text>
        </View>

        <TouchableOpacity style={styles.whatsappJoinBtn} activeOpacity={0.8}>
          <Text style={styles.whatsappJoinBtnText}>Join Now</Text>
          <IconMC name="whatsapp" size={wp(3.8)} color="#a78bfa" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function MediaCarousel({ mediaUrls }: { mediaUrls: string[] }) {
  if (!mediaUrls || mediaUrls.length === 0) return null;

  if (mediaUrls.length === 1) {
    return (
      <View style={styles.mediaContainer}>
        <Image
          source={{ uri: getAbsoluteUrl(mediaUrls[0]) }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
      </View>
    );
  }

  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={mediaUrls}
        keyExtractor={(url) => url}
        onMomentumScrollEnd={(e) => {
          const width = e.nativeEvent.layoutMeasurement.width;
          const offset = e.nativeEvent.contentOffset.x;
          const idx = Math.round(offset / width);
          setActiveIndex(idx);
        }}
        renderItem={({ item }) => (
          <View style={styles.carouselSlide}>
            <Image
              source={{ uri: getAbsoluteUrl(item) }}
              style={styles.carouselImage}
              resizeMode="cover"
            />
          </View>
        )}
      />
      <View style={styles.carouselIndicators}>
        {mediaUrls.map((_, index) => (
          <React.Fragment key={index}>
            <View
              style={[
                styles.indicatorDot,
                activeIndex === index && styles.indicatorDotActive,
              ]}
            />
          </React.Fragment>
        ))}
      </View>
    </View>
  );
}

function PostCard({
  post,
  onReact,
  onPress,
}: {
  post: CommunityPost;
  onReact: (emoji: ReactionEmoji) => void;
  onPress: () => void;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const navigation = useNavigation<any>();

  // Use global Zustand store for likes state
  const likedPosts = useCommunityStore((s) => s.likedPosts);
  const toggleLike = useCommunityStore((s) => s.toggleLike);

  const isLiked = likedPosts[post.id] || false;
  const [localLikeOffset, setLocalLikeOffset] = useState(0);

  const handleLikePress = () => {
    if (isLiked) {
      setLocalLikeOffset((prev) => prev - 1);
      toggleLike(post.id);
      onReact('❤️');
    } else {
      setLocalLikeOffset((prev) => prev + 1);
      toggleLike(post.id);
      onReact('❤️');
    }
  };

  const renderPostText = (text: string | null) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return (
      <Text style={styles.postText}>
        {parts.map((part, index) => {
          if (part.startsWith('#') && part.length > 1) {
            return (
              <React.Fragment key={index}>
                <Text
                  style={styles.hashtag}
                  onPress={() => {
                    // Hashtag action could filter or search
                  }}
                >
                  {part}
                </Text>
              </React.Fragment>
            );
          }
          if (part.startsWith('@') && part.length > 1) {
            return (
              <React.Fragment key={index}>
                <Text style={styles.mention}>
                  {part}
                </Text>
              </React.Fragment>
            );
          }
          return part;
        })}
      </Text>
    );
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: post.text
          ? `${post.text}\n\nShared from Gupio Community`
          : 'Check out this post from Gupio Community!',
      });
    } catch (error) {
      console.log('Share error:', error);
    }
  };

  const initials = post.author.fullName
    ? post.author.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'VO';

  const displayedLikes = Math.max(0, post.reactionCount + localLikeOffset);

  return (
    <View style={styles.cardContainer}>
      <TouchableOpacity
        style={styles.cardTouch}
        activeOpacity={0.95}
        onPress={onPress}
      >
        <View style={styles.cardContent}>
          {/* Header Row: Avatar, Info, Date, Follow Button, More Options */}
          <View style={styles.cardHeaderRow}>
            {post.author.profilePic ? (
              <LinearGradient
                colors={[colors.Accent, colors.AccentLight]}
                style={styles.avatarGradientRing}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Image
                  source={{ uri: getAbsoluteUrl(post.author.profilePic) }}
                  style={styles.avatarImage}
                />
              </LinearGradient>
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: colors.Accent + '15' }]}>
                <Text style={styles.avatarInitials}>{initials}</Text>
              </View>
            )}

            <View style={styles.headerInfoCol}>
              <View style={styles.userInfoSubRow}>
                <Text style={styles.authorName} numberOfLines={1}>
                  {post.author.fullName ?? 'Vehicle Owner'}
                </Text>

                <TouchableOpacity style={styles.followBtn} activeOpacity={0.8}>
                  <Text style={styles.followBtnText}>Follow</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metaSubRow}>
                <Text style={styles.timeAgoText}>
                  {formatDistanceToNowStrict(new Date(post.createdAt))} ago
                </Text>
                <Text style={styles.dotSeparator}>·</Text>
                <IconMC name="earth" size={wp(3.4)} color="#666" style={styles.publicIcon} />
                <Text style={styles.timeAgoText}>Public</Text>

                {post.community?.name && (
                  <>
                    <Text style={styles.dotSeparator}>·</Text>
                    <TouchableOpacity
                      style={styles.communityBadge}
                      onPress={() =>
                        navigation.push('CommunityFeed', {
                          communityId: post.community?.id,
                          communityName: post.community?.name,
                        })
                      }
                    >
                      <Text style={styles.communityBadgeText} numberOfLines={1}>
                        {post.community.name}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>

            <TouchableOpacity style={styles.moreOptionsBtn} activeOpacity={0.7}>
              <IconMC name="dots-horizontal" size={wp(5)} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Centered Text Content */}
          {renderPostText(post.text)}

          {/* Media Slider (Carousel) */}
          <MediaCarousel mediaUrls={post.mediaUrls} />

          {/* Bottom Footer Action Buttons */}
          <View style={styles.cardFooter}>
            <View style={styles.footerLeftActions}>
              <TouchableOpacity
                style={styles.footerAction}
                onPress={handleLikePress}
                onLongPress={() => setShowReactions(true)}
                delayLongPress={350}
              >
                <IconMC
                  name="heart"
                  size={wp(4.6)}
                  color="#ef4444"
                />
                <Text style={[styles.footerCount, { color: '#ef4444' }]}>
                  {displayedLikes}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.footerAction} onPress={onPress}>
                <IconMC name="chat-outline" size={wp(4.6)} color="#888" />
                <Text style={[styles.footerCount, { color: '#fff' }]}>{post.commentCount}</Text>
              </TouchableOpacity>
            </View>

            {showReactions && (
              <View style={styles.reactionOverlay}>
                {(['👍', '❤️', '😂', '😮', '😢', '🔥'] as ReactionEmoji[]).map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    style={styles.reactionEmojiBtn}
                    onPress={() => {
                      onReact(emoji);
                      setShowReactions(false);
                    }}
                  >
                    <Text style={styles.reactionEmojiText}>{emoji}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.footerAction} onPress={handleShare}>
              <IconMC name="share-variant-outline" size={wp(4.6)} color="#888" />
              <Text style={styles.footerShareText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function CommunityFeedScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId: string | undefined = route.params?.communityId;
  const communityName: string | undefined = route.params?.communityName;
  const version = useCommunityStore((s) => s.version);
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [feedType, setFeedType] = useState<string>('latest');
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [community, setCommunity] = useState<Community | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [showWhatsappCta, setShowWhatsappCta] = useState(true);

  const load = useCallback((isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    
    const queryFeedType: FeedType = 
      (feedType === 'latest' || feedType === 'trending' || feedType === 'following') 
        ? feedType as FeedType 
        : 'latest';
    const fetchFeed = communityService.getFeed({ feedType: queryFeedType, communityId, limit: 20 });
    const fetchCommunity = communityId 
      ? communityService.getCommunity(communityId) 
      : Promise.resolve(null);
    const fetchProfile = getProfile().catch(() => null);

    Promise.all([fetchFeed, fetchCommunity, fetchProfile])
      .then(([postsData, communityData, profileData]) => {
        setPosts(postsData);
        setCommunity(communityData);
        if (profileData) setProfile(profileData);
      })
      .catch((err) => console.log('Feed load error:', err))
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
    try {
      await communityService.reactToPost(postId, emoji);
    } catch {
      load();
    }
  };

  const handleJoinToggle = async () => {
    if (!community) return;
    try {
      if (community.isMember) {
        await communityService.leave(community.id);
      } else {
        await communityService.join(community.id);
      }
      bumpVersion();
    } catch (err) {
      console.log('Join error:', err);
    }
  };

  const renderCommunityBanner = () => {
    if (!community) return null;

    const bannerUrl = community.bannerUrl ? getAbsoluteUrl(community.bannerUrl) : null;
    const iconUrl = community.iconUrl ? getAbsoluteUrl(community.iconUrl) : null;

    return (
      <View style={styles.communityBannerContainer}>
        {bannerUrl ? (
          <Image source={{ uri: bannerUrl }} style={styles.bannerImage} />
        ) : (
          <LinearGradient
            colors={[colors.Accent, colors.AccentLight]}
            style={styles.bannerGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <View style={styles.bannerOverlay} />

        <View style={styles.communityInfoWrap}>
          <View style={styles.communityHeaderRow}>
            {iconUrl ? (
              <Image source={{ uri: iconUrl }} style={styles.communityIcon} />
            ) : (
              <View style={styles.communityIconFallback}>
                <IconMC name="account-group" size={wp(7)} color="#fff" />
              </View>
            )}

            <TouchableOpacity
              style={[styles.joinBtn, community.isMember && styles.joinedBtn]}
              onPress={handleJoinToggle}
            >
              <Text style={[styles.joinBtnText, community.isMember && styles.joinedBtnText]}>
                {community.isMember ? 'Joined' : 'Join'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.communityNameText}>{community.name}</Text>
          <Text style={styles.communityMetaText}>
            {community.memberCount} members · {community.postCount} posts
          </Text>
          {community.description && (
            <Text style={styles.communityDescText} numberOfLines={2}>
              {community.description}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const myInitials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'ME';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Visual Header matching screenshot */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Community</Text>
        <View style={styles.headerRightControls}>
          <TouchableOpacity style={styles.headerControlBtn} activeOpacity={0.7}>
            <IconMC name="magnify" size={wp(6)} color="#fff" />
          </TouchableOpacity>
          
          {profile?.profilePic ? (
            <Image
              source={{ uri: getAbsoluteUrl(profile.profilePic) }}
              style={styles.headerAvatar}
            />
          ) : (
            <View style={[styles.headerAvatarFallback, { backgroundColor: colors.Accent + '25' }]}>
              <Text style={styles.headerAvatarInitials}>{myInitials}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tabs scrollable exactly like screenshot */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScrollContent}>
          {FEED_TABS.map((tab) => {
            const isActive = feedType === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setFeedType(tab.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                  {tab.label}
                </Text>
                {isActive && <View style={styles.tabIndicator} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.Accent} />
        </View>
      ) : posts.length === 0 && !community ? (
        <View style={styles.centerState}>
          <IconMC name="post-outline" size={wp(14)} color="#333" />
          <Text style={styles.emptyTitle}>No posts yet</Text>
          <Text style={styles.emptyText}>Be the first to share an update in this community.</Text>
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <>
              {renderCommunityBanner()}
              {/* Horizontal Stats scrolling list */}
              <CommunityStatsScroll community={community} />
            </>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.Accent}
              colors={[colors.Accent]}
            />
          }
          renderItem={({ item, index }) => (
            <React.Fragment key={item.id}>
              <PostCard
                post={item}
                onReact={(emoji) => handleReact(item.id, emoji)}
                onPress={() => navigation.navigate('PostDetail', { postId: item.id })}
              />
              {index === 0 && showWhatsappCta && (
                <WhatsAppChannelBanner onClose={() => setShowWhatsappCta(false)} />
              )}
            </React.Fragment>
          )}
        />
      )}

      {/* Modern Gradient FAB */}
      <TouchableOpacity
        style={styles.fabBtn}
        onPress={() => navigation.navigate('PostComposer', { communityId })}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={[colors.Accent, colors.AccentLight]}
          style={styles.fabGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <IconMC name="plus" size={wp(6)} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#111',
  },
  headerTitle: {
    flex: 1,
    fontSize: wp(5.4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  headerRightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3.5),
  },
  headerControlBtn: {
    padding: wp(1),
  },
  headerAvatar: {
    width: wp(8.8),
    height: wp(8.8),
    borderRadius: wp(4.4),
    backgroundColor: '#161618',
  },
  headerAvatarFallback: {
    width: wp(8.8),
    height: wp(8.8),
    borderRadius: wp(4.4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarInitials: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  tabsContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#111',
    backgroundColor: '#000',
  },
  tabsScrollContent: {
    paddingHorizontal: wp(2),
  },
  tabItem: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.6),
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  tabText: {
    color: '#666',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.7),
  },
  tabTextActive: {
    color: '#fff',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: wp(10),
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#a855f7', // Purple indicator dot/bar matching screenshot
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(10),
    gap: hp(1),
  },
  emptyTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
    marginTop: hp(1),
  },
  emptyText: {
    color: '#666',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.4),
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: hp(12),
  },
  // Statistics scrolling row
  statsScrollContainer: {
    marginTop: hp(1.5),
    marginBottom: hp(0.5),
  },
  statsScrollContent: {
    paddingHorizontal: wp(4),
    gap: wp(3),
  },
  statsCard: {
    width: wp(34),
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    padding: wp(3.5),
    justifyContent: 'center',
  },
  statsCardTop: {
    flexDirection: 'row',
    marginBottom: hp(0.8),
  },
  statsIconWrapper: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsCount: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.4),
  },
  statsLabel: {
    color: '#888',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.1),
    marginTop: hp(0.2),
  },
  statsFooter: {
    color: '#555',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.7),
    marginTop: hp(0.5),
  },
  // WhatsApp CTA Banner
  whatsappBannerContainer: {
    backgroundColor: '#08080a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#18181b',
    padding: wp(4.5),
    marginHorizontal: wp(4),
    marginTop: hp(1.8),
    position: 'relative',
  },
  whatsappCloseBtn: {
    position: 'absolute',
    top: hp(1.2),
    right: wp(3),
    zIndex: 10,
    padding: wp(1),
  },
  whatsappContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  whatsappIconBox: {
    width: wp(11.5),
    height: wp(11.5),
    borderRadius: 10,
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  whatsappTextCol: {
    flex: 1,
    marginRight: wp(2),
  },
  whatsappSubTitle: {
    color: '#aaa',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.9),
  },
  whatsappTitle: {
    color: '#a855f7',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    marginTop: hp(0.1),
  },
  whatsappDesc: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.9),
    marginTop: hp(0.4),
    lineHeight: wp(4),
  },
  whatsappJoinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.2),
    borderColor: '#8b5cf6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
  },
  whatsappJoinBtnText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.9),
  },
  // Sub-community Banner Styles
  communityBannerContainer: {
    width: '100%',
    position: 'relative',
    marginBottom: hp(2),
  },
  bannerImage: {
    width: '100%',
    height: hp(18),
  },
  bannerGradient: {
    width: '100%',
    height: hp(18),
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  communityInfoWrap: {
    paddingHorizontal: wp(4),
    marginTop: -hp(5),
  },
  communityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: hp(1),
  },
  communityIcon: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#222',
  },
  communityIconFallback: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 3,
    borderColor: '#000',
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtn: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(0.8),
    borderRadius: 18,
    backgroundColor: '#fff',
  },
  joinedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  joinBtnText: {
    color: '#000',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  joinedBtnText: {
    color: '#fff',
  },
  communityNameText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(5),
    marginTop: hp(0.5),
  },
  communityMetaText: {
    color: '#aaa',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.1),
    marginTop: hp(0.2),
  },
  communityDescText: {
    color: '#888',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.3),
    marginTop: hp(1),
    lineHeight: wp(4.5),
  },
  // Centered Post Card Styles
  cardContainer: {
    backgroundColor: '#0c0c0e',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1f1f23',
    paddingVertical: hp(1.8),
    paddingHorizontal: wp(5),
    marginHorizontal: wp(4),
    marginTop: hp(1.8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 3,
  },
  cardTouch: {
    flexDirection: 'row',
  },
  cardContent: {
    flex: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.2),
  },
  avatarGradientRing: {
    width: wp(11.5),
    height: wp(11.5),
    borderRadius: wp(5.75),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: wp(10.2),
    height: wp(10.2),
    borderRadius: wp(5.1),
    backgroundColor: '#161618',
  },
  avatarFallback: {
    width: wp(11.5),
    height: wp(11.5),
    borderRadius: wp(5.75),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },
  headerInfoCol: {
    flex: 1,
    marginLeft: wp(3),
  },
  userInfoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    marginRight: wp(3),
  },
  followBtn: {
    borderColor: '#818cf8',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(0.3),
  },
  followBtnText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
  },
  metaSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(0.3),
  },
  timeAgoText: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.9),
  },
  publicIcon: {
    marginRight: wp(0.8),
  },
  dotSeparator: {
    color: '#666',
    marginHorizontal: wp(1.2),
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 8,
    maxWidth: wp(40),
  },
  communityBadgeText: {
    color: '#6366f1',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
  },
  moreOptionsBtn: {
    padding: wp(1),
  },
  postText: {
    color: '#e1e1e1',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.8),
    lineHeight: wp(5.4),
    marginTop: hp(0.4),
    marginBottom: hp(1),
  },
  hashtag: {
    color: '#818cf8',
    fontFamily: 'Outfit-Bold',
  },
  mention: {
    color: '#818cf8',
    fontFamily: 'Outfit-Bold',
  },
  mediaContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f23',
    marginTop: hp(0.6),
    marginBottom: hp(0.8),
    backgroundColor: '#050505',
  },
  mediaImage: {
    width: '100%',
    height: hp(22),
  },
  carouselContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1f1f23',
    marginTop: hp(0.6),
    marginBottom: hp(0.8),
    position: 'relative',
    backgroundColor: '#050505',
  },
  carouselSlide: {
    width: SLIDE_WIDTH,
    height: hp(22),
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: hp(1.2),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: wp(1.2),
    zIndex: 10,
  },
  indicatorDot: {
    width: wp(1.5),
    height: wp(1.5),
    borderRadius: wp(0.75),
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  indicatorDotActive: {
    backgroundColor: '#fff',
    width: wp(1.7),
    height: wp(1.7),
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp(1),
    paddingTop: hp(0.8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1a1a1d',
  },
  footerLeftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(5),
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingVertical: hp(0.4),
  },
  footerCount: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  footerShareText: {
    color: '#888',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  reactionActionContainer: {
    position: 'relative',
  },
  reactionOverlay: {
    position: 'absolute',
    bottom: hp(3.8),
    left: -wp(6),
    flexDirection: 'row',
    backgroundColor: '#18181b',
    borderRadius: 24,
    paddingHorizontal: wp(1.8),
    paddingVertical: hp(0.5),
    borderWidth: 1,
    borderColor: '#2d2d30',
    zIndex: 9999,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    gap: wp(1.5),
    alignItems: 'center',
  },
  reactionEmojiBtn: {
    paddingHorizontal: wp(1),
  },
  reactionEmojiText: {
    fontSize: wp(4.6),
  },
  fabBtn: {
    position: 'absolute',
    bottom: hp(3),
    right: wp(5),
    width: wp(13.5),
    height: wp(13.5),
    borderRadius: wp(6.75),
    elevation: 8,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  fabGradient: {
    flex: 1,
    borderRadius: wp(6.75),
    alignItems: 'center',
    justifyContent: 'center',
  },
});
