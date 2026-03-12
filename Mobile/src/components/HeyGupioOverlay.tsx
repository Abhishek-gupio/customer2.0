import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Voice from '@react-native-voice/voice';
import Tts from 'react-native-tts';
import { chatService } from '../services/chatService';

const VOICE_LOCALE = Platform.OS === 'ios' ? 'en-US' : 'en-IN';

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
  const navigation = useNavigation();
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'listening' | 'speaking' | 'processing'>('idle');
  const modeRef = useRef<'wake' | 'command'>('wake');
  const sessionIdRef = useRef<string | undefined>(undefined);
  const isMountedRef = useRef(true);
  const ttsFinishRef = useRef<(() => void) | null>(null);

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

  const startListening = useCallback(() => {
    if (!isMountedRef.current) return;
    setStatus('listening');
    const onResult = async (e: any) => {
      if (!isMountedRef.current) return;
      // Support both { value: string[] } and { results: string[][] } or similar
      const raw = e?.value ?? e?.results?.[0] ?? e?.result ?? [];
      const first = Array.isArray(raw) ? raw[0] : raw;
      const transcript = (typeof first === 'string' ? first : first?.transcript ?? '').trim();
      if (__DEV__ && transcript) console.log('[HeyGupio] Heard:', transcript);
      if (!transcript) {
        Voice.start(VOICE_LOCALE).catch(() => {});
        return;
      }
      try {
        await Voice.stop();
      } catch (_) {}

      const isWake = isWakeWord(transcript);
      const command = extractCommand(transcript);

      if (modeRef.current === 'wake') {
        if (!isWake) {
          Voice.start(VOICE_LOCALE).catch(() => {});
          return;
        }
        if (command) {
          modeRef.current = 'wake';
          setStatus('processing');
          try {
            const data = await chatService.sendMessage(command, sessionIdRef.current);
            sessionIdRef.current = data.sessionId;
            const reply = data.message || 'Done.';
            setStatus('speaking');
            Tts.speak(reply);
            ttsFinishRef.current = () => {
              setStatus('listening');
              modeRef.current = 'wake';
              const nav = navigationRef.current as any;
              const root = nav?.getParent?.() ?? nav;
              root?.navigate?.('Chat', { userMessage: '', sessionId: data.sessionId });
              ttsFinishRef.current = null;
              Voice.start(VOICE_LOCALE).catch(() => {});
            };
          } catch (err: any) {
            setStatus('speaking');
            const msg = err?.message || 'Something went wrong. Please try again.';
            Tts.speak(msg);
            ttsFinishRef.current = () => {
              setStatus('listening');
              ttsFinishRef.current = null;
              Voice.start(VOICE_LOCALE).catch(() => {});
            };
          }
          return;
        }
        setStatus('speaking');
        Tts.speak('How can I help?');
        modeRef.current = 'command';
        ttsFinishRef.current = () => {
          setStatus('listening');
          ttsFinishRef.current = null;
          Voice.start(VOICE_LOCALE).catch(() => {});
        };
        return;
      }

      if (modeRef.current === 'command') {
        modeRef.current = 'wake';
        setStatus('processing');
        try {
          const data = await chatService.sendMessage(transcript, sessionIdRef.current);
          sessionIdRef.current = data.sessionId;
          const reply = data.message || 'Done.';
          setStatus('speaking');
          Tts.speak(reply);
          ttsFinishRef.current = () => {
            setStatus('listening');
            ttsFinishRef.current = null;
            const nav = navigationRef.current as any;
            const root = nav?.getParent?.() ?? nav;
            root?.navigate?.('Chat', { userMessage: '', sessionId: data.sessionId });
            Voice.start(VOICE_LOCALE).catch(() => {});
          };
        } catch (err: any) {
          setStatus('speaking');
          const msg = err?.message || 'Something went wrong. Please try again.';
          Tts.speak(msg);
          ttsFinishRef.current = () => {
            setStatus('listening');
            ttsFinishRef.current = null;
            Voice.start(VOICE_LOCALE).catch(() => {});
          };
        }
      }
    };

    const onError = async (err: any) => {
      try {
        await Voice.stop();
      } catch (_) {}
      const msg = String(err?.error?.message ?? err?.message ?? err).toLowerCase();
      if (msg.includes('cancel') || msg.includes('no match') || msg.includes('no speech')) {
        if (isMountedRef.current) {
          setStatus('listening');
          Voice.start(VOICE_LOCALE).catch(() => {});
        }
        return;
      }
      if (isMountedRef.current) setStatus('listening');
      setTimeout(() => {
        if (isMountedRef.current) Voice.start(VOICE_LOCALE).catch(() => {});
      }, 1000);
    };

    (Voice as any).onSpeechResults = onResult;
    (Voice as any).onSpeechError = onError;
    (Voice as any).onSpeechStart = () => {
      if (isMountedRef.current) setStatus('listening');
    };
    const tryStart = (attempt = 0) => {
      Voice.start(VOICE_LOCALE).catch((err) => {
        if (__DEV__) console.log('[HeyGupio] Voice.start failed:', err);
        setStatus('idle');
        if (isMountedRef.current && attempt < 3) {
          setTimeout(() => tryStart(attempt + 1), 2000);
        }
      });
    };
    tryStart();
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    const onTtsFinish = () => {
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
          Tts.setDefaultRate(0.5);
          Tts.setDefaultPitch(1.0);
        })
        .catch((err: any) => {
          if (err?.code === 'no_engine') Tts.requestInstallEngine();
        });
      setReady(true);
      modeRef.current = 'wake';
      setStatus('listening');
      startListening();
    })();

    return () => {
      isMountedRef.current = false;
      Tts.removeAllListeners('tts-finish');
      Tts.stop();
      try {
        Voice.destroy().then(() => Voice.removeAllListeners?.()).catch(() => {});
      } catch (_) {}
    };
  }, [requestMicPermission]);

  if (!ready) return null;

  return (
    <View style={styles.indicator} pointerEvents="none">
      <View style={[styles.dot, status === 'listening' && styles.dotListening]} />
      <Text style={styles.label}>
        {status === 'listening' && 'Listening for "Hey Gupio"'}
        {status === 'speaking' && 'Gupio speaking…'}
        {status === 'processing' && 'Thinking…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 52 : 42,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 999,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#333',
  },
  dotListening: {
    backgroundColor: '#00ff9c',
  },
  label: {
    fontSize: 11,
    color: '#7a8599',
  },
});
