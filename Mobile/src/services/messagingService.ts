import { api } from './api';

export type MessageType = 'TEXT' | 'IMAGE' | 'LOCATION' | 'SYSTEM';
export type MessagePriority = 'NORMAL' | 'URGENT' | 'EMERGENCY';
export type ConversationCategory = 'PARKING' | 'EMERGENCY' | 'DAMAGE' | 'LOST_ITEM' | 'SECURITY' | 'GENERAL';
export type ConversationStatus = 'OPEN' | 'WAITING_FOR_OWNER' | 'WAITING_FOR_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type ConversationRole = 'OWNER' | 'CUSTOMER';

export interface VehicleQrToken {
  id: string;
  vehicleId: string;
  token: string;
  createdAt: string;
  rotatedAt: string;
}

export interface ResolvedVehicle {
  vehicleId: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  color: string | null;
  imageUrl: string | null;
  ownerName?: string;
}

export interface OtherParty {
  id: string;
  name: string | null;
  profilePic: string | null;
  online: boolean;
}

export interface ConversationSummary {
  id: string;
  vehicle: { registrationNumber: string; make: string | null; model: string | null; imageUrl: string | null };
  role: ConversationRole;
  otherParty: OtherParty;
  category: ConversationCategory;
  priority: MessagePriority;
  status: ConversationStatus;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  receiverId: string;
  type: MessageType;
  text: string | null;
  imageUrls: string[];
  latitude: number | null;
  longitude: number | null;
  quickReplyKey: string | null;
  reaction: string | null;
  isRead: boolean;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  vehicle: { registrationNumber: string; make: string | null; model: string | null; imageUrl: string | null };
  role: ConversationRole;
  otherParty: OtherParty;
  category: ConversationCategory;
  priority: MessagePriority;
  status: ConversationStatus;
  messages: ChatMessage[];
}

export interface QuickReply {
  key: string;
  label: string;
  category: string;
}

export type GuestConversationStatus = 'OPEN' | 'RESOLVED' | 'CLOSED';

export interface GuestConversationSummary {
  id: string;
  guestName: string | null;
  guestContact: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  status: GuestConversationStatus;
  updatedAt: string;
  vehicle: { registrationNumber: string; make: string | null; model: string | null; imageUrl: string | null };
}

export interface GuestMessageEntry {
  id: string;
  conversationId: string;
  sender: 'GUEST' | 'OWNER';
  text: string | null;
  imageUrls: string[];
  createdAt: string;
}

export interface GuestConversationDetail extends GuestConversationSummary {
  entries: GuestMessageEntry[];
}

function unwrap<T>(res: { data?: T } | T): T {
  return ((res as any)?.data ?? res) as T;
}

export const qrService = {
  getMyToken: async (vehicleId: string): Promise<VehicleQrToken> => {
    const res = await api.get<{ data?: VehicleQrToken }>(`/v1/messaging/qr/my-token?vehicleId=${vehicleId}`);
    return unwrap(res);
  },
  rotateToken: async (vehicleId: string): Promise<VehicleQrToken> => {
    const res = await api.post<{ data?: VehicleQrToken }>('/v1/messaging/qr/rotate', { vehicleId });
    return unwrap(res);
  },
  resolveToken: async (token: string): Promise<ResolvedVehicle> => {
    const res = await api.get<{ data?: ResolvedVehicle }>(`/v1/messaging/qr/resolve/${encodeURIComponent(token)}`);
    return unwrap(res);
  },
};

export const messagingService = {
  createConversation: async (vehicleId: string, category?: ConversationCategory): Promise<{ id: string }> => {
    const res = await api.post<{ data?: { id: string } }>('/v1/messaging/conversations', { vehicleId, category });
    return unwrap(res);
  },

  listConversations: async (): Promise<ConversationSummary[]> => {
    const res = await api.get<{ data?: ConversationSummary[] }>('/v1/messaging/conversations');
    const data = unwrap<ConversationSummary[]>(res);
    return Array.isArray(data) ? data : [];
  },

  getConversation: async (conversationId: string, cursor?: string): Promise<ConversationDetail> => {
    const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const res = await api.get<{ data?: ConversationDetail }>(`/v1/messaging/conversations/${conversationId}${query}`);
    return unwrap(res);
  },

  updateStatus: async (conversationId: string, status: ConversationStatus): Promise<void> => {
    await api.patch(`/v1/messaging/conversations/${conversationId}/status`, { status });
  },

  sendTextOrLocation: async (
    conversationId: string,
    input: { type: 'TEXT' | 'LOCATION'; text?: string; latitude?: number; longitude?: number; priority?: MessagePriority; quickReplyKey?: string },
  ): Promise<ChatMessage> => {
    const res = await api.post<{ data?: ChatMessage }>(`/v1/messaging/conversations/${conversationId}/messages`, input);
    return unwrap(res);
  },

  sendPhotos: async (
    conversationId: string,
    photos: { uri: string; name: string; type: string }[],
  ): Promise<ChatMessage> => {
    const formData = new FormData();
    formData.append('type', 'IMAGE');
    photos.forEach((photo) => {
      formData.append('photos', { uri: photo.uri, name: photo.name, type: photo.type } as any);
    });
    const res = await api.upload<{ data?: ChatMessage }>(`/v1/messaging/conversations/${conversationId}/messages`, formData);
    return unwrap(res);
  },

  markRead: async (conversationId: string): Promise<void> => {
    await api.post(`/v1/messaging/conversations/${conversationId}/read`);
  },

  markDelivered: async (conversationId: string): Promise<void> => {
    await api.post(`/v1/messaging/conversations/${conversationId}/delivered`);
  },

  addReaction: async (messageId: string, emoji: string): Promise<void> => {
    await api.post(`/v1/messaging/messages/${messageId}/reaction`, { emoji });
  },

  reportConversation: async (conversationId: string, reason: string): Promise<void> => {
    await api.post(`/v1/messaging/conversations/${conversationId}/report`, { reason });
  },

  blockContact: async (customerId: string, reason?: string): Promise<void> => {
    await api.post('/v1/messaging/block', { customerId, reason });
  },

  unblockContact: async (customerId: string): Promise<void> => {
    await api.delete(`/v1/messaging/block/${customerId}`);
  },

  listQuickReplies: async (): Promise<QuickReply[]> => {
    const res = await api.get<{ data?: QuickReply[] }>('/v1/messaging/quick-replies');
    const data = unwrap<QuickReply[]>(res);
    return Array.isArray(data) ? data : [];
  },

  // ── Guest conversations (owner replying to a web-fallback message) ──

  listGuestConversations: async (): Promise<GuestConversationSummary[]> => {
    const res = await api.get<{ data?: GuestConversationSummary[] }>('/v1/messaging/guest-conversations');
    const data = unwrap<GuestConversationSummary[]>(res);
    return Array.isArray(data) ? data : [];
  },

  getGuestConversation: async (id: string): Promise<GuestConversationDetail> => {
    const res = await api.get<{ data?: GuestConversationDetail }>(`/v1/messaging/guest-conversations/${id}`);
    return unwrap(res);
  },

  replyToGuestConversation: async (id: string, text: string): Promise<GuestMessageEntry> => {
    const res = await api.post<{ data?: GuestMessageEntry }>(`/v1/messaging/guest-conversations/${id}/reply`, { text });
    return unwrap(res);
  },

  updateGuestConversationStatus: async (id: string, status: GuestConversationStatus): Promise<void> => {
    await api.patch(`/v1/messaging/guest-conversations/${id}/status`, { status });
  },
};
