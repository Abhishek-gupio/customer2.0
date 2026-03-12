import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RouteProp, useNavigation } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/types';
import { chatService, type SSEChunk } from '../../services/chatService';

type ChatRouteProp = RouteProp<RootStackParamList, 'Chat'>;

type Props = {
  route: ChatRouteProp;
};

interface UIMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  isStreaming?: boolean;
  voiceUrl?: string | null;
  toolResults?: any[];
  agentSteps?: any[];
  feedback?: 1 | -1 | null;
  hadImage?: boolean;
  timestamp: Date;
}

export default function ChatScreen({ route }: Props) {
  const { userMessage, sessionId: initialSessionId } = route.params;
  const navigation = useNavigation();

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const canSend = useMemo(() => message.trim().length > 0 && !isLoading && !isStreaming, [message, isLoading, isStreaming]);

  // Load existing session or send initial message
  useEffect(() => {
    if (initialSessionId) {
      loadHistory(initialSessionId);
    } else if (userMessage) {
      handleSend(userMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadHistory = async (sid: string) => {
    try {
      setIsLoading(true);
      const history = await chatService.getHistory(sid);
      const uiMessages: UIMessage[] = history.messages.map((m) => ({
        id: m.id,
        text: m.content,
        sender: m.role === 'user' ? 'user' : 'bot',
        voiceUrl: m.metadata?.voiceUrl,
        toolResults: m.metadata?.toolResults,
        agentSteps: m.metadata?.agentSteps,
        hadImage: m.metadata?.hadImage,
        timestamp: new Date(m.createdAt),
      }));
      setMessages(uiMessages);
      setSessionId(sid);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = (text || message).trim();
    if (!messageText) return;

    const userMsg: UIMessage = {
      id: `user-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!text) setMessage('');
    scrollToBottom();

    // Create a streaming bot message placeholder
    const botMsgId = `bot-${Date.now()}`;
    const botMsg: UIMessage = {
      id: botMsgId,
      text: '',
      sender: 'bot',
      isStreaming: true,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, botMsg]);
    setIsStreaming(true);
    scrollToBottom();

    try {
      await chatService.sendMessageStream(
        messageText,
        sessionId,
        (chunk: SSEChunk) => {
          switch (chunk.type) {
            case 'session':
              if (chunk.sessionId) setSessionId(chunk.sessionId);
              break;

            case 'chunk':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: m.text + (chunk.text || '') }
                    : m,
                ),
              );
              scrollToBottom();
              break;

            case 'tool_start':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: m.text + `\n🔧 Running ${chunk.tool}...` }
                    : m,
                ),
              );
              break;

            case 'tool_result':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                      ...m,
                      text: m.text + `\n✅ ${chunk.message || 'Done'}`,
                      toolResults: [...(m.toolResults || []), chunk.result],
                    }
                    : m,
                ),
              );
              scrollToBottom();
              break;

            case 'tool_error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: m.text + `\n❌ ${chunk.error}` }
                    : m,
                ),
              );
              break;

            case 'done':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                      ...m,
                      isStreaming: false,
                      voiceUrl: chunk.voiceUrl,
                      toolResults: chunk.toolResults || m.toolResults,
                    }
                    : m,
                ),
              );
              setIsStreaming(false);
              break;

            case 'error':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? { ...m, text: 'Sorry, something went wrong.', isStreaming: false }
                    : m,
                ),
              );
              setIsStreaming(false);
              break;
          }
        },
      );
    } catch (error) {
      console.error('Stream error:', error);
      // Fallback: try non-streaming
      try {
        const response = await chatService.sendMessage(messageText, sessionId);
        setSessionId(response.sessionId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                ...m,
                text: response.message,
                isStreaming: false,
                voiceUrl: response.voiceUrl,
                toolResults: response.toolResults,
                agentSteps: response.agentSteps,
              }
              : m,
          ),
        );
      } catch (fallbackError) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? { ...m, text: 'Failed to get response. Please try again.', isStreaming: false }
              : m,
          ),
        );
      }
      setIsStreaming(false);
    }
  };

  const handleVoicePlay = (voiceUrl: string) => {
    // Open the voice URL — the OS will handle playback
    Linking.openURL(voiceUrl).catch(() => { });
  };

  const handleFeedback = async (msgId: string, score: 1 | -1) => {
    if (!sessionId) return;
    try {
      await chatService.submitFeedback(sessionId, score);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: score } : m)),
      );
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.sender === 'user';
    const isBot = item.sender === 'bot';

    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowRight]}>
        {/* Bot avatar */}
        {isBot && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={16} color="#9fb3ff" />
          </View>
        )}

        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>
            {item.text}
            {item.isStreaming && '▊'}
          </Text>

          {/* Tool results badge */}
          {item.toolResults && item.toolResults.length > 0 && (
            <View style={styles.toolBadge}>
              <Ionicons name="construct-outline" size={12} color="#9fb3ff" />
              <Text style={styles.toolBadgeText}>
                {item.toolResults.length} action{item.toolResults.length > 1 ? 's' : ''} performed
              </Text>
            </View>
          )}

          {/* Agent steps */}
          {item.agentSteps && item.agentSteps.length > 0 && (
            <View style={styles.toolBadge}>
              <Ionicons name="git-branch-outline" size={12} color="#65d9a5" />
              <Text style={[styles.toolBadgeText, { color: '#65d9a5' }]}>
                {item.agentSteps.length} reasoning step{item.agentSteps.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {/* Bot message actions */}
          {isBot && !item.isStreaming && item.text.length > 0 && (
            <View style={styles.actionRow}>
              {/* Voice */}
              {item.voiceUrl && (
                <Pressable
                  onPress={() => handleVoicePlay(item.voiceUrl!)}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <Ionicons name="volume-medium-outline" size={16} color="#7a8599" />
                </Pressable>
              )}

              {/* Feedback */}
              <Pressable
                onPress={() => handleFeedback(item.id, 1)}
                style={styles.actionBtn}
                hitSlop={8}
              >
                <Ionicons
                  name={item.feedback === 1 ? 'thumbs-up' : 'thumbs-up-outline'}
                  size={14}
                  color={item.feedback === 1 ? '#65d9a5' : '#7a8599'}
                />
              </Pressable>
              <Pressable
                onPress={() => handleFeedback(item.id, -1)}
                style={styles.actionBtn}
                hitSlop={8}
              >
                <Ionicons
                  name={item.feedback === -1 ? 'thumbs-down' : 'thumbs-down-outline'}
                  size={14}
                  color={item.feedback === -1 ? '#ff6b6b' : '#7a8599'}
                />
              </Pressable>
            </View>
          )}

          {/* Timestamp */}
          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={18} color="#9fb3ff" />
          <Text style={styles.headerTitle}>Gupio AI</Text>
        </View>
        <Pressable
          onPress={() => (navigation as any).navigate('ChatSessions')}
          hitSlop={12}
        >
          <Ionicons name="chatbubbles-outline" size={22} color="#7a8599" />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={renderMessage}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#9fb3ff" size="large" />
                <Text style={styles.emptyText}>Loading conversation...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <Ionicons name="sparkles" size={48} color="#1c2640" />
                <Text style={styles.emptyTitle}>Gupio AI Assistant</Text>
                <Text style={styles.emptyText}>
                  Ask me anything about your vehicles, expenses, documents, or just chat!
                </Text>
              </View>
            )
          }
        />

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <View style={styles.inputContainer}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ask anything..."
              placeholderTextColor="#7a8599"
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => handleSend()}
              editable={!isStreaming}
              multiline
              maxLength={2000}
            />
            <Pressable
              onPress={() => handleSend()}
              hitSlop={8}
              disabled={!canSend}
              style={[styles.sendBtn, canSend && styles.sendBtnActive]}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#9fb3ff" />
              ) : (
                <Ionicons
                  name="send"
                  size={18}
                  color={canSend ? '#fff' : '#5d6780'}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// =============================================================================
// Styles
// =============================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050b17',
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#111b2e',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  // Messages List
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    flexGrow: 1,
  },
  messageBubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 4,
    maxWidth: '85%',
  },
  messageBubbleRowRight: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#111b2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
    maxWidth: '100%',
  },
  userBubble: {
    backgroundColor: '#1a3a6a',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#0d1a30',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#1c2640',
  },
  messageText: {
    color: '#d4dce8',
    fontSize: 15,
    lineHeight: 22,
  },
  userText: {
    color: '#e8edf5',
  },
  timestamp: {
    color: '#4a5568',
    fontSize: 11,
    marginTop: 6,
    alignSelf: 'flex-end',
  },

  // Tool badge
  toolBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(159,179,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  toolBadgeText: {
    color: '#9fb3ff',
    fontSize: 12,
  },

  // Actions (voice, feedback)
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  actionBtn: {
    padding: 4,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    color: '#7a8599',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    color: '#4a5568',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  // Input
  inputBar: {
    paddingHorizontal: 12,
    paddingBottom: 8,
    paddingTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#0d1a30',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1c2640',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    paddingVertical: 4,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnActive: {
    backgroundColor: '#3b6dd4',
  },
});
