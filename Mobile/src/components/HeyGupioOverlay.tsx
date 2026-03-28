import React, { useRef, useState, useEffect, useCallback, useContext } from 'react';
import {
  Animated,
  View,
  Text,
  Image,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
  AppState,
  AppStateStatus,
  TouchableOpacity,
  PanResponder,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { useNavigation } from '@react-navigation/native';
import { chatService } from '../services/chatService';
import { VoiceOwnerContext } from '../context/VoiceOwnerContext';

const VOICE_LOCALES = [
  'en-IN',
  'hi-IN',
  'kn-IN',
  'te-IN',
  'ta-IN',
  'ml-IN',
  'mr-IN',
  'bn-IN',
  'gu-IN',
  'pa-IN',
  'en-US',
  'en',
] as const;
const MAX_VOICE_LOCALE_RETRIES = Math.min(VOICE_LOCALES.length - 1, 5);
const LISTEN_TIMEOUT_MS = 12000;
const LISTENING_STUCK_TIMEOUT_MS = 5000;
const SPEECH_END_GRACE_MS = 1200;
const RESTART_DELAY_MS = Platform.OS === 'android' ? 1200 : 600;
const FAB_SIZE = 56;
const FAB_MARGIN = 20;
const FAB_BOTTOM_OFFSET = 88;
const MIN_TOP_OFFSET = 72;
const AI_GIF_SOURCE = require('../../assets/ai.gif');
const MIC_GIF_SOURCE = require('../../assets/mic.gif');
const BRAIN_GIF_SOURCE = require('../../assets/brain.gif');
const SPEAKER_GIF_SOURCE = require('../../assets/speaker.gif');

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isWakeWord(transcript: string): boolean {
  const t = normalize(transcript);
  if (!t) return false;
  if (t === 'hey gupio' || t === 'gupio') return true;
  if (t.startsWith('hey gupio ') || t.startsWith('gupio ')) return true;
  if (t.includes('hey gupio') || t.includes('gupio')) return true;
  return false;
}

function extractCommand(transcript: string): string {
  const t = normalize(transcript);
  const afterHeyGupio = t.split('hey gupio').pop()?.trim() ?? '';
  const afterGupio = t.split('gupio').pop()?.trim() ?? '';
  if (afterHeyGupio.length > 0 && afterHeyGupio.length < t.length) return afterHeyGupio;
  if (afterGupio.length > 0 && afterGupio.length < t.length) return afterGupio;
  return '';
}

function isEndCommand(transcript: string): boolean {
  const t = normalize(transcript);
  return t === 'end' || t === 'stop listening' || t === 'end session';
}

function looksLikeExpenseCommand(transcript: string): boolean {
  const t = normalize(transcript);
  if (!t) return false;

  const hasExpenseCategory = /\b(fuel|petrol|diesel|cng|service|maintenance|toll|parking|insurance|challan|fine|other)\b/.test(t);
  const hasAmount = /(?:rs\.?|rupees?|inr|₹)?\s*\d+(?:\.\d+)?/i.test(t);
  const hasCreateVerb = /\b(add|log|create|save|spent|pay|paid|refuel|refueled|service|serviced)\b/.test(t);

  return hasExpenseCategory && hasAmount && hasCreateVerb;
}

function buildOverlayPrompt(transcript: string): string {
  const trimmed = transcript.trim();
  if (!trimmed) return trimmed;
  const allowsVehicleIdentity = asksForVehicleIdentity(trimmed);

  return [
    'System instruction: This response will be spoken aloud in the floating voice overlay.',
    'Respond in plain natural speech only.',
    'Reply in the same language used by the user when possible.',
    'Answer only the exact question asked.',
    'Keep the reply short and direct.',
    'Do not answer a different question just because one keyword overlaps.',
    'If the request is unclear, ask one short clarifying question.',
    'If you do not know the answer, say that briefly instead of guessing.',
    'Do not use markdown, code formatting, symbols, underscores, bullets, JSON, or labels like "User request".',
    'Use any available vehicle or profile context silently in the background.',
    'Do not announce that you are using the primary vehicle, selected vehicle, stored profile, or saved details unless the user explicitly asks.',
    allowsVehicleIdentity
      ? 'The user is explicitly asking for vehicle identity details, so you may mention the vehicle name, make, model, or registration only as needed for the direct answer.'
      : 'Do not mention the vehicle name, make, model, registration number, or owner unless the user explicitly asks for those details or they are absolutely required to avoid ambiguity.',
    'Do not add extra summary, background, lists, or suggestions unless the user explicitly asks for them.',
    'If an action was completed, confirm it briefly in one sentence.',
    '',
    `User request: ${trimmed}`,
  ].join('\n');
}

function getSpeechLocaleForText(text: string): string {
  if (!text) return 'en-IN';

  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';

  return 'en-IN';
}

function detectInputLocale(text: string): string {
  if (!text) return 'en-IN';

  if (/[\u0C80-\u0CFF]/.test(text)) return 'kn-IN';
  if (/[\u0C00-\u0C7F]/.test(text)) return 'te-IN';
  if (/[\u0B80-\u0BFF]/.test(text)) return 'ta-IN';
  if (/[\u0D00-\u0D7F]/.test(text)) return 'ml-IN';
  if (/[\u0980-\u09FF]/.test(text)) return 'bn-IN';
  if (/[\u0A80-\u0AFF]/.test(text)) return 'gu-IN';
  if (/[\u0A00-\u0A7F]/.test(text)) return 'pa-IN';
  if (/[\u0900-\u097F]/.test(text)) return 'hi-IN';

  return 'en-IN';
}

function asksForVehicleIdentity(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  return /(vehicle name|car name|bike name|which vehicle|what vehicle|vehicle model|model name|what model|vehicle make|make name|brand name|what make|registration number|reg number|number plate)/.test(
    t,
  );
}

function sanitizeSpeechText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[_*#~>|[\]{}]/g, ' ')
    .replace(/\b[a-zA-Z0-9_-]+\.(ts|tsx|js|jsx|json|md)\b/g, ' ')
    .replace(/\b(user request|system instruction|prompt)\s*:/gi, ' ')
    .replace(/\b(the user asked|user asked|you asked|the question is)\b[:\s-]*/gi, ' ')
    .replace(/\b(i will reply|i would reply|my reply is|response is)\b[:\s-]*/gi, ' ')
    .replace(/\bthe answer is\b[:\s-]*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function removeVehicleIdentityFromSpeech(
  text: string,
  vehicle?: {
    make?: string;
    model?: string;
    registrationNumber?: string;
  } | null,
): string {
  if (!text) return text;

  let next = text;
  const phrases = [
    vehicle?.registrationNumber?.trim(),
    [vehicle?.make, vehicle?.model].filter(Boolean).join(' ').trim(),
    vehicle?.make?.trim(),
    vehicle?.model?.trim(),
  ].filter((value): value is string => !!value && value.length > 1);

  for (const phrase of phrases) {
    const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
    next = next.replace(pattern, 'it');
  }

  return next
    .replace(/\bit's\b/gi, 'its')
    .replace(/\bit\s+vehicle\b/gi, 'the vehicle')
    .replace(/\s+/g, ' ')
    .trim();
}

export default function HeyGupioOverlay() {
  const window = Dimensions.get('window');
  const navigation = useNavigation<any>();
  const { heyGupioCanListen } = useContext(VoiceOwnerContext);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const statusRef = useRef<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const modeRef = useRef<'wake' | 'command'>('wake');
  const listenCycleIdRef = useRef(0);
  const hasRecognitionResultRef = useRef(false);
  const isProcessingRef = useRef(false);
  const sessionIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const ttsFinishRef = useRef<(() => void) | null>(null);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listeningStuckTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechEndGraceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousModeRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const startListeningRef = useRef<() => void>(() => {});
  const stopContinuousRef = useRef<() => void>(() => {});
  const canListenRef = useRef(heyGupioCanListen);
  const voiceLocaleIndexRef = useRef(0);
  const preferredVoiceLocaleIndexRef = useRef(0);
  const voiceLocaleRetryRef = useRef(0);
  const lastInputLocaleRef = useRef<string>('en-IN');
  const setOverlayStatus = useCallback((next: 'idle' | 'listening' | 'speaking' | 'processing') => {
    isProcessingRef.current = next === 'processing';
    statusRef.current = next;
    setStatus(next);
  }, []);
  const clampPosition = useCallback(
    (x: number, y: number) => {
      const maxX = Math.max(FAB_MARGIN, window.width - FAB_SIZE - FAB_MARGIN);
      const maxY = Math.max(MIN_TOP_OFFSET, window.height - FAB_SIZE - FAB_BOTTOM_OFFSET);
      return {
        x: Math.min(Math.max(x, FAB_MARGIN), maxX),
        y: Math.min(Math.max(y, MIN_TOP_OFFSET), maxY),
      };
    },
    [window.height, window.width],
  );
  const dragPosition = useRef(
    new Animated.ValueXY(
      clampPosition(window.width - FAB_SIZE - FAB_MARGIN, window.height - FAB_SIZE - FAB_BOTTOM_OFFSET),
    ),
  ).current;
  const dragValueRef = useRef(
    clampPosition(window.width - FAB_SIZE - FAB_MARGIN, window.height - FAB_SIZE - FAB_BOTTOM_OFFSET),
  );
  canListenRef.current = heyGupioCanListen;

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const listenerId = dragPosition.addListener((value) => {
      dragValueRef.current = value;
    });
    return () => {
      dragPosition.removeListener(listenerId);
    };
  }, [dragPosition]);

  useEffect(() => {
    const next = clampPosition(dragValueRef.current.x, dragValueRef.current.y);
    dragPosition.setValue(next);
  }, [clampPosition, dragPosition]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
      onPanResponderGrant: () => {
        dragPosition.stopAnimation();
        dragPosition.setOffset(dragValueRef.current);
        dragPosition.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: dragPosition.x, dy: dragPosition.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        dragPosition.flattenOffset();
        const next = clampPosition(
          dragValueRef.current.x + gestureState.dx,
          dragValueRef.current.y + gestureState.dy,
        );
        dragPosition.setValue(next);
      },
      onPanResponderTerminate: () => {
        dragPosition.flattenOffset();
        dragPosition.setValue(clampPosition(dragValueRef.current.x, dragValueRef.current.y));
      },
    }),
  ).current;

  const requestMicPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Microphone',
          message: 'Gupio listens for "Hey Gupio" so you can talk without opening the app. Allow microphone access.',
          buttonPositive: 'OK',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const ttsFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearListeningTimers = useCallback(() => {
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    if (listeningStuckTimeoutRef.current) {
      clearTimeout(listeningStuckTimeoutRef.current);
      listeningStuckTimeoutRef.current = null;
    }
    if (speechEndGraceTimeoutRef.current) {
      clearTimeout(speechEndGraceTimeoutRef.current);
      speechEndGraceTimeoutRef.current = null;
    }
  }, []);

  const forceIdle = useCallback((stopContinuousMode = false) => {
    listenCycleIdRef.current += 1;
    clearListeningTimers();
    if (stopContinuousMode) {
      continuousModeRef.current = false;
    }
    Voice.stop().catch(() => {});
    Tts.stop();
    if (isMountedRef.current) {
      setOverlayStatus('idle');
    }
  }, [clearListeningTimers, setOverlayStatus]);

  const speakWithTts = useCallback((text: string, onDone?: () => void, preferredLocale?: string) => {
    if (ttsFallbackRef.current) {
      clearTimeout(ttsFallbackRef.current);
      ttsFallbackRef.current = null;
    }
    ttsFinishRef.current = onDone ?? null;
    const speechLocale = preferredLocale || getSpeechLocaleForText(text);
    Tts.getInitStatus()
      .then(() => {
        Promise.resolve((Tts as any).setDefaultLanguage?.(speechLocale))
          .catch(() => Promise.resolve((Tts as any).setDefaultLanguage?.('en-IN')).catch(() => {}));
        Tts.setDefaultRate(0.48);
        Tts.setDefaultPitch(1.0);
        Tts.speak(text);
        const delay = Math.min(Math.max(text.length * 90, 3000), 25000);
        ttsFallbackRef.current = setTimeout(() => {
          ttsFallbackRef.current = null;
          if (ttsFinishRef.current) {
            ttsFinishRef.current();
            ttsFinishRef.current = null;
          }
        }, delay);
      })
      .catch((err: any) => {
        if (err?.code === 'no_engine') Tts.requestInstallEngine();
        if (onDone) onDone();
      });
  }, []);

  const scheduleRestartListening = useCallback(() => {
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    listenCycleIdRef.current += 1;
    restartDelayRef.current = setTimeout(() => {
      restartDelayRef.current = null;
      if (!isMountedRef.current || !continuousModeRef.current || !canListenRef.current) return;
      setOverlayStatus('idle');
      Tts.stop();
      const doStart = () => {
        if (!isMountedRef.current || !continuousModeRef.current) return;
        startListeningRef.current();
      };
      if (typeof (Voice as any).destroy === 'function') {
        (Voice as any).destroy().catch(() => {}).then(doStart);
      } else {
        doStart();
      }
    }, RESTART_DELAY_MS);
  }, []);

  const startListening = useCallback(() => {
    if (!isMountedRef.current) return;
    listenCycleIdRef.current += 1;
    const cycleId = listenCycleIdRef.current;
    const localeIndex =
      (preferredVoiceLocaleIndexRef.current + voiceLocaleRetryRef.current) % VOICE_LOCALES.length;
    const recognitionLocale = VOICE_LOCALES[localeIndex] ?? 'en-IN';
    hasRecognitionResultRef.current = false;
    modeRef.current = 'command';
    const clearListenTimeout = () => {
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
        listenTimeoutRef.current = null;
      }
    };
    const clearListeningStuckTimeout = () => {
      if (listeningStuckTimeoutRef.current) {
        clearTimeout(listeningStuckTimeoutRef.current);
        listeningStuckTimeoutRef.current = null;
      }
    };
    const clearSpeechEndGraceTimeout = () => {
      if (speechEndGraceTimeoutRef.current) {
        clearTimeout(speechEndGraceTimeoutRef.current);
        speechEndGraceTimeoutRef.current = null;
      }
    };
    const scheduleListeningRecovery = () => {
      clearListeningStuckTimeout();
      listeningStuckTimeoutRef.current = setTimeout(() => {
        listeningStuckTimeoutRef.current = null;
        if (!isMountedRef.current || cycleId !== listenCycleIdRef.current || statusRef.current !== 'listening') {
          return;
        }
        restartWithNextLocale();
      }, LISTENING_STUCK_TIMEOUT_MS);
    };
    const restartWithNextLocale = () => {
      clearListenTimeout();
      clearListeningStuckTimeout();
      clearSpeechEndGraceTimeout();
      if (!isMountedRef.current || cycleId !== listenCycleIdRef.current) return;
      if (voiceLocaleRetryRef.current >= MAX_VOICE_LOCALE_RETRIES) {
        voiceLocaleRetryRef.current = 0;
        forceIdle(true);
        return;
      }
      voiceLocaleRetryRef.current += 1;
      listenCycleIdRef.current += 1;
      Promise.resolve()
        .then(() => Voice.stop().catch(() => {}))
        .then(() =>
          typeof (Voice as any).destroy === 'function'
            ? (Voice as any).destroy().catch(() => {})
            : Promise.resolve(),
        )
        .finally(() => {
          if (!isMountedRef.current || !continuousModeRef.current) return;
          startListeningRef.current();
        });
    };

    const lastPartialRef = { current: '' };
    const parseTranscript = (e: any): string => {
      const raw = e?.value ?? e?.results?.[0] ?? e?.result ?? [];
      const first = Array.isArray(raw) ? raw[0] : raw;
      return (typeof first === 'string' ? first : first?.transcript ?? '').trim();
    };

    const onResult = async (e: any) => {
      if (!isMountedRef.current || cycleId !== listenCycleIdRef.current) return;
      clearListenTimeout();
      clearListeningStuckTimeout();
      clearSpeechEndGraceTimeout();
      hasRecognitionResultRef.current = true;
      preferredVoiceLocaleIndexRef.current = localeIndex;
      voiceLocaleRetryRef.current = 0;
      let transcript = parseTranscript(e);
      if (!transcript && lastPartialRef.current) transcript = lastPartialRef.current;
      lastPartialRef.current = '';
      lastInputLocaleRef.current = detectInputLocale(transcript);
      if (__DEV__ && transcript) console.log('[HeyGupio] Heard:', transcript);
      if (!transcript) {
        restartWithNextLocale();
        return;
      }
      if (isEndCommand(transcript)) {
        stopContinuousRef.current();
        return;
      }
      listenCycleIdRef.current += 1;
      setOverlayStatus('processing');
      clearListeningTimers();
      try {
        await Voice.stop();
      } catch (_) {}

      modeRef.current = 'wake';
      try {
        const overlayPrompt = buildOverlayPrompt(transcript);
        const primaryVehicle = await chatService.getPrimaryVehicleSpeechContext().catch(() => null);
        const data = await chatService.sendMessage(overlayPrompt, sessionIdRef.current, {
          agentMode: true,
        });
        if (data.sessionId) {
          sessionIdRef.current = data.sessionId;
        }
        const sosResult = Array.isArray(data.toolResults)
          ? data.toolResults.find((item: any) => item?.kind === 'sos')
          : null;
        const expenseCreatedResult = Array.isArray(data.toolResults)
          ? data.toolResults.find((item: any) => item?.kind === 'expense_created')
          : null;
        if (sosResult?.sosAlertId) {
          const rootNavigation = navigation.getParent?.() ?? navigation;
          rootNavigation.navigate('ActiveSOS', {
            sosId: sosResult.sosAlertId,
            type: sosResult.type,
            lat: sosResult.latitude,
            lon: sosResult.longitude,
          });
        }
        await chatService.refreshUserContext().catch(() => null);
        const reply =
          (
            asksForVehicleIdentity(transcript)
              ? sanitizeSpeechText(data.message || 'Done.')
              : removeVehicleIdentityFromSpeech(
                  sanitizeSpeechText(data.message || 'Done.'),
                  primaryVehicle,
                )
          ) || 'Done.';
        const safeReply =
          looksLikeExpenseCommand(transcript) && !expenseCreatedResult
            ? 'I could not confirm that the expense was saved. Please try again with the amount and category, for example add fuel 500.'
            : reply;
        setOverlayStatus('speaking');
        speakWithTts(safeReply, () => {
          ttsFinishRef.current = null;
          continuousModeRef.current = false;
          setOverlayStatus('idle');
        }, lastInputLocaleRef.current);
      } catch (err: any) {
        setOverlayStatus('speaking');
        const msg = err?.message || 'Something went wrong. Please try again.';
        speakWithTts(msg, () => {
          ttsFinishRef.current = null;
          continuousModeRef.current = false;
          setOverlayStatus('idle');
        }, lastInputLocaleRef.current);
      }
    };

    const onError = async (err: any) => {
      clearListenTimeout();
      clearListeningStuckTimeout();
      clearSpeechEndGraceTimeout();
      if (cycleId !== listenCycleIdRef.current) return;
      if (isProcessingRef.current) return;
      const msg = String(err?.error?.message ?? err?.message ?? err).toLowerCase();
      const isExpectedAfterResult =
        hasRecognitionResultRef.current ||
        statusRef.current === 'processing' ||
        statusRef.current === 'speaking';
      if (
        isExpectedAfterResult &&
        (msg.includes('cancel') || msg.includes('stopped') || msg.includes('recognitionservice busy'))
      ) {
        return;
      }
      try {
        await Voice.stop();
      } catch (_) {}
      if (msg.includes('cancel') || msg.includes('no match') || msg.includes('no speech')) {
        restartWithNextLocale();
        return;
      }
      forceIdle(true);
    };

    const attachHandlers = () => {
      try {
        Voice.removeAllListeners?.();
      } catch (_) {}
      (Voice as any).onSpeechResults = onResult;
      (Voice as any).onSpeechError = onError;
      (Voice as any).onSpeechStart = () => {
        if (cycleId !== listenCycleIdRef.current) return;
        hasRecognitionResultRef.current = false;
        if (isMountedRef.current) {
          setOverlayStatus('listening');
          scheduleListeningRecovery();
        }
      };
      (Voice as any).onSpeechEnd = () => {
        clearListenTimeout();
        clearListeningStuckTimeout();
        if (!isMountedRef.current || cycleId !== listenCycleIdRef.current) return;
        if (isProcessingRef.current) return;
        if (hasRecognitionResultRef.current || statusRef.current === 'processing') return;
        if (statusRef.current !== 'listening') return;
        clearSpeechEndGraceTimeout();
        speechEndGraceTimeoutRef.current = setTimeout(() => {
          speechEndGraceTimeoutRef.current = null;
          if (!isMountedRef.current || cycleId !== listenCycleIdRef.current) return;
          if (isProcessingRef.current) return;
          if (hasRecognitionResultRef.current || statusRef.current === 'processing') return;
          if (statusRef.current !== 'listening') return;
          restartWithNextLocale();
        }, SPEECH_END_GRACE_MS);
      };
      (Voice as any).onSpeechPartialResults = (e: any) => {
        if (cycleId !== listenCycleIdRef.current) return;
        const t = parseTranscript(e);
        if (t) {
          lastPartialRef.current = t;
          scheduleListeningRecovery();
        }
      };
    };

    const tryStart = (attempt = 0) => {
      if (!isMountedRef.current || !canListenRef.current || appStateRef.current !== 'active') return;
      Promise.resolve()
        .then(() =>
          typeof (Voice as any).destroy === 'function' ? (Voice as any).destroy() : Promise.resolve(),
        )
        .catch(() => {})
        .then(() => {
          if (!isMountedRef.current || !canListenRef.current) return;
          attachHandlers();
          setOverlayStatus('idle');
          return Voice.start(recognitionLocale);
        })
        .then(() => {
          if (!isMountedRef.current) return;
          clearListenTimeout();
          clearListeningStuckTimeout();
          if (cycleId !== listenCycleIdRef.current) return;
          listenTimeoutRef.current = setTimeout(() => {
            listenTimeoutRef.current = null;
            if (!isMountedRef.current || cycleId !== listenCycleIdRef.current) return;
            forceIdle(true);
          }, LISTEN_TIMEOUT_MS);
        })
        .catch((err: any) => {
          if (__DEV__) console.log('[HeyGupio] Voice.start failed:', err);
          setOverlayStatus('idle');
          if (isMountedRef.current && attempt < 2) {
            voiceLocaleIndexRef.current = (voiceLocaleIndexRef.current + 1) % VOICE_LOCALES.length;
            setTimeout(() => tryStart(attempt + 1), 1500);
          } else if (isMountedRef.current) {
            Alert.alert('Microphone', 'Could not start listening. Check mic permission and try again.');
          }
        });
    };
    tryStart();
  }, [clearListeningTimers, forceIdle, scheduleRestartListening, setOverlayStatus, speakWithTts]);

  startListeningRef.current = startListening;

  useEffect(() => {
    isMountedRef.current = true;

    const onTtsFinish = () => {
      if (ttsFallbackRef.current) {
        clearTimeout(ttsFallbackRef.current);
        ttsFallbackRef.current = null;
      }
      if (isMountedRef.current) {
        setOverlayStatus('idle');
      }
      const onDone = ttsFinishRef.current;
      ttsFinishRef.current = null;
      if (onDone) onDone();
    };
    Tts.addEventListener('tts-finish', onTtsFinish);

    (async () => {
      const ok = await requestMicPermission();
      if (!ok) {
        Alert.alert(
          'Microphone required',
          'Allow microphone access so Gupio can listen for "Hey Gupio" anytime.',
        );
        return;
      }
      Tts.getInitStatus()
        .then(() => {
          Promise.resolve((Tts as any).setDefaultLanguage?.('en-IN')).catch(() => {});
          Tts.setDefaultRate(0.48);
          Tts.setDefaultPitch(1.0);
        })
        .catch((err: any) => {
          if (err?.code === 'no_engine') Tts.requestInstallEngine();
        });
      setReady(true);
      modeRef.current = 'wake';
      setOverlayStatus('idle');
    })();

    const appSub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (next !== 'active') {
        Voice.stop().catch(() => {});
        if (isMountedRef.current) setOverlayStatus('idle');
      }
    });

    return () => {
      isMountedRef.current = false;
      if (ttsFallbackRef.current) {
        clearTimeout(ttsFallbackRef.current);
        ttsFallbackRef.current = null;
      }
      if (restartDelayRef.current) {
        clearTimeout(restartDelayRef.current);
        restartDelayRef.current = null;
      }
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
        listenTimeoutRef.current = null;
      }
      if (listeningStuckTimeoutRef.current) {
        clearTimeout(listeningStuckTimeoutRef.current);
        listeningStuckTimeoutRef.current = null;
      }
      appSub.remove();
      Tts.removeAllListeners('tts-finish');
      Tts.stop();
      try {
        Voice.destroy().then(() => Voice.removeAllListeners?.()).catch(() => {});
      } catch (_) {}
    };
  }, [requestMicPermission, setOverlayStatus]);

  useEffect(() => {
    if (!heyGupioCanListen) {
      forceIdle(true);
    }
  }, [forceIdle, heyGupioCanListen]);

  const stopContinuous = useCallback(() => {
    forceIdle(true);
  }, [forceIdle]);

  stopContinuousRef.current = stopContinuous;

  const startFromTap = useCallback(() => {
    if (!heyGupioCanListen || !isMountedRef.current) return;
    listenCycleIdRef.current += 1;
    continuousModeRef.current = true;
    voiceLocaleRetryRef.current = 0;
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    if (listeningStuckTimeoutRef.current) {
      clearTimeout(listeningStuckTimeoutRef.current);
      listeningStuckTimeoutRef.current = null;
    }
    if (ttsFallbackRef.current) {
      clearTimeout(ttsFallbackRef.current);
      ttsFallbackRef.current = null;
    }
    ttsFinishRef.current = null;
    Tts.stop();
    setOverlayStatus('idle');

    const begin = () => {
      if (!isMountedRef.current || !continuousModeRef.current) return;
      startListeningRef.current();
    };

    Promise.resolve()
      .then(() => Voice.stop().catch(() => {}))
      .then(() =>
        typeof (Voice as any).destroy === 'function'
          ? (Voice as any).destroy().catch(() => {})
          : Promise.resolve(),
      )
      .finally(begin);
  }, [heyGupioCanListen]);

  const onFloatingTap = useCallback(() => {  
    if (!heyGupioCanListen) return;
    if (status === 'idle') {
      startFromTap();
    } else {
      stopContinuous();
    }
  }, [heyGupioCanListen, startFromTap, status, stopContinuous]);

  if (!ready) return null;

  return (
    <Animated.View
      style={[
        styles.fabWrap,
        {
          transform: [{ translateX: dragPosition.x }, { translateY: dragPosition.y }],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onFloatingTap}
        style={[styles.fab, !heyGupioCanListen && styles.fabDisabled]}
        disabled={!heyGupioCanListen}
        accessibilityLabel={status === 'idle' ? 'Tap to start talking to Gupio' : 'Tap to stop'}
        accessibilityRole="button"
      >
        {status === 'idle' ? (
          <FastImage
            source={AI_GIF_SOURCE as any}
            style={styles.fabGif}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : status === 'listening' ? (
          <FastImage
            source={MIC_GIF_SOURCE as any}
            style={styles.listeningGif}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : status === 'processing' ? (
          <FastImage
            source={BRAIN_GIF_SOURCE}
            style={styles.processingGif}
            resizeMode={FastImage.resizeMode.contain}
          />
        ) : status === 'speaking' ? (
          <Image
            source={SPEAKER_GIF_SOURCE}
            style={styles.speakingGif}
            resizeMode="contain"
          />
        ) : null}
        <Text style={styles.stateFabIcon}>{''}</Text>
        <Text style={styles.fabIcon}>
          {status === 'listening' ? '🎤' : status === 'processing' ? '…' : status === 'speaking' ? '🔊' : '🎙'}
        </Text>
      </TouchableOpacity>
      {status !== 'idle' && (
        <View style={styles.statusBubble}>
          <Text style={styles.fabLabel} numberOfLines={2}>
            {status === 'listening' && 'Listening… Speak now'}
            {status === 'processing' && 'Thinking…'}
            {status === 'speaking' && 'Speaking… Tap to stop'}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: 'absolute',
    zIndex: 999,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabDisabled: {
    opacity: 0.7,
  },
  fabIcon: {
    fontSize: 26,
    position: 'absolute',
    opacity: 0,
  },
  stateFabIcon: {
    fontSize: 26,
    position: 'absolute',
  },
  fabGif: {
    width: FAB_SIZE + 101,
    height: FAB_SIZE + 101,
    borderRadius: FAB_SIZE / 2,
  },
  listeningGif: {
    width: FAB_SIZE + 12,
    height: FAB_SIZE + 12,
    borderRadius: FAB_SIZE / 2,
  },
  processingGif: {
    width: FAB_SIZE + 34,
    height: FAB_SIZE + 34,
    borderRadius: FAB_SIZE / 2,
  },
  speakingGif: {
    width: FAB_SIZE + 40,
    height: FAB_SIZE + 120,
    borderRadius: FAB_SIZE / 2,
  },
  statusBubble: {
    position: 'absolute',
    right: 68,
    top: 4,
    minWidth: 120,
    maxWidth: 160,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  fabLabel: {
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    color: '#d1d5db',
  },
});
