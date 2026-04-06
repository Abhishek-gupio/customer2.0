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
import StatusModal from '../../components/common/Modals/StatusModal';
import FastImage from 'react-native-fast-image';
import Video from 'react-native-video';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { RouteProp, useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { MainTabParamList } from '../../navigation/types';
import { chatService, type SSEChunk, type SuggestedAction } from '../../services/chatService';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { VoiceOwnerContext } from '../../context/VoiceOwnerContext';
import { API_BASE_URL } from '../../config';
import { useProfileStore } from '../../store/profileStore';

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

const VOICE_LOCALES = [
  'kn-IN',
  'te-IN',
  'ta-IN',
  'ml-IN',
  'hi-IN',
  'mr-IN',
  'bn-IN',
  'gu-IN',
  'pa-IN',
  'en-IN',
  'en-US',
  'en',
] as const;

function detectInputLocale(text: string): string {
  if (!text) return 'en-IN';

  const normalized = text.trim().toLowerCase();

  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';

  if (
    /\b(nanna|nimma|namma|nanage|nimage|yaake|yake|enu|yen|hegide|hegiddira|illi|alli|beku|beda|maadi|madi|madi|hogi|banni|baruthe|baralla|kannada)\b/.test(
      normalized,
    )
  ) {
    return 'kn-IN';
  }

  return 'en-IN';
}

function getSpeechLocaleForText(text: string): string {
  return detectInputLocale(text);
}

function getLanguageLabel(locale: string): string {
  if (locale.startsWith('hi')) return 'Hindi';
  if (locale.startsWith('kn')) return 'Kannada';
  if (locale.startsWith('te')) return 'Telugu';
  if (locale.startsWith('ta')) return 'Tamil';
  if (locale.startsWith('ml')) return 'Malayalam';
  if (locale.startsWith('mr')) return 'Marathi';
  if (locale.startsWith('bn')) return 'Bengali';
  if (locale.startsWith('gu')) return 'Gujarati';
  if (locale.startsWith('pa')) return 'Punjabi';
  return 'English';
}

function buildLanguageAwarePrompt(message: string, locale: string): string {
  const trimmed = message.trim();
  if (!trimmed) return trimmed;

  const language = getLanguageLabel(locale);
  const scriptInstruction =
    locale.startsWith('kn')
      ? 'Reply only in Kannada. Do not reply in Hindi. Prefer Kannada script.'
      : locale.startsWith('te')
        ? 'Reply only in Telugu. Do not reply in Hindi. Prefer Telugu script.'
        : locale.startsWith('ta')
          ? 'Reply only in Tamil. Do not reply in Hindi. Prefer Tamil script.'
          : locale.startsWith('ml')
            ? 'Reply only in Malayalam. Do not reply in Hindi. Prefer Malayalam script.'
            : locale.startsWith('hi')
              ? 'Reply only in Hindi. Prefer Devanagari script.'
              : `Reply only in natural ${language}.`;
  return [
    'System instruction: Reply in the same language used by the user.',
    `If the user spoke in ${language}, answer in natural ${language}.`,
    scriptInstruction,
    'Do not translate the reply to English unless the user asks for English.',
    '',
    `User message: ${trimmed}`,
  ].join('\n');
}

function looksLikeProfileUpdateCommand(message: string): boolean {
  const text = message.trim().toLowerCase();
  if (!text) return false;

  return (
    /(change|update|set|edit)\s+(my\s+)?name\s+(to|as)\s+/.test(text) ||
    /\bmy\s+name\s+(is|should\s+be)\s+/.test(text) ||
    /\bcall\s+me\s+/.test(text)
  );
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
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [playingVoiceUrl, setPlayingVoiceUrl] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [ttsReady, setTtsReady] = useState(false);
  const [ttsSpeakingId, setTtsSpeakingId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const flatListRef = useRef<FlatList>(null);
  const { voiceOwner, setVoiceOwner } = React.useContext(VoiceOwnerContext);
  const cachedProfile = useProfileStore((state) => state.profile);
  const loadProfile = useProfileStore((state) => state.loadProfile);

  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });

  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };
  const lastRouteRef = useRef<{ sessionId?: string; userMessage?: string } | null>(null);
  const isLocalSession = sessionId?.startsWith('local-');
  const wantsListeningRef = useRef(false);
  const voiceRetryRef = useRef(0);
  const voiceStartInFlightRef = useRef(false);
  const lastInputLocaleRef = useRef<string>('en-IN');
  const activeVoiceLocaleRef = useRef<string>('en-IN');

  const releaseChatMic = useCallback(() => {
    wantsListeningRef.current = false;
    voiceRetryRef.current = 0;
    voiceStartInFlightRef.current = false;
    setIsListening(false);
    setVoiceOwner(null);
    (Voice as any).cancel?.().catch(() => {});
    (Voice as any).stop?.().catch(() => {});
  }, [setVoiceOwner]);

  const takeChatMicOwnership = useCallback(async () => {
    wantsListeningRef.current = false;
    voiceRetryRef.current = 0;
    voiceStartInFlightRef.current = false;
    setIsListening(false);
    setVoiceOwner('chat');
    await (Voice as any).cancel?.().catch(() => {});
    await (Voice as any).stop?.().catch(() => {});
    if (typeof (Voice as any)?.destroy === 'function') {
      await (Voice as any).destroy().catch(() => {});
    }
  }, [setVoiceOwner]);

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

  const assistantCards = useMemo(
    () => [
      {
        title: 'Expenses',
        subtitle: 'Track spending',
        icon: 'cash-outline',
        prompt: 'Show my monthly expenses',
      },
      {
        title: 'Documents',
        subtitle: 'RC, PUC, insurance',
        icon: 'shield-checkmark-outline',
        prompt: 'Show my document status',
      },
      {
        title: 'Reminders',
        subtitle: 'Service and renewals',
        icon: 'notifications-outline',
        prompt: 'Show upcoming service reminders',
      },
      {
        title: 'Support',
        subtitle: 'Need help',
        icon: 'help-buoy-outline',
        prompt: 'I need help or support',
      },
    ],
    [],
  );

  const canSend = useMemo(
    () => message.trim().length > 0 && !isStreaming,
    [message, isStreaming],
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
    if (cachedProfile) {
      setUserName((cachedProfile.fullName || '').trim());
      return;
    }

    let isMounted = true;
    loadProfile()
      .then((data) => {
        if (!isMounted || !data) return;
        setUserName((data.fullName || '').trim());
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, [cachedProfile, loadProfile]);

  const refreshDisplayedUserName = useCallback(async () => {
    try {
      const data = await loadProfile({ force: true });
      const name = (data?.fullName || '').trim();
      setUserName(name);
    } catch {
      // no-op
    }
  }, [loadProfile]);

  const startVoiceRecognition = async () => {
    if (voiceStartInFlightRef.current) return;
    voiceStartInFlightRef.current = true;
    try {
      try {
        await (Voice as any).cancel?.().catch(() => {});
        if (typeof (Voice as any).destroy === 'function') {
          await (Voice as any).destroy().catch(() => {});
        }
      } catch {}

      const localeIndex = Math.min(voiceRetryRef.current, VOICE_LOCALES.length - 1);
      const fallbackLocales = [
        VOICE_LOCALES[localeIndex],
        ...VOICE_LOCALES.filter((_, index) => index !== localeIndex),
      ];

      let started = false;
      for (const locale of fallbackLocales) {
        try {
          await (Voice as any).start(locale);
          activeVoiceLocaleRef.current = locale;
          started = true;
          break;
        } catch {
          continue;
        }
      }

      if (!started) {
        throw new Error('Voice recognition failed to start.');
      }
    } finally {
      voiceStartInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (!Voice || typeof Voice.start !== 'function') {
      setVoiceAvailable(false);
      return;
    }

    Voice.onSpeechStart = () => {
      voiceRetryRef.current = 0;
      setIsListening(true);
    };
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechResults = (e: { value?: string[] }) => {
      const text = e?.value?.[0]?.trim();
      if (text) {
        const detectedLocale = detectInputLocale(text);
        const activeLocale = activeVoiceLocaleRef.current;
        lastInputLocaleRef.current =
          activeLocale && !activeLocale.startsWith('en')
            ? activeLocale
            : detectedLocale === 'en-IN'
              ? activeLocale
              : detectedLocale;
      }
      if (text) setMessage(text);
      releaseChatMic();
    };
    (Voice as any).onSpeechError = (e: any) => {
      voiceStartInFlightRef.current = false;
      const code = e?.error?.code ?? e?.code;
      const nonFatalCodes = new Set([5, 6, 7, 8, 9, 11]);
      if (nonFatalCodes.has(Number(code)) && wantsListeningRef.current) {
        if (voiceRetryRef.current < VOICE_LOCALES.length - 1) {
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
    };

    return () => {
      releaseChatMic();
      if (typeof (Voice as any)?.destroy === 'function') {
        (Voice as any).destroy().then(() => (Voice as any).removeAllListeners?.()).catch(() => {});
      } else {
        (Voice as any).removeAllListeners?.();
      }
    };
  }, [releaseChatMic, setVoiceOwner]);

  useFocusEffect(
    React.useCallback(() => {
      takeChatMicOwnership().catch(() => {});
      return () => {
        releaseChatMic();
      };
    }, [releaseChatMic, takeChatMicOwnership]),
  );

  useEffect(() => {
    let isMounted = true;
    try {
      Tts.setDefaultRate(0.5);
      Tts.setDefaultPitch(1.05);
    } catch (e) {
      console.warn('TTS defaults error:', e);
    }
    Tts.getInitStatus()
      .then(() => {
        if (!isMounted) return;
        setTtsReady(true);
        Tts.setDefaultLanguage('en-IN').catch(() => {});
        // Tts.setDucking(true); // Temporarily disabling due to iOS bridge error with Objective-C BOOL
      })
      .catch((err) => {
        if (!isMounted) return;
        console.warn('TTS init error:', err);
        setTtsReady(false);
      });

    return () => {
      isMounted = false;
      try { Tts.stop(); } catch (e) {}
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
      showStatus('Mic Unavailable', "Voice input isn't available on this device.", "error");
      return;
    }
    if (voiceOwner && voiceOwner !== 'chat') {
      showStatus('Mic In Use', 'Another feature is using the microphone right now.', "error");
      return;
    }
    const allowed = await ensureMicPermission();
    if (!allowed) {
      showStatus('Mic Permission', 'Please enable microphone permission in settings.', "error");
      return;
    }
    try {
      if (isListening) {
        await (Voice as any).stop?.().catch(() => {});
        releaseChatMic();
      } else {
        if (voiceStartInFlightRef.current) return;
        wantsListeningRef.current = true;
        voiceRetryRef.current = 0;
        setVoiceOwner('chat' as any);
        await startVoiceRecognition();
      }
    } catch {
      releaseChatMic();
      return;
    }
  };

  const loadHistory = async (sid: string) => {
    try {
      setIsHistoryLoading(true);
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
      setIsHistoryLoading(false);
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
    if (isListening || voiceOwner === 'chat') {
      releaseChatMic();
    }
    const messageText = (text || message).trim();
    if (!messageText) return;
    const effectiveLocale =
      text && text !== message
        ? detectInputLocale(messageText)
        : lastInputLocaleRef.current || detectInputLocale(messageText);
    const languageAwareMessage = buildLanguageAwarePrompt(messageText, effectiveLocale);

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
        const response = await chatService.sendMessage(languageAwareMessage, sessionId);
        const profileUpdated = Array.isArray(response.toolResults)
          ? response.toolResults.some((item: any) => item?.kind === 'profile_updated')
          : false;
        const safeResponseMessage =
          looksLikeProfileUpdateCommand(messageText) && !profileUpdated
            ? 'I could not confirm that your name was updated. Please try again with change my name to your new name.'
            : response.message;
        setSessionId(response.sessionId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: safeResponseMessage,
                  isStreaming: false,
                  voiceUrl: response.voiceUrl,
                  toolResults: response.toolResults,
                  agentSteps: response.agentSteps,
                  suggestedActions: (response as any).suggestedActions,
                }
              : m,
          ),
        );
        if (profileUpdated) {
          refreshDisplayedUserName().catch(() => {});
        }
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
        languageAwareMessage,
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
              if (Array.isArray(chunk.toolResults) && chunk.toolResults.some((item: any) => item?.kind === 'profile_updated')) {
                refreshDisplayedUserName().catch(() => {});
              }
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === botMsgId
                    ? {
                        ...m,
                        text:
                          looksLikeProfileUpdateCommand(messageText) &&
                          !(Array.isArray(chunk.toolResults) && chunk.toolResults.some((item: any) => item?.kind === 'profile_updated'))
                            ? 'I could not confirm that your name was updated. Please try again with change my name to your new name.'
                            : m.text,
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
        showStatus('Voice Unavailable', 'Text-to-speech is not ready on this device.', 'error');
        return;
      }
      if (ttsSpeakingId === msgId) {
        Tts.stop();
        setTtsSpeakingId(null);
        return;
      }
      Tts.stop();
      setTtsSpeakingId(msgId);
      const detectedSpeechLocale = getSpeechLocaleForText(text);
      const preferredSpeechLocale =
        detectedSpeechLocale === 'en-IN' && lastInputLocaleRef.current !== 'en-IN'
          ? lastInputLocaleRef.current
          : detectedSpeechLocale;
      Tts.setDefaultLanguage(preferredSpeechLocale).catch(() => {
        Tts.setDefaultLanguage(lastInputLocaleRef.current).catch(() => {});
      });
      Tts.speak(text);
    } else {
      showStatus('No Audio', 'Audio is not available for this message.', 'error');
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
  };

  const onActionChipPress = (action: SuggestedAction) => {
    if (isStreaming) return;
    if (action.label === 'Log expense') {
      setQuickExpenseAmount('');
      setQuickExpenseCategory('FUEL');
      setQuickExpenseVisible(true);
    } else {
      handleSend(action.prompt);
    }
  };

  const submitQuickExpense = () => {
    const amount = quickExpenseAmount.trim().replace(/[^0-9.]/g, '');
    if (!amount || Number.isNaN(Number(amount))) {
      showStatus('Invalid amount', 'Please enter a valid number.', 'error');
      return;
    }
    const prompt = `Add an expense of ₹${amount} for ${quickExpenseCategory}`;
    setQuickExpenseVisible(false);
    setQuickExpenseAmount('');
    handleSend(prompt);
  };

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
              <Text style={[styles.toolBadgeText, styles.toolBadgeTextSuccess]}>
                {item.agentSteps.length} reasoning step{item.agentSteps.length > 1 ? 's' : ''}
              </Text>
            </View>
          )}

          {isBot && !item.isStreaming && item.text.length > 0 && (
            <>
              <View style={styles.actionChipsRow}>
                {actionChips.map((action) => (
                  <Pressable
                    key={action.label}
                    onPress={() => onActionChipPress(action)}
                    style={[styles.actionChip, isStreaming && styles.actionChipDisabled]}
                    hitSlop={6}
                    disabled={isStreaming}
                    accessibilityLabel={action.label}
                    accessibilityHint={`Asks AI: ${action.prompt}`}
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
          <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.headerBtn}>
            <Ionicons name="arrow-back-outline" size={22} color="#9fb3ff" />
          </Pressable>
        <View style={styles.headerCenter}>
          <Ionicons name="sparkles" size={18} color="#9fb3ff" />
          <Text style={styles.headerTitle}>Gupio AI</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => (rootNavigation as any).navigate('ChatSessions')}
            hitSlop={12}
            style={styles.headerBtn}
          >
            <Ionicons name="time-outline" size={22} color="#9fb3ff" />
          </Pressable>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {isHistoryLoading && (
          <View style={styles.historyLoadingBar}>
            <ActivityIndicator size="small" color="#9fb3ff" />
            <Text style={styles.historyLoadingText}>Loading conversation...</Text>
          </View>
        )}
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
            isHistoryLoading ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator color="#9fb3ff" size="large" />
                <Text>Loading conversation...</Text>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                      <FastImage
                        source={require('../../assets/images/index.gif') as any}
                        style={styles.gif}
                        resizeMode="contain"
                      />
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
              </View>
            )
          }
        />
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
        {/* </View> */}
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

      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
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
    fontSize: 19,
    fontWeight: '700',
  },
  historyLoadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#0a1324',
    borderBottomWidth: 1,
    borderBottomColor: '#111b2e',
  },
  historyLoadingText: {
    color: '#9fb3ff',
    fontSize: 12,
  },

  listContent: {
    paddingHorizontal: 12,
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
  toolBadgeTextSuccess: {
    color: '#65d9a5',
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
  },
  heroGreeting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap:5,
    fontSize: 14,
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
    backgroundColor: '#060d1b',
    // backgroundColor: 'rgb(18, 18, 23)',
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
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#464d5f',
    justifyContent:'center',
    marginHorizontal:12,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal:6,
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
    top:-20
  },
});
