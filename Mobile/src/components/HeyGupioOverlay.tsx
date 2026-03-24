import React, { useRef, useState, useEffect, useCallback, useContext } from 'react';
import {
  Animated,
  View,
  Text,
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
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { chatService } from '../services/chatService';
import { VoiceOwnerContext } from '../context/VoiceOwnerContext';

const VOICE_LOCALE = 'en-IN';
const LISTEN_TIMEOUT_MS = 12000;
const RESTART_DELAY_MS = Platform.OS === 'android' ? 1200 : 600;
const FAB_SIZE = 56;
const FAB_MARGIN = 20;
const FAB_BOTTOM_OFFSET = 88;
const MIN_TOP_OFFSET = 72;

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

export default function HeyGupioOverlay() {
  const window = Dimensions.get('window');
  const { heyGupioCanListen } = useContext(VoiceOwnerContext);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const modeRef = useRef<'wake' | 'command'>('wake');
  const sessionIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const ttsFinishRef = useRef<(() => void) | null>(null);
  const listenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const continuousModeRef = useRef(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const startListeningRef = useRef<() => void>(() => {});
  const stopContinuousRef = useRef<() => void>(() => {});
  const canListenRef = useRef(heyGupioCanListen);
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
  const speakWithTts = useCallback((text: string, onDone?: () => void) => {
    if (ttsFallbackRef.current) {
      clearTimeout(ttsFallbackRef.current);
      ttsFallbackRef.current = null;
    }
    ttsFinishRef.current = onDone ?? null;
    Tts.getInitStatus()
      .then(() => {
        Promise.resolve((Tts as any).setDefaultLanguage?.('en-IN')).catch(() => {});
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
    restartDelayRef.current = setTimeout(() => {
      restartDelayRef.current = null;
      if (!isMountedRef.current || !continuousModeRef.current || !canListenRef.current) return;
      setStatus('idle');
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
    modeRef.current = 'command';
    const clearListenTimeout = () => {
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
        listenTimeoutRef.current = null;
      }
    };

    const lastPartialRef = { current: '' };
    const parseTranscript = (e: any): string => {
      const raw = e?.value ?? e?.results?.[0] ?? e?.result ?? [];
      const first = Array.isArray(raw) ? raw[0] : raw;
      return (typeof first === 'string' ? first : first?.transcript ?? '').trim();
    };

    const onResult = async (e: any) => {
      if (!isMountedRef.current) return;
      clearListenTimeout();
      let transcript = parseTranscript(e);
      if (!transcript && lastPartialRef.current) transcript = lastPartialRef.current;
      lastPartialRef.current = '';
      if (__DEV__ && transcript) console.log('[HeyGupio] Heard:', transcript);
      if (!transcript) {
        if (continuousModeRef.current) scheduleRestartListening();
        else setStatus('idle');
        return;
      }
      if (isEndCommand(transcript)) {
        stopContinuousRef.current();
        return;
      }
      try {
        await Voice.stop();
      } catch (_) {}

      modeRef.current = 'wake';
      setStatus('processing');
      try {
        const data = await chatService.sendMessage(transcript, sessionIdRef.current);
        sessionIdRef.current = data.sessionId;
        const reply = data.message || 'Done.';
        setStatus('speaking');
        speakWithTts(reply, () => {
          ttsFinishRef.current = null;
          if (continuousModeRef.current) {
            scheduleRestartListening();
          } else {
            setStatus('idle');
          }
        });
      } catch (err: any) {
        setStatus('speaking');
        const msg = err?.message || 'Something went wrong. Please try again.';
        speakWithTts(msg, () => {
          ttsFinishRef.current = null;
          if (continuousModeRef.current) {
            scheduleRestartListening();
          } else {
            setStatus('idle');
          }
        });
      }
    };

    const onError = async (err: any) => {
      clearListenTimeout();
      try {
        await Voice.stop();
      } catch (_) {}
      const msg = String(err?.error?.message ?? err?.message ?? err).toLowerCase();
      if (msg.includes('cancel') || msg.includes('no match') || msg.includes('no speech')) {
        if (isMountedRef.current) {
          if (continuousModeRef.current) scheduleRestartListening();
          else setStatus('idle');
        }
        return;
      }
      if (isMountedRef.current) {
        if (continuousModeRef.current) scheduleRestartListening();
        else setStatus('idle');
      }
    };

    const attachHandlers = () => {
      try {
        Voice.removeAllListeners?.();
      } catch (_) {}
      (Voice as any).onSpeechResults = onResult;
      (Voice as any).onSpeechError = onError;
      (Voice as any).onSpeechStart = () => {
        if (isMountedRef.current) setStatus('listening');
      };
      (Voice as any).onSpeechPartialResults = (e: any) => {
        const t = parseTranscript(e);
        if (t) lastPartialRef.current = t;
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
          setStatus('idle');
          return Voice.start(VOICE_LOCALE);
        })
        .then(() => {
          if (!isMountedRef.current) return;
          clearListenTimeout();
          listenTimeoutRef.current = setTimeout(() => {
            listenTimeoutRef.current = null;
            if (!isMountedRef.current) return;
            Voice.stop().catch(() => {});
            if (continuousModeRef.current) scheduleRestartListening();
            else setStatus('idle');
          }, LISTEN_TIMEOUT_MS);
        })
        .catch((err: any) => {
          if (__DEV__) console.log('[HeyGupio] Voice.start failed:', err);
          setStatus('idle');
          if (isMountedRef.current && attempt < 2) {
            setTimeout(() => tryStart(attempt + 1), 1500);
          } else if (isMountedRef.current) {
            Alert.alert('Microphone', 'Could not start listening. Check mic permission and try again.');
          }
        });
    };
    tryStart();
  }, [scheduleRestartListening, speakWithTts]);

  startListeningRef.current = startListening;

  useEffect(() => {
    isMountedRef.current = true;

    const onTtsFinish = () => {
      if (ttsFallbackRef.current) {
        clearTimeout(ttsFallbackRef.current);
        ttsFallbackRef.current = null;
      }
      if (isMountedRef.current) {
        setStatus('idle');
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
      setStatus('idle');
    })();

    const appSub = AppState.addEventListener('change', (next) => {
      appStateRef.current = next;
      if (next !== 'active') {
        Voice.stop().catch(() => {});
        if (isMountedRef.current) setStatus('idle');
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
      appSub.remove();
      Tts.removeAllListeners('tts-finish');
      Tts.stop();
      try {
        Voice.destroy().then(() => Voice.removeAllListeners?.()).catch(() => {});
      } catch (_) {}
    };
  }, [requestMicPermission]);

  useEffect(() => {
    if (!heyGupioCanListen) {
      Voice.stop().catch(() => {});
      setStatus('idle');
    }
  }, [heyGupioCanListen]);

  const stopContinuous = useCallback(() => {
    continuousModeRef.current = false;
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    Voice.stop().catch(() => {});
    Tts.stop();
    setStatus('idle');
  }, []);

  stopContinuousRef.current = stopContinuous;

  const startFromTap = useCallback(() => {
    if (!heyGupioCanListen || !isMountedRef.current) return;
    continuousModeRef.current = true;
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    if (ttsFallbackRef.current) {
      clearTimeout(ttsFallbackRef.current);
      ttsFallbackRef.current = null;
    }
    ttsFinishRef.current = null;
    Tts.stop();
    setStatus('listening');

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
