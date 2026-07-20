import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { formatDistanceToNowStrict } from 'date-fns';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import {
  communityService,
  type CommunityPost,
  type CommunityComment,
} from '../../services/communityService';
import { useCommunityStore } from '../../store/communityStore';

function CommentRow({ comment }: { comment: CommunityComment }) {
  return (
    <View style={[styles.commentRow, comment.parentId && styles.commentReplyRow]}>
      <View style={styles.commentAvatar}>
        <IconMC name="account" size={wp(4.2)} color="#FFBF00" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.commentAuthor}>{comment.author.fullName ?? 'Vehicle owner'}</Text>
        {!!comment.text && <Text style={styles.commentText}>{comment.text}</Text>}
        <Text style={styles.commentTime}>{formatDistanceToNowStrict(new Date(comment.createdAt))} ago</Text>
      </View>
    </View>
  );
}

export default function PostDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const postId: string = route.params?.postId;
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([communityService.getPost(postId), communityService.listComments(postId)])
      .then(([p, c]) => {
        setPost(p);
        setComments(c);
      })
      .finally(() => setLoading(false));
  }, [postId]);

  useEffect(load, [load]);

  const handleReact = async () => {
    if (!post) return;
    setPost({ ...post, reactionCount: post.reactionCount + 1 });
    try {
      await communityService.reactToPost(post.id, '👍');
      bumpVersion();
    } catch {
      load();
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
    } finally {
      setSending(false);
    }
  };

  if (loading || !post) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Post</Text>
        </View>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={hp(2)}
    >
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Post</Text>
        </View>

        <FlatList
          data={comments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.postCard}>
              <View style={styles.cardHeader}>
                <View style={styles.avatar}>
                  <IconMC name="account" size={wp(5)} color="#FFBF00" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.authorName}>{post.author.fullName ?? 'Vehicle owner'}</Text>
                  <Text style={styles.metaLine}>
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
                <TouchableOpacity style={styles.footerAction} onPress={handleReact}>
                  <IconMC name="thumb-up-outline" size={wp(4.2)} color="#888" />
                  <Text style={styles.footerText}>{post.reactionCount}</Text>
                </TouchableOpacity>
                <View style={styles.footerAction}>
                  <IconMC name="comment-outline" size={wp(4.2)} color="#888" />
                  <Text style={styles.footerText}>{post.commentCount}</Text>
                </View>
              </View>
              <Text style={styles.commentsHeading}>Comments</Text>
            </View>
          }
          renderItem={({ item }) => <CommentRow comment={item} />}
          ListEmptyComponent={
            <Text style={styles.noComments}>No comments yet — be the first to reply.</Text>
          }
        />

        <View style={styles.composerRow}>
          <TextInput
            value={commentText}
            onChangeText={setCommentText}
            placeholder="Write a comment…"
            placeholderTextColor="rgba(255,255,255,0.35)"
            style={styles.composerInput}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendComment} disabled={sending || !commentText.trim()}>
            {sending ? <ActivityIndicator size="small" color="#111" /> : <IconMC name="send" size={wp(4.5)} color="#111" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { flex: 1, fontSize: wp(4.8), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(3) },
  postCard: { marginBottom: hp(1) },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: hp(1.2) },
  avatar: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  authorName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8) },
  metaLine: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.9) },
  postText: { color: '#ddd', fontFamily: 'Outfit-Regular', fontSize: wp(3.8), marginBottom: hp(1.2), lineHeight: wp(5.2) },
  media: { width: '100%', height: hp(28), borderRadius: 14, marginBottom: hp(1.2) },
  cardFooter: {
    flexDirection: 'row',
    gap: wp(6),
    borderTopWidth: 1,
    borderTopColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#1e1e1e',
    paddingVertical: hp(1.2),
    marginBottom: hp(1.5),
  },
  footerAction: { flexDirection: 'row', alignItems: 'center', gap: wp(1.5) },
  footerText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.2) },
  commentsHeading: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.6), marginBottom: hp(0.5) },
  noComments: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), paddingVertical: hp(2), textAlign: 'center' },
  commentRow: { flexDirection: 'row', paddingVertical: hp(1) },
  commentReplyRow: { marginLeft: wp(8) },
  commentAvatar: {
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(2.5),
  },
  commentAuthor: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.3) },
  commentText: { color: '#ccc', fontFamily: 'Outfit-Regular', fontSize: wp(3.4), marginTop: hp(0.2) },
  commentTime: { color: '#555', fontFamily: 'Outfit-Regular', fontSize: wp(2.7), marginTop: hp(0.3) },
  composerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.2),
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  composerInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.1),
  },
  sendBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
