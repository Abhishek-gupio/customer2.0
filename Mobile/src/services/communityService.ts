import { api } from './api';

export type CommunityType = 'TOPIC' | 'LOCAL';
export type LocalCommunityKind = 'CITY' | 'DISTRICT' | 'COLLEGE' | 'COMPANY' | 'APARTMENT' | 'HIGHWAY' | 'PARKING_AREA';
export type PostType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'POLL' | 'QUESTION' | 'LOCATION';
export type FeedType = 'following' | 'trending' | 'latest';
export type ReactionEmoji = '👍' | '❤️' | '😂' | '😮' | '😢' | '🔥';

export interface CommunityAuthor {
  id: string;
  fullName: string | null;
  profilePic: string | null;
}

export interface Community {
  id: string;
  slug: string;
  name: string;
  type: CommunityType;
  localKind: LocalCommunityKind | null;
  description: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  memberCount: number;
  postCount: number;
  isOfficial: boolean;
  isMember: boolean;
  role?: 'MEMBER' | 'MODERATOR' | 'ADMIN' | null;
}

export interface CommunityPost {
  id: string;
  authorId: string;
  communityId: string | null;
  vehicleId: string | null;
  type: PostType;
  text: string | null;
  mediaUrls: string[];
  latitude: number | null;
  longitude: number | null;
  pollOptions: { id: string; label: string; voteCount: number }[] | null;
  commentCount: number;
  reactionCount: number;
  shareCount: number;
  createdAt: string;
  author: CommunityAuthor;
  community?: { id: string; name: string; slug: string } | null;
}

export interface CommunityComment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  text: string | null;
  imageUrl: string | null;
  isAcceptedAnswer: boolean;
  reactionCount: number;
  createdAt: string;
  author: CommunityAuthor;
}

function unwrap<T>(res: { data?: T } | T): T {
  return (res as any)?.data !== undefined ? (res as any).data : (res as T);
}

export const communityService = {
  createCommunity: async (input: { name: string; type: CommunityType; localKind?: LocalCommunityKind; description?: string }): Promise<Community> => {
    const res = await api.post<{ data?: Community }>('/v1/community', input);
    return unwrap(res);
  },

  discover: async (params?: { type?: CommunityType; q?: string; limit?: number }): Promise<Community[]> => {
    const sp = new URLSearchParams();
    if (params?.type) sp.set('type', params.type);
    if (params?.q) sp.set('q', params.q);
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    const res = await api.get<{ data?: Community[] }>(`/v1/community/discover${q ? `?${q}` : ''}`);
    return unwrap(res);
  },

  getCommunity: async (id: string): Promise<Community> => {
    const res = await api.get<{ data?: Community }>(`/v1/community/${id}`);
    return unwrap(res);
  },

  join: async (id: string): Promise<void> => {
    await api.post(`/v1/community/${id}/join`);
  },

  leave: async (id: string): Promise<void> => {
    await api.post(`/v1/community/${id}/leave`);
  },

  getFeed: async (params?: { feedType?: FeedType; communityId?: string; cursor?: string; limit?: number }): Promise<CommunityPost[]> => {
    const sp = new URLSearchParams();
    if (params?.feedType) sp.set('feedType', params.feedType);
    if (params?.communityId) sp.set('communityId', params.communityId);
    if (params?.cursor) sp.set('cursor', params.cursor);
    if (params?.limit) sp.set('limit', String(params.limit));
    const q = sp.toString();
    const res = await api.get<{ data?: CommunityPost[] }>(`/v1/community/feed/list${q ? `?${q}` : ''}`);
    return unwrap(res);
  },

  createTextPost: async (input: { communityId?: string; type?: PostType; text?: string; pollOptions?: string[] }): Promise<CommunityPost> => {
    const res = await api.post<{ data?: CommunityPost }>('/v1/community/posts', input);
    return unwrap(res);
  },

  createMediaPost: async (
    input: { communityId?: string; type: 'IMAGE' | 'VIDEO'; text?: string },
    media: { uri: string; name: string; type: string }[],
  ): Promise<CommunityPost> => {
    const formData = new FormData();
    formData.append('type', input.type);
    if (input.communityId) formData.append('communityId', input.communityId);
    if (input.text) formData.append('text', input.text);
    media.forEach((file) => {
      formData.append('media', { uri: file.uri, name: file.name, type: file.type } as any);
    });
    const res = await api.upload<{ data?: CommunityPost }>('/v1/community/posts', formData);
    return unwrap(res);
  },

  getPost: async (id: string): Promise<CommunityPost> => {
    const res = await api.get<{ data?: CommunityPost }>(`/v1/community/posts/${id}`);
    return unwrap(res);
  },

  deletePost: async (id: string): Promise<void> => {
    await api.delete(`/v1/community/posts/${id}`);
  },

  search: async (q: string): Promise<{ posts: CommunityPost[]; communities: Community[] }> => {
    const res = await api.get<{ data?: { posts: CommunityPost[]; communities: Community[] } }>(
      `/v1/community/search?q=${encodeURIComponent(q)}`,
    );
    return unwrap(res);
  },

  listComments: async (postId: string): Promise<CommunityComment[]> => {
    const res = await api.get<{ data?: CommunityComment[] }>(`/v1/community/posts/${postId}/comments`);
    return unwrap(res);
  },

  createComment: async (postId: string, input: { text?: string; imageUrl?: string; parentId?: string }): Promise<CommunityComment> => {
    const res = await api.post<{ data?: CommunityComment }>(`/v1/community/posts/${postId}/comments`, input);
    return unwrap(res);
  },

  reactToPost: async (postId: string, emoji: ReactionEmoji): Promise<void> => {
    await api.post(`/v1/community/posts/${postId}/reactions`, { emoji });
  },

  reactToComment: async (commentId: string, emoji: ReactionEmoji): Promise<void> => {
    await api.post(`/v1/community/comments/${commentId}/reactions`, { emoji });
  },

  follow: async (customerId: string): Promise<void> => {
    await api.post(`/v1/community/follow/${customerId}`);
  },

  unfollow: async (customerId: string): Promise<void> => {
    await api.delete(`/v1/community/follow/${customerId}`);
  },

  report: async (targetType: 'POST' | 'COMMENT', targetId: string, reason: string): Promise<void> => {
    await api.post('/v1/community/report', { targetType, targetId, reason });
  },
};
