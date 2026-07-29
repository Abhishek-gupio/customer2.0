import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Share,
  Dimensions,
  Image,
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
  type CommunityComment,
} from '../../services/communityService';
import { getProfile, type ProfileResponse } from '../../services/profileService';
import { useCommunityStore } from '../../store/communityStore';
import { getAbsoluteUrl } from '../../config';
import { colors } from '../../theme';

const SLIDE_WIDTH = Dimensions.get('window').width - wp(8);

function MediaCarousel({ mediaUrls }: { mediaUrls: string[] }) {
  if (!mediaUrls || mediaUrls.length === 0) return null;

  if (mediaUrls.length === 1) {
    return (
      <View style={styles.mediaContainer}>
        <Image
          source={{ uri: getAbsoluteUrl(mediaUrls[0]) }}
          style={styles.mediaImage}
          resizeMode="contain"
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
              resizeMode="contain"
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

function CommentRow({ comment }: { comment: CommunityComment }) {
  const initials = comment.author.fullName
    ? comment.author.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'VO';

  return (
    <View style={[styles.commentRow, comment.parentId && styles.commentReplyRow]}>
      <View style={styles.commentAvatarCol}>
        {comment.author.profilePic ? (
          <Image
            source={{ uri: getAbsoluteUrl(comment.author.profilePic) }}
            style={styles.commentAvatar}
          />
        ) : (
          <View style={[styles.commentAvatarFallback, { backgroundColor: colors.Accent + '15' }]}>
            <Text style={styles.commentAvatarInitials}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={styles.commentBody}>
        <View style={styles.commentHeaderRow}>
          <Text style={styles.commentAuthor}>{comment.author.fullName ?? 'Vehicle Owner'}</Text>
          <Text style={styles.commentTime}>
            {formatDistanceToNowStrict(new Date(comment.createdAt))}
          </Text>
        </View>
        {!!comment.text && <Text style={styles.commentText}>{comment.text}</Text>}
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  // Connect to Zustand liked posts store state
  const likedPosts = useCommunityStore((s) => s.likedPosts);
  const toggleLike = useCommunityStore((s) => s.toggleLike);

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  
  const [localLikeOffset, setLocalLikeOffset] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      communityService.getPost(postId),
      communityService.listComments(postId),
      getProfile().catch(() => null),
    ])
      .then(([p, c, prof]) => {
        setPost(p);
        setComments(c);
        if (prof) setProfile(prof);
      })
      .catch((err) => console.log('Error loading detail screen:', err))
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(load, [load]);

  const isLiked = post ? (likedPosts[post.id] || false) : false;

  const handleReact = async () => {
    if (!post) return;
    if (isLiked) {
      setLocalLikeOffset((prev) => prev - 1);
      toggleLike(post.id);
      try {
        await communityService.reactToPost(post.id, '❤️');
        bumpVersion();
      } catch {
        load();
      }
    } else {
      setLocalLikeOffset((prev) => prev + 1);
      toggleLike(post.id);
      try {
        await communityService.reactToPost(post.id, '❤️');
        bumpVersion();
      } catch {
        load();
      }
    }
  };

  const handleSendComment = async () => {
    if (!commentText.trim()) return;
    setSending(true);
    try {
      const comment = await communityService.createComment(postId, { text: commentText.trim() });
      setComments((prev) => [...prev, comment]);
      setCommentText('');
      setPost((p) => (p ? { ...p, commentCount: p.commentCount + 1 } : p));
      bumpVersion();
    } catch (err) {
      console.log('Error sending comment:', err);
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;
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

  const renderPostText = (text: string | null) => {
    if (!text) return null;
    const parts = text.split(/(\s+)/);
    return (
      <Text style={styles.postText}>
        {parts.map((part, index) => {
          if (part.startsWith('#') && part.length > 1) {
            return (
              <React.Fragment key={index}>
                <Text style={styles.hashtag}>
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

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Thread</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.Accent} />
        </View>
      </SafeAreaView>
    );
  }

  const postInitials = post.author.fullName
    ? post.author.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'VO';

  const userInitials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'VO';

  const displayedLikes = Math.max(0, post.reactionCount + localLikeOffset);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? hp(2) : 0}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Thread</Text>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={styles.postCard}>
              {/* Centered card header */}
              <View style={styles.cardHeader}>
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
                    <Text style={styles.avatarInitials}>{postInitials}</Text>
                  </View>
                )}

                <View style={styles.userInfoCol}>
                  <View style={styles.userInfoSubRow}>
                    <Text style={styles.authorName}>{post.author.fullName ?? 'Vehicle Owner'}</Text>
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
                            navigation.navigate('CommunityFeed', {
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

              {renderPostText(post.text)}

              {/* Multiple Photo Carousel */}
              <MediaCarousel mediaUrls={post.mediaUrls} />

              <Text style={styles.dateStampText}>
                {formatDistanceToNowStrict(new Date(post.createdAt))} ago
              </Text>

              {/* Engagement metrics counts */}
              <View style={styles.engagementRow}>
                <Text style={styles.engagementText}>
                  <Text style={styles.engagementNumber}>{displayedLikes}</Text> Likes
                </Text>
                <Text style={styles.engagementText}>
                  <Text style={styles.engagementNumber}>{post.commentCount}</Text> Comments
                </Text>
              </View>

              {/* Engagement icons bar */}
              <View style={styles.cardFooter}>
                <TouchableOpacity style={styles.footerAction} onPress={handleReact}>
                  <IconMC
                    name={isLiked ? 'heart' : 'heart-outline'}
                    size={wp(5.2)}
                    color={isLiked ? '#ef4444' : '#888'}
                  />
                </TouchableOpacity>

                <TouchableOpacity style={styles.footerAction} onPress={handleShare}>
                  <IconMC name="share-variant-outline" size={wp(5.2)} color="#888" />
                </TouchableOpacity>
              </View>

              <Text style={styles.commentsHeading}>Replies</Text>
            </View>
          }
          renderItem={({ item }) => <CommentRow comment={item} />}
          ListEmptyComponent={
            <View style={styles.noCommentsWrap}>
              <IconMC name="comment-text-outline" size={wp(10)} color="#2a2a2c" />
              <Text style={styles.noComments}>No replies yet</Text>
              <Text style={styles.noCommentsSub}>Be the first to reply below.</Text>
            </View>
          }
        />

        {/* Reply input bar */}
        <View style={styles.composerRow}>
          {profile?.profilePic ? (
            <Image
              source={{ uri: getAbsoluteUrl(profile.profilePic) }}
              style={styles.composerAvatar}
            />
          ) : (
            <View style={[styles.composerAvatarFallback, { backgroundColor: colors.Accent + '15' }]}>
              <Text style={styles.composerAvatarInitials}>{userInitials}</Text>
            </View>
          )}

          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder={`Reply to @${post.author.fullName?.toLowerCase().replace(/\s+/g, '') ?? 'user'}...`}
            placeholderTextColor="rgba(255,255,255,0.3)"
            style={styles.composerInput}
            multiline
          />

          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && styles.sendBtnDisabled]}
            onPress={handleSendComment}
            disabled={sending || !commentText.trim()}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <IconMC name="arrow-up" size={wp(5)} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
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
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    flex: 1,
    fontSize: wp(4.8),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: wp(4), paddingBottom: hp(3) },
  postCard: { marginBottom: hp(1) },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(1.5),
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
    fontSize: wp(3.5),
  },
  userInfoCol: {
    flex: 1,
    marginLeft: wp(3),
  },
  userInfoSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4), marginRight: wp(3) },
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
  moreOptionsBtn: {
    padding: wp(1),
  },
  communityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.5),
    borderRadius: 10,
    maxWidth: wp(35),
  },
  communityBadgeText: {
    color: '#6366f1',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
  },
  postText: {
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4.2),
    marginBottom: hp(1.5),
    lineHeight: wp(6),
  },
  hashtag: {
    color: '#6366f1',
    fontFamily: 'Outfit-Bold',
  },
  mention: {
    color: '#6366f1',
    fontFamily: 'Outfit-Bold',
  },
  mediaContainer: {
    width: '100%',
    maxHeight: hp(40),
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242427',
    marginBottom: hp(1.5),
    backgroundColor: '#050505',
  },
  mediaImage: {
    width: '100%',
    height: hp(32),
  },
  carouselContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242427',
    marginBottom: hp(1.5),
    position: 'relative',
    backgroundColor: '#050505',
  },
  carouselSlide: {
    width: SLIDE_WIDTH,
    height: hp(32),
  },
  carouselImage: {
    width: '100%',
    height: '100%',
  },
  carouselIndicators: {
    position: 'absolute',
    bottom: hp(1.5),
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
  dateStampText: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.1),
    marginBottom: hp(1.5),
  },
  engagementRow: {
    flexDirection: 'row',
    gap: wp(5),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1a1a1a',
    paddingVertical: hp(1.4),
  },
  engagementText: {
    color: '#888',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.3),
  },
  engagementNumber: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
  },
  cardFooter: {
    flexDirection: 'row',
    gap: wp(8),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1a1a1a',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
    paddingVertical: hp(1.4),
    marginBottom: hp(2),
  },
  footerAction: {
    paddingVertical: hp(0.2),
  },
  commentsHeading: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    marginBottom: hp(1),
  },
  noCommentsWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(4),
    gap: hp(0.5),
  },
  noComments: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
    marginTop: hp(1),
  },
  noCommentsSub: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.2),
  },
  commentRow: {
    flexDirection: 'row',
    paddingVertical: hp(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  commentReplyRow: { marginLeft: wp(8) },
  commentAvatarCol: {
    marginRight: wp(3),
  },
  commentAvatar: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: '#222',
  },
  commentAvatarFallback: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentAvatarInitials: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },
  commentBody: { flex: 1 },
  commentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(0.2),
  },
  commentAuthor: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.4) },
  commentUsername: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.9),
    marginLeft: wp(1),
    flexShrink: 1,
  },
  commentDot: { color: '#666', marginHorizontal: wp(1) },
  commentTime: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.9) },
  commentText: {
    color: '#d1d1d1',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    lineHeight: wp(4.8),
    marginTop: hp(0.2),
  },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#000',
  },
  composerAvatar: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: '#222',
  },
  composerAvatarFallback: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    alignItems: 'center',
    justifyContent: 'center',
  },
  composerAvatarInitials: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },
  composerInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    backgroundColor: '#161618',
    borderRadius: 20,
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.9),
    borderWidth: 1,
    borderColor: '#242427',
    maxHeight: hp(10),
  },
  sendBtn: {
    width: wp(8.5),
    height: wp(8.5),
    borderRadius: wp(4.25),
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#1e1b4b',
    opacity: 0.5,
  },
});
