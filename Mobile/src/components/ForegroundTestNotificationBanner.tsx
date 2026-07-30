import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Modal, Dimensions } from 'react-native';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import Tts from 'react-native-tts';

import { navigateTo } from '../navigation/navigationRef';

const { width } = Dimensions.get('window');

export default function ForegroundTestNotificationBanner() {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<{ title: string; body: string; conversationId?: string } | null>(null);
  
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const chimeTimerRef = useRef<any>(null);
  const autoDismissTimerRef = useRef<any>(null);

  const pulseLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('en-US').catch(() => {});
      Tts.setDefaultRate(0.55).catch(() => {});
    }).catch(() => {});

    // Continuous pulse effect on emergency alert icon
    pulseLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 800, useNativeDriver: false }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: false }),
      ])
    );
    pulseLoopRef.current.start();

    const start15SecChimeRingtone = (textToAnnounce: string) => {
      let elapsedMs = 0;
      const cleanMessage = textToAnnounce.replace(/[^a-zA-Z0-9\s]/g, '');
      const speakAlarm = () => {
        try {
          Tts.stop();
          Tts.speak(`Urgent vehicle alert! ${cleanMessage}`);
        } catch (e) {}
      };

      speakAlarm();
      chimeTimerRef.current = setInterval(() => {
        elapsedMs += 2500;
        if (elapsedMs >= 15000) {
          if (chimeTimerRef.current) clearInterval(chimeTimerRef.current);
          try { Tts.stop(); } catch (e) {}
          return;
        }
        speakAlarm();
      }, 2500);
    };

    const stopRingtone = () => {
      if (chimeTimerRef.current) clearInterval(chimeTimerRef.current);
      if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
      try { pulseLoopRef.current?.stop(); } catch (e) {}
      try { Tts.stop(); } catch (e) {}
    };

    const handler = (event: any) => {
      if (event?.detail) {
        if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
        setData(event.detail);
        setVisible(true);

        Animated.parallel([
          Animated.spring(scaleAnim, { toValue: 1, friction: 8, tension: 80, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        ]).start();

        start15SecChimeRingtone(event.detail.body || event.detail.title);

        autoDismissTimerRef.current = setTimeout(() => {
          stopRingtone();
          dismissModal();
        }, 15000);
      }
    };

    (globalThis as any).triggerTestBanner = (title: string, body: string, conversationId?: string) => {
      handler({ detail: { title, body, conversationId } });
    };

    return () => {
      stopRingtone();
      delete (globalThis as any).triggerTestBanner;
    };
  }, []);

  const dismissModal = (onDone?: () => void) => {
    if (chimeTimerRef.current) clearInterval(chimeTimerRef.current);
    if (autoDismissTimerRef.current) clearTimeout(autoDismissTimerRef.current);
    try { Tts.stop(); } catch (e) {}

    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, duration: 200, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      if (onDone) onDone();
    });
  };

  if (!visible || !data) return null;

  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.cardContainer,
            { opacity: opacityAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <LinearGradient
            colors={['#1a1c2a', '#0d0e17']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Header Badge & Close Button */}
            <View style={styles.topRow}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>URGENT VEHICLE ALERT</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.7}
                onPress={() => dismissModal()}
              >
                <IconMC name="close" size={20} color="#8890a6" />
              </TouchableOpacity>
            </View>

            {/* Glowing Icon Header */}
            <View style={styles.centerIconWrap}>
              <Animated.View style={[styles.pulseCircle, { transform: [{ scale: pulseAnim }] }]} />
              <LinearGradient
                colors={['#FFFFFF', '#A9CCCC']}
                style={styles.iconCircle}
              >
                <IconMC name="car-emergency" size={36} color="#0d0e17" />
              </LinearGradient>
            </View>

            {/* Title and Message Body */}
            <Text style={styles.modalTitle}>{data.title}</Text>
            <Text style={styles.modalBody}>{data.body}</Text>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.dismissBtn}
                activeOpacity={0.8}
                onPress={() => dismissModal()}
              >
                <Text style={styles.dismissBtnText}>DISMISS</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.viewMessageBtnWrap}
                activeOpacity={0.85}
                onPress={() => {
                  dismissModal(() => {
                    if (data.conversationId) {
                      navigateTo('ChatConversation', { conversationId: data.conversationId });
                    } else {
                      navigateTo('VehicleInbox');
                    }
                  });
                }}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#E5E7EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.viewMessageBtn}
                >
                  <Text style={styles.viewMessageBtnText}>VIEW MESSAGE</Text>
                  <IconMC name="arrow-right" size={18} color="#0d0e17" style={{ marginLeft: 6 }} />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 6, 10, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cardContainer: {
    width: width - 40,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 16,
  },
  cardGradient: {
    padding: 24,
    alignItems: 'center',
  },
  topRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    marginRight: 7,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
    width: 80,
    height: 80,
  },
  pulseCircle: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  modalBody: {
    color: '#9E9EAF',
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
    marginBottom: 24,
  },
  actionRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  dismissBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  dismissBtnText: {
    color: '#8890a6',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
  viewMessageBtnWrap: {
    flex: 1.4,
    height: 48,
  },
  viewMessageBtn: {
    flex: 1,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewMessageBtnText: {
    color: '#0d0e17',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 0.5,
  },
});
