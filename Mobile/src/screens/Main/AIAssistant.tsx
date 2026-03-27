import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  PermissionsAndroid,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import type { MainTabParamList, RootStackParamList } from '../../navigation/types';
import { chatService, type SSEChunk, type SuggestedAction } from '../../services/chatService';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { VoiceOwnerContext } from '../../context/VoiceOwnerContext';
import { API_BASE_URL } from '../../config';
import { getProfile } from '../../services/profileService';

type AssistantRouteProp = RouteProp<MainTabParamList, 'AIAssistant'>;

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
  suggestedActions?: SuggestedAction[];
  timestamp: Date;
}

export default function AIAssistant() {
  const navigation = useNavigation();
  const rootNavigation = (navigation as any).getParent?.() ?? navigation;
  const route = useRoute<AssistantRouteProp>();
  const initialMessage = route.params?.userMessage ?? '';
  const initialSessionId = route.params?.sessionId;

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(initialSessionId);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [playingVoiceUrl, setPlayingVoiceUrl] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [ttsReady, setTtsReady] = useState(false);
  const [ttsSpeakingId, setTtsSpeakingId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { voiceOwner, setVoiceOwner } = React.useContext(VoiceOwnerContext);
  const lastRouteRef = useRef<{ sessionId?: string; userMessage?: string } | null>(null);
  const isLocalSession = sessionId?.startsWith('local-');
  const wantsListeningRef = useRef(false);
  const voiceRetryRef = useRef(0);

  const [quickExpenseVisible, setQuickExpenseVisible] = useState(false);
  const [quickExpenseAmount, setQuickExpenseAmount] = useState('');
  const [quickExpenseCategory, setQuickExpenseCategory] = useState<string>('FUEL');

  const DEFAULT_ACTIONS: SuggestedAction[] = useMemo(
    () => [
      { label: 'Log expense', prompt: 'Add an expense for my vehicle' },
      { label: 'Set reminder', prompt: 'Set a reminder for my vehicle' },
      { label: 'Documents', prompt: 'Show my document status' },
      { label: 'Support', prompt: 'I need help or support' },
    ],
    [],
  );

  const EXPENSE_CATEGORIES = useMemo(
    () => [
      { id: 'FUEL', label: 'Fuel' },
      { id: 'TOLL', label: 'Toll' },
      { id: 'SERVICE', label: 'Service' },
      { id: 'PARKING', label: 'Parking' },
      { id: 'INSURANCE', label: 'Insurance' },
      { id: 'CHALLAN', label: 'Challan' },
      { id: 'OTHER', label: 'Other' },
    ],
    [],
  );

  const orderActionsByRelevance = useCallback(
    (actions: SuggestedAction[], botText: string): SuggestedAction[] => {
      if (!botText || botText.length < 10) return actions;
      const lower = botText.toLowerCase();
      const score: Record<string, number> = {};
      actions.forEach((a) => {
        score[a.label] = 0;
        if (/expense|fuel|spend|cost|toll|rupee|₹/i.test(lower) && a.label === 'Log expense') score[a.label] += 2;
        if (/document|insurance|rc|puc|expir|renew/i.test(lower) && a.label === 'Documents') score[a.label] += 2;
        if (/remind|service|due|schedule|maintenance/i.test(lower) && a.label === 'Set reminder') score[a.label] += 2;
        if (/help|support|issue|problem|contact/i.test(lower) && a.label === 'Support') score[a.label] += 2;
      });
      return [...actions].sort((a, b) => (score[b.label] ?? 0) - (score[a.label] ?? 0));
    },
    [],
  );

  const quickPrompts = useMemo(
    () => [
      'What’s in my garage?',
      'Add an expense for fuel',
      'Show upcoming service reminders',
      'How can I upload insurance docs?',
      'Summarize this month’s vehicle costs',
    ],
    [],
  );
  const assistantCards = useMemo(
    () => [
      {
        title: 'Vehicle Health',
        subtitle: 'Check my car',
        icon: 'car-sport-outline',
        prompt: 'Check vehicle health',
      },
      {
        title: 'Insurance Status',
        subtitle: 'Policy details',
        icon: 'shield-checkmark-outline',
        prompt: 'Show my insurance status',
      },
      {
        title: 'Monthly Expenses',
        subtitle: 'Spending report',
        icon: 'cash-outline',
        prompt: 'Show monthly expenses',
      },
      {
        title: 'Schedule Service',
        subtitle: 'Book service',
        icon: 'construct-outline',
        prompt: 'Schedule a service for my vehicle',
      },
    ],
    [],
  );

  const canSend = useMemo(
    () => message.trim().length > 0 && !isLoading && !isStreaming,
    [message, isLoading, isStreaming],
  );

  useEffect(() => {
    const trimmedMessage = initialMessage.trim();
    const snapshot = {
      sessionId: initialSessionId,
      userMessage: trimmedMessage,
    };
    const last = lastRouteRef.current;
    if (last && last.sessionId === snapshot.sessionId && last.userMessage === snapshot.userMessage) {
      return;
    }
    lastRouteRef.current = snapshot;

    if (snapshot.sessionId) {
      loadHistory(snapshot.sessionId);
    } else if (snapshot.userMessage) {
      handleSend(snapshot.userMessage);
    } else if (last) {
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSessionId, initialMessage]);

  useEffect(() => {
    let isMounted = true;
    getProfile()
      .then((data) => {
        if (!isMounted) return;
        const name = (data.fullName || '').trim();
        setUserName(name);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  const startVoiceRecognition = async () => {
    try {
      await Voice.start('en-IN');
    } catch {
      try {
        await Voice.start('en-US');
      } catch {
        await Voice.start('en');
      }
    }
  };

  useEffect(() => {
    if (!Voice || typeof Voice.start !== 'function') {
      setVoiceAvailable(false);
      return;
    }

    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = (e: { value?: string[] }) => {
      const text = e?.value?.[0]?.trim();
      if (text) setMessage(text);
    };
    (Voice as any).onSpeechError = (e: any) => {
      const code = e?.error?.code ?? e?.code;
      const message = e?.error?.message || e?.message || 'Voice recognition failed.';
      const nonFatalCodes = new Set([5, 6, 7, 8, 9, 11]);
      if (nonFatalCodes.has(Number(code)) && wantsListeningRef.current) {
        if (voiceRetryRef.current < 2) {
          voiceRetryRef.current += 1;
          setTimeout(() => {
            if (!wantsListeningRef.current) return;
            startVoiceRecognition().catch(() => {});
          }, 350);
        }
        return;
      }
      setIsListening(false);
      setVoiceOwner(null);
      wantsListeningRef.current = false;
      Alert.alert('Voice Error', code ? `${message} (code ${code})` : message);
    };

    return () => {
      Voice.stop?.().catch(() => {});
      if (typeof Voice?.destroy === 'function') {
        Voice.destroy().then(() => Voice.removeAllListeners?.()).catch(() => {});
      } else {
        Voice.removeAllListeners?.();
      }
      setVoiceOwner(null);
    };
  }, [setVoiceOwner]);

  useEffect(() => {
    let isMounted = true;
    Tts.setDucking(true);
    Tts.setDefaultRate(0.5, true);
    Tts.setDefaultPitch(1.05);
    Tts.getInitStatus()
      .then(() => {
        if (!isMounted) return;
        setTtsReady(true);
        Tts.setDefaultLanguage('en-US').catch(() => {});
      })
      .catch(() => {
        if (!isMounted) return;
        setTtsReady(false);
      });

    return () => {
      isMounted = false;
      Tts.stop();
    };
  }, []);

  useEffect(() => {
    const onFinish = () => setTtsSpeakingId(null);
    const onCancel = () => setTtsSpeakingId(null);
    const onError = () => setTtsSpeakingId(null);
    const finishSub = Tts.addEventListener('tts-finish', onFinish);
    const cancelSub = Tts.addEventListener('tts-cancel', onCancel);
    const errorSub = Tts.addEventListener('tts-error', onError);

    return () => {
      (finishSub as any)?.remove?.();
      (cancelSub as any)?.remove?.();
      (errorSub as any)?.remove?.();
    };
  }, []);

  const ensureMicPermission = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const toggleListening = async () => {
    if (!voiceAvailable) {
      Alert.alert('Mic Unavailable', "Voice input isn't available on this device.");
      return;
    }
    if (voiceOwner && voiceOwner !== 'chat') {
      Alert.alert('Mic In Use', 'Another feature is using the microphone right now.');
      return;
    }
    const allowed = await ensureMicPermission();
    if (!allowed) {
      Alert.alert('Mic Permission', 'Please enable microphone permission in settings.');
      return;
    }
    try {
      if (isListening) {
        wantsListeningRef.current = false;
        voiceRetryRef.current = 0;
        await Voice.stop();
        setIsListening(false);
        setVoiceOwner(null);
      } else {
        wantsListeningRef.current = true;
        voiceRetryRef.current = 0;
        setVoiceOwner('chat' as any);
        await startVoiceRecognition();
      }
    } catch (e: any) {
      setIsListening(false);
      setVoiceOwner(null);
      wantsListeningRef.current = false;
      voiceRetryRef.current = 0;
      const code = e?.error?.code ?? e?.code;
      const message = e?.error?.message || e?.message || 'Unable to start microphone.';
      Alert.alert('Voice Error', code ? `${message} (code ${code})` : message);
    }
  };

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

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  const getLocalBotReply = (prompt: string) => {
    const text = prompt.toLowerCase();
    const has = (k: string) => text.includes(k);
    const any = (list: string[]) => list.some((k) => text.includes(k));

    if (any(['engine light', 'check engine', 'mil'])) {
      return (
        'If the check-engine light is on, it’s best to scan for a code. You can visit a service ' +
        'center or use an OBD scanner. If the light is flashing, stop driving and get help.'
      );
    }
    if (any(['tire', 'tyre', 'pressure', 'tpms'])) {
      return (
        'For most cars, the safe cold tire pressure is listed on the driver-door sticker. ' +
        'If you share the vehicle model, I can suggest the exact range.'
      );
    }
    if (any(['oil', 'engine oil', 'oil change'])) {
      return (
        'Typical oil-change intervals are 5,000–10,000 km depending on oil type and usage. ' +
        'Share your vehicle model and last service date for a better estimate.'
      );
    }
    if (any(['battery', 'jump start', 'jumpstart', 'dead battery'])) {
      return (
        'For a weak battery, check for corrosion on terminals and try a jump start. If it dies ' +
        'again quickly, the battery or alternator may need testing.'
      );
    }
    if (any(['brake', 'brakes', 'squeal', 'squeaking'])) {
      return (
        'Brake squeal can be normal, but grinding or vibration usually means pads or rotors need ' +
        'inspection. I can help schedule a service reminder.'
      );
    }
    if (any(['ac', 'air conditioning', 'cooling'])) {
      return (
        'If AC isn’t cooling, it could be low refrigerant, a leak, or a compressor issue. ' +
        'I can help you log the issue and find a service slot.'
      );
    }
    if (any(['mileage', 'fuel economy', 'average', 'kmpl', 'mpg'])) {
      return (
        'Fuel economy depends on driving style, load, and maintenance. If you share your vehicle ' +
        'model and recent mileage, I can help estimate and track it.'
      );
    }
    if (any(['insurance', 'renewal', 'expiry', 'registration', 'rc'])) {
      return (
        'I can track insurance and registration expiry dates. Add your documents in Vehicle > ' +
        'Documents, and I’ll remind you before they expire.'
      );
    }
    if (text.includes('expense') || text.includes('fuel') || text.includes('gas')) {
      return (
        'Got it. To add a fuel expense, open Expenses > Add, choose the vehicle, enter amount, ' +
        'odometer, and station, then save. Want me to prepare a draft entry?'
      );
    }
    if (text.includes('service') || text.includes('maintenance')) {
      return (
        'I can help with service reminders. Tell me the vehicle and preferred interval (e.g. ' +
        'every 6 months or 5,000 km), and I’ll set a reminder template.'
      );
    }
    if (text.includes('insurance') || text.includes('document') || text.includes('docs')) {
      return (
        'To upload documents, go to Vehicle > Documents > Add, choose the file, and set expiry ' +
        'date. I can also remind you before expiration.'
      );
    }
    if (text.includes('summary') || text.includes('cost') || text.includes('spend')) {
      return (
        'Here’s a quick summary template: fuel, tolls, service, and insurance. If you connect your ' +
        'data, I can generate a full breakdown with charts.'
      );
    }
    if (text.includes('hello') || text.includes('hi')) {
      return 'Hello! I can help with vehicle expenses, reminders, and documents. What would you like to do?';
    }
    return (
      'I’m ready to help. You can ask about expenses, service reminders, documents, or just chat. ' +
      'Try: “My check-engine light is on” or “What tire pressure should I use?”'
    );
  };

  const streamLocalReply = async (botMsgId: string, fullText: string) => {
    const parts = fullText.split(' ');
    for (let i = 0; i < parts.length; i += 1) {
      await sleep(18);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? { ...m, text: m.text + (m.text.length ? ' ' : '') + parts[i] }
            : m,
        ),
      );
      scrollToBottom();
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === botMsgId ? { ...m, isStreaming: false } : m)),
    );
    setIsStreaming(false);
  };

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

    let fallbackAttempted = false;
    const runFallback = async () => {
      if (fallbackAttempted) return;
      fallbackAttempted = true;
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
                  suggestedActions: (response as any).suggestedActions,
                }
              : m,
          ),
        );
      } catch {
        if (!sessionId) setSessionId(`local-${Date.now()}`);
        await streamLocalReply(botMsgId, getLocalBotReply(messageText));
      }
      setIsStreaming(false);
    };

    try {
      const isPlaceholderApi = API_BASE_URL.includes('your-api.com');
      if (isPlaceholderApi) {
        if (!sessionId) setSessionId(`local-${Date.now()}`);
        await streamLocalReply(botMsgId, getLocalBotReply(messageText));
        return;
      }

      await chatService.sendMessageStream(
        messageText,
        sessionId,
        async (chunk: SSEChunk) => {
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
                    ? { ...m, text: m.text + `\nRunning ${chunk.tool || 'tool'}...` }
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
                        text: m.text + `\nDone: ${chunk.message || 'Success'}`,
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
                    ? { ...m, text: m.text + `\nError: ${chunk.error || 'Failed'}` }
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
                        suggestedActions: chunk.suggestedActions,
                      }
                    : m,
                ),
              );
              setIsStreaming(false);
              break;

            case 'error':
              runFallback().catch(() => {});
              break;
          }
        },
      );
    } catch (error) {
      console.error('Stream error:', error);
      await runFallback();
    }
  };

  const handleVoicePlay = (
    voiceUrl: string | null | undefined,
    text: string | undefined,
    msgId: string,
  ) => {
    if (voiceUrl) {
      if (playingVoiceUrl === voiceUrl) {
        setPlayingVoiceUrl(null);
        return;
      }
      setPlayingVoiceUrl(voiceUrl);
      return;
    }
    if (text && text.trim().length > 0) {
      if (!ttsReady) {
        Alert.alert('Voice Unavailable', 'Text-to-speech is not ready on this device.');
        return;
      }
      if (ttsSpeakingId === msgId) {
        Tts.stop();
        setTtsSpeakingId(null);
        return;
      }
      Tts.stop();
      setTtsSpeakingId(msgId);
      Tts.speak(text);
    } else {
      Alert.alert('No Audio', 'Audio is not available for this message.');
    }
  };

  const handleFeedback = async (msgId: string, score: 1 | -1) => {
    if (!sessionId || isLocalSession) {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: score } : m)),
      );
      return;
    }
    try {
      await chatService.submitFeedback(sessionId, score);
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, feedback: score } : m)),
      );
    } catch (error) {
      console.error('Feedback error:', error);
    }
  };

  const handleNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setMessage('');
    setIsStreaming(false);
  };

  const actionChipIcon: Record<string, string> = {
    'Log expense': 'add-circle-outline',
    'Set reminder': 'notifications-outline',
    Documents: 'document-text-outline',
    Support: 'help-buoy-outline',
    'Open challans': 'receipt-outline',
    'My Garage': 'car-outline',
    'Driving summary': 'speedometer-outline',
    'Service history': 'construct-outline',
    'Warranty & parts': 'shield-checkmark-outline',
    Expenses: 'wallet-outline',
  };

  const onActionChipPress = useCallback(
    (action: SuggestedAction) => {
      if (isLoading || isStreaming) return;
      if (action.navigate?.screen) {
        const { screen, params } = action.navigate;
        rootNavigation.navigate(screen as keyof RootStackParamList, params as never);
        return;
      }
      if (action.label === 'Log expense') {
        setQuickExpenseAmount('');
        setQuickExpenseCategory('FUEL');
        setQuickExpenseVisible(true);
      } else if (action.prompt?.trim()) {
        handleSend(action.prompt);
      }
    },
    [isLoading, isStreaming, rootNavigation],
  );

  const submitQuickExpense = useCallback(() => {
    const amount = quickExpenseAmount.trim().replace(/[^0-9.]/g, '');
    if (!amount || Number.isNaN(Number(amount))) {
      Alert.alert('Invalid amount', 'Please enter a valid number.');
      return;
    }
    const prompt = `Add an expense of ₹${amount} for ${quickExpenseCategory}`;
    setQuickExpenseVisible(false);
    setQuickExpenseAmount('');
    handleSend(prompt);
  }, [quickExpenseAmount, quickExpenseCategory]);

  const renderMessage = ({ item }: { item: UIMessage }) => {
    const isUser = item.sender === 'user';
    const isBot = item.sender === 'bot';
    const actionChips =
      (item.suggestedActions && item.suggestedActions.length > 0)
        ? item.suggestedActions
        : orderActionsByRelevance(DEFAULT_ACTIONS, item.text);

    return (
      <View style={[styles.messageBubbleRow, isUser && styles.messageBubbleRowRight]}>
        {isBot && (
          <View style={styles.avatar}>
            <Ionicons name="sparkles" size={16} color="#9fb3ff" />
          </View>
        )}

        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.botBubble]}>
          <Text style={[styles.messageText, isUser && styles.userText]}>
            {item.text}
            {item.isStreaming ? ' ...' : ''}
          </Text>

          {item.toolResults && item.toolResults.length > 0 && (
            <View style={styles.toolBadge}>
              <Ionicons name="construct-outline" size={12} color="#9fb3ff" />
              <Text style={styles.toolBadgeText}>
                {item.toolResults.length} action{item.toolResults.length > 1 ? 's' : ''} performed
              </Text>
            </View>
          )}

          {item.agentSteps && item.agentSteps.length > 0 && (
            <View style={styles.toolBadge}>
              <Ionicons name="git-branch-outline" size={12} color="#65d9a5" />
              <Text style={[styles.toolBadgeText, { color: '#65d9a5' }]}>
                {item.agentSteps.length} reasoning step{item.agentSteps.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {isBot && !item.isStreaming && item.text.length > 0 && (
            <>
              <View style={styles.actionRow}>
                {actionChips && actionChips.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => onActionChipPress(action)}
                    style={[styles.actionChip, (isLoading || isStreaming) && styles.actionChipDisabled]}
                    hitSlop={6}
                    disabled={isLoading || isStreaming}
                    accessibilityLabel={action.label}
                    accessibilityHint={
                      action.navigate
                        ? `Opens ${action.navigate.screen}`
                        : `Asks AI: ${action.prompt || action.label}`
                    }
                  >
                    <Ionicons
                      name={(actionChipIcon[action.label] || 'ellipse-outline') as any}
                      size={14}
                      color="#9fb3ff"
                    />
                    <Text style={styles.actionChipText}>{action.label}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionRow}>
                <Pressable
                  onPress={() => handleVoicePlay(item.voiceUrl, item.text, item.id)}
                  style={styles.actionBtn}
                  hitSlop={8}
                >
                  <Ionicons
                    name={
                      (item.voiceUrl && playingVoiceUrl === item.voiceUrl) ||
                      (!item.voiceUrl && ttsSpeakingId === item.id)
                        ? 'volume-mute-outline'
                        : 'volume-medium-outline'
                    }
                    size={16}
                    color="#7a8599"
                  />
                </Pressable>

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
            </>
          )}

          <Text style={styles.timestamp}>
            {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color="#9fb3ff" />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Gupio AI</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable onPress={handleNewChat} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="add" size={20} color="#9fb3ff" />
          </Pressable>
          <Pressable
            onPress={() => (rootNavigation as any).navigate('ChatSessions')}
            hitSlop={12}
            style={styles.headerBtn}
          >
            <Ionicons name="chatbubbles-outline" size={22} color="#7a8599" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          renderItem={renderMessage}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#9fb3ff" size="large" />
                <Text>Loading conversation...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                      <FastImage
                        source={require('../../assets/images/giphy.gif') as any}
                        style={styles.gif}
                        resizeMode={FastImage.resizeMode.contain}
                      />
                {/* <View style={styles.heroOrb}>
                  <View style={styles.heroRingOuter}>
                    <View style={styles.heroRingInner}>
                      <View style={styles.heroCore} />
                    </View>
                  </View>
                </View> */}
                <Text style={styles.heroGreeting}>
                  {userName ? `Hello ${userName} !` : 'Hello there'}
                </Text>
                <Text style={styles.heroTitle}>How can I help{'\n'}you today?</Text>
                <View style={styles.cardGrid}>
                  {assistantCards.map((card) => (
                    <Pressable
                      key={card.title}
                      onPress={() => handleSend(card.prompt)}
                      style={styles.card}
                    >
                      <View style={styles.cardIconWrap}>
                        <Ionicons name={card.icon as any} size={20} color="#a8b7ff" />
                      </View>
                      <Text style={styles.cardTitle}>{card.title}</Text>
                      <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.promptRow}>
                  {quickPrompts.map((prompt) => (
                    <Pressable
                      key={prompt}
                      onPress={() => handleSend(prompt)}
                      style={styles.promptChip}
                    >
                      <Text style={styles.promptChipText}>{prompt}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )
          }
        />

        <View style={styles.inputBar}>
          <View style={styles.inputTopRow}>
            <Text style={styles.inputHint}>
              {isListening ? 'Listening… speak now' : 'Type or use voice to chat'}
            </Text>
            <View style={[styles.voicePill, isListening && styles.voicePillActive]}>
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={12}
                color={isListening ? '#061018' : '#9fb3ff'}
              />
              <Text style={[styles.voicePillText, isListening && styles.voicePillTextActive]}>
                {isListening ? 'Voice On' : 'Voice'}
              </Text>
            </View>
          </View>
          <View style={styles.inputContainer}>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Ask anything..."
              placeholderTextColor="#7a8599"
              style={styles.input}
              returnKeyType="send"
              onSubmitEditing={() => {
                if (canSend) handleSend();
              }}
              editable
              multiline
              maxLength={2000}
              blurOnSubmit={false}
            />
            <Pressable
              onPress={toggleListening}
              hitSlop={8}
              style={[styles.micBtn, isListening && styles.micBtnActive]}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={18}
                color={isListening ? '#061018' : '#9fb3ff'}
              />
            </Pressable>
            <Pressable
              onPress={() => handleSend()}
              hitSlop={8}
              disabled={!canSend}
              style={[styles.sendBtn, canSend && styles.sendBtnActive]}
            >
              {isStreaming ? (
                <ActivityIndicator size="small" color="#9fb3ff" />
              ) : (
                <Ionicons name="send" size={18} color={canSend ? '#fff' : '#5d6780'} />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={quickExpenseVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickExpenseVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setQuickExpenseVisible(false)}
        >
          <Pressable style={styles.quickExpenseCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.quickExpenseTitle}>Quick add expense</Text>
            <TextInput
              value={quickExpenseAmount}
              onChangeText={setQuickExpenseAmount}
              placeholder="Amount (e.g. 500)"
              placeholderTextColor="#7a8599"
              keyboardType="decimal-pad"
              style={styles.quickExpenseInput}
            />
            <Text style={styles.quickExpenseLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
              {EXPENSE_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat.id}
                  onPress={() => setQuickExpenseCategory(cat.id)}
                  style={[
                    styles.categoryChip,
                    quickExpenseCategory === cat.id && styles.categoryChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.categoryChipText,
                      quickExpenseCategory === cat.id && styles.categoryChipTextActive,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.quickExpenseActions}>
              <Pressable onPress={() => setQuickExpenseVisible(false)} style={styles.quickExpenseBtn}>
                <Text style={styles.quickExpenseBtnTextSecondary}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitQuickExpense} style={[styles.quickExpenseBtn, styles.quickExpenseBtnPrimary]}>
                <Text style={styles.quickExpenseBtnText}>Add expense</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {playingVoiceUrl ? (
        <Video
          source={{ uri: playingVoiceUrl }}
          style={styles.hiddenVideo}
          paused={false}
          muted={false}
          repeat={false}
          onEnd={() => setPlayingVoiceUrl(null)}
          onError={() => setPlayingVoiceUrl(null)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#101010',
    // paddingBottom: 45,
    paddingTop: 24,
  },
  flex: { flex: 1 },
  hiddenVideo: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 9,
    paddingTop:5,
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#111b2e',
  },
  headerCenter: {
    left:22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },

  listContent: {
    paddingHorizontal: 12,
    // paddingTop: 12,
    // paddingBottom: 15,
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

  actionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(159, 179, 255, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(159, 179, 255, 0.25)',
  },
  actionChipText: {
    color: '#9fb3ff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionChipDisabled: {
    opacity: 0.5,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  quickExpenseCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0d1a30',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1c2640',
  },
  quickExpenseTitle: {
    color: '#e8edf5',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  quickExpenseInput: {
    backgroundColor: '#111b2e',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1c2640',
  },
  quickExpenseLabel: {
    color: '#7a8599',
    fontSize: 12,
    marginBottom: 8,
  },
  categoryScroll: {
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#111b2e',
    borderWidth: 1,
    borderColor: '#1c2640',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: 'rgba(159, 179, 255, 0.2)',
    borderColor: '#9fb3ff',
  },
  categoryChipText: {
    color: '#9fb3ff',
    fontSize: 13,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#e8edf5',
  },
  quickExpenseActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  quickExpenseBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  quickExpenseBtnPrimary: {
    backgroundColor: '#3b6dd4',
  },
  quickExpenseBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  quickExpenseBtnTextSecondary: {
    color: '#7a8599',
    fontSize: 15,
  },

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

  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: -6,
    // paddingHorizontal: 24,
  },
  heroOrb: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  heroRingOuter: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#151b2a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  heroRingInner: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: '#1a2336',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#23304d',
  },
  heroCore: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#7b879f',
    opacity: 0.9,
  },
  heroGreeting: {
    color: '#6f7b93',
    fontSize: 14,
    // marginTop: 1,
  },
  heroTitle: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 34,
  },
  cardGrid: {
    marginTop: 26,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    width: '100%',
  },
  card: {
    width: '48%',
    backgroundColor: '#0e1628',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#999',
    shadowColor: '#c0bbbb',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#121b2d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#e8edf5',
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: '#6f7b93',
    fontSize: 12,
    marginTop: 4,
  },
  promptRow: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  promptChip: {
    borderWidth: 1,
    borderColor: '#1c2640',
    backgroundColor: '#0b1629',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  promptChipText: {
    color: '#9fb3ff',
    fontSize: 12,
  },

  inputBar: {
    paddingHorizontal: 12,
    // paddingBottom: 8,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#464d5f',
    backgroundColor: '#050b17',
  },
  inputTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  inputHint: {
    color: '#4a5568',
    fontSize: 12,
  },
  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#464d5f',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#0b1629',
  },
  voicePillActive: {
    backgroundColor: '#9fb3ff',
    borderColor: '#9fb3ff',
  },
  voicePillText: {
    color: '#9fb3ff',
    fontSize: 11,
    fontWeight: '600',
  },
  voicePillTextActive: {
    color: '#061018',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0d1a30',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#464d5f',
    // paddingBottom:25,
    justifyContent:'center',
    // alignItems: 'center',
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    // maxHeight: 10,
    // minHeight: 36,
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
  micBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(159, 179, 255, 0.12)',
    marginRight: 8,
  },
  micBtnActive: {
    backgroundColor: '#9fb3ff',
  },
    gif: {
    width: 200,
    height: 200,
  },
});
