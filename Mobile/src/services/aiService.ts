import { api } from "./api";

type ChatResponseData = {
  sessionId: string;
  message: string;
  voiceUrl?: string;
  contextUsed?: number;
  toolResult?: unknown;
};

type ApiEnvelope<T> = {
  success?: boolean;
  data?: T;
};

export const aiService = {
  async sendMessage(message: string, sessionId?: string): Promise<ChatResponseData> {
    const payload = sessionId ? { message, sessionId } : { message };
    const response = await api.post<ApiEnvelope<ChatResponseData>>("/v1/chat", payload);
    const data = response?.data ?? (response as unknown as ChatResponseData);

    if (!data?.message || !data?.sessionId) {
      throw new Error("Invalid AI response");
    }

    return data;
  },
};
