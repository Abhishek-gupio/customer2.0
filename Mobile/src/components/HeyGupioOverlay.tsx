import React, { useRef, useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
  AppState,
  AppStateStatus,
  TouchableOpacity,
} from 'react-native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { chatService } from '../services/chatService';
import { VoiceOwnerContext } from '../context/VoiceOwnerContext';

const VOICE_LOCALE = Platform.OS === 'ios' ? 'en-US' : 'en-IN';
/** Stop listening after this many ms if no speech result (so we don't listen forever). */
const LISTEN_TIMEOUT_MS = 12000;
/** Delay before restarting mic after agent speaks (let TTS release audio; then we reset Voice). */
const RESTART_DELAY_MS = Platform.OS === 'android' ? 1200 : 600;

/** Normalize for matching: lowercase, collapse spaces */
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function isWakeWord(transcript: string): boolean {
  const t = normalize(transcript);
  if (!t) return false;
  // Exact or at start
  if (t === 'hey gupio' || t === 'gupio') return true;
  if (t.startsWith('hey gupio ') || t.startsWith('gupio ')) return true;
  // Some engines return "hey Gupio" or "hey, gupio" - be flexible
  if (t.includes('hey gupio') || t.includes('gupio')) return true;
  return false;
}

function extractCommand(transcript: string): string {
  const t = normalize(transcript);
  // After "hey gupio" or "gupio" (from start or anywhere)
  const afterHeyGupio = t.split('hey gupio').pop()?.trim() ?? '';
  const afterGupio = t.split('gupio').pop()?.trim() ?? '';
  if (afterHeyGupio.length > 0 && afterHeyGupio.length < t.length) return afterHeyGupio;
  if (afterGupio.length > 0 && afterGupio.length < t.length) return afterGupio;
  return '';
}

export default function HeyGupioOverlay() {
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
  const canListenRef = useRef(heyGupioCanListen);
  canListenRef.current = heyGupioCanListen;

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
        // Fallback: if tts-finish never fires, still run onDone after ~length-based delay
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

  /** After agent speaks: wait a bit, release TTS, reset recognizer, then start listening again. */
  const scheduleRestartListening = useCallback(() => {
    if (restartDelayRef.current) {
      clearTimeout(restartDelayRef.current);
      restartDelayRef.current = null;
    }
    restartDelayRef.current = setTimeout(() => {
      restartDelayRef.current = null;
      if (!isMountedRef.current || !continuousModeRef.current || !canListenRef.current) return;
      setStatus('listening');
      // Release TTS so it doesn't hold audio; reset Voice so next start() actually listens
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
    setStatus('listening');
    modeRef.current = 'command'; // Tap-to-talk: first phrase is the command, no "Hey Gupio" needed
    const clearListenTimeout = () => {
      if (listenTimeoutRef.current) {
        clearTimeout(listenTimeoutRef.current);
        listenTimeoutRef.current = null;
      }
    };

    const onResult = async (e: any) => {
      if (!isMountedRef.current) return;
      clearListenTimeout();
      const raw = e?.value ?? e?.results?.[0] ?? e?.result ?? [];
      const first = Array.isArray(raw) ? raw[0] : raw;
      const transcript = (typeof first === 'string' ? first : first?.transcript ?? '').trim();
      if (__DEV__ && transcript) console.log('[HeyGupio] Heard:', transcript);
      if (!transcript) {
        if (continuousModeRef.current) scheduleRestartListening();
        else setStatus('idle');
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
            setStatus('listening'); // Show listening immediately after agent speaks
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
            setStatus('listening');
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

    (Voice as any).onSpeechResults = onResult;
    (Voice as any).onSpeechError = onError;
    (Voice as any).onSpeechStart = () => {
      if (isMountedRef.current) setStatus('listening');
    };
    const tryStart = (attempt = 0) => {
      if (!isMountedRef.current || !canListenRef.current || appStateRef.current !== 'active') return;
      Voice.start(VOICE_LOCALE)
        .then(() => {
          clearListenTimeout();
          listenTimeoutRef.current = setTimeout(() => {
            listenTimeoutRef.current = null;
            if (!isMountedRef.current) return;
            Voice.stop().catch(() => {});
            if (continuousModeRef.current) scheduleRestartListening();
            else setStatus('idle');
          }, LISTEN_TIMEOUT_MS);
        })
        .catch((err) => {
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
  }, [speakWithTts, scheduleRestartListening]);

  startListeningRef.current = startListening;

  useEffect(() => {
    isMountedRef.current = true;

    const onTtsFinish = () => {
      if (ttsFallbackRef.current) {
        clearTimeout(ttsFallbackRef.current);
        ttsFallbackRef.current = null;
      }
      if (ttsFinishRef.current) ttsFinishRef.current();
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

  const onFloatingTap = useCallback(() => {
    if (!heyGupioCanListen) return;
    if (status === 'idle') {
      continuousModeRef.current = true;
      startListening();
    } else {
      stopContinuous();
    }
  }, [heyGupioCanListen, status, startListening, stopContinuous]);

  if (!ready) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onFloatingTap}
      style={[styles.fab, !heyGupioCanListen && styles.fabDisabled]}
      disabled={!heyGupioCanListen}
      accessibilityLabel={status === 'idle' ? 'Tap to start talking to Gupio' : 'Tap to stop'}
      accessibilityRole="button"
    >
      <Text style={styles.fabIcon}>{status === 'listening' ? '🎤' : status === 'processing' ? '…' : status === 'speaking' ? '🔊' : '🎙'}</Text>
      {status !== 'idle' && (
        <Text style={styles.fabLabel} numberOfLines={1}>
          {status === 'listening' && 'Listening… Tap to stop'}
          {status === 'processing' && 'Thinking…'}
          {status === 'speaking' && 'Speaking… Tap to stop'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 88,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
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
  fabLabel: {
    position: 'absolute',
    right: 60,
    fontSize: 11,
    color: '#7a8599',
    maxWidth: 80,
  },
});
