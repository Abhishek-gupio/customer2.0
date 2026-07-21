import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Platform, PermissionsAndroid } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'react-native-camera-kit';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { qrService, messagingService, type ResolvedVehicle } from '../../services/messagingService';

async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export default function ScanQrScreen() {
  const navigation = useNavigation<any>();
  const [resolved, setResolved] = useState<ResolvedVehicle | null>(null);
  const [resolving, setResolving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const scannedRef = useRef(false);

  React.useEffect(() => {
    requestCameraPermission().then(setPermitted);
  }, []);

  const handleReadCode = useCallback(async (event: { nativeEvent: { codeStringValue: string } }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    // QR now encodes a full URL (…/v/<token>) so any camera app can open the web
    // fallback too — extract just the token whether it's a URL or (for older
    // printed stickers) a bare token string.
    const raw = event.nativeEvent.codeStringValue;
    const token = raw.includes('/v/') ? raw.split('/v/').pop()!.split(/[?#]/)[0] : raw;
    setResolving(true);
    try {
      const vehicle = await qrService.resolveToken(token);
      setResolved(vehicle);
    } catch (e: any) {
      Alert.alert('Not a valid Gupio QR code', e?.message || 'Try scanning again.', [
        { text: 'OK', onPress: () => { scannedRef.current = false; } },
      ]);
    } finally {
      setResolving(false);
    }
  }, []);

  const handleMessageOwner = async () => {
    if (!resolved) return;
    setStarting(true);
    try {
      const conversation = await messagingService.createConversation(resolved.vehicleId);
      navigation.replace('ChatConversation', { conversationId: conversation.id });
    } catch (e: any) {
      Alert.alert('Could not start conversation', e?.message || 'Please try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Scan Vehicle QR</Text>
      </View>

      {permitted === false ? (
        <View style={styles.centerState}>
          <IconMC name="camera-off" size={wp(14)} color="#444" />
          <Text style={styles.centerStateText}>Camera access is needed to scan a vehicle's QR code.</Text>
        </View>
      ) : resolved ? (
        <View style={styles.resultWrap}>
          <View style={styles.resultCard}>
            <View style={styles.resultIconWrap}>
              <IconMC name="car" size={wp(10)} color="#FFBF00" />
            </View>
            <Text style={styles.resultReg}>{resolved.registrationNumber}</Text>
            {resolved.make ? <Text style={styles.resultMakeModel}>{resolved.make} {resolved.model}</Text> : null}
          </View>
          <TouchableOpacity style={styles.messageBtn} onPress={handleMessageOwner} disabled={starting} activeOpacity={0.85}>
            <IconMC name="message-text" size={wp(4.5)} color="#111" />
            <Text style={styles.messageBtnText}>{starting ? 'Starting…' : 'Message Vehicle Owner'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => { setResolved(null); scannedRef.current = false; }}
          >
            <Text style={styles.rescanBtnText}>Scan a different vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <Camera
            style={StyleSheet.absoluteFill}
            scanBarcode
            showFrame
            allowedBarcodeTypes={['qr']}
            laserColor="#FFBF00"
            frameColor="#FFBF00"
            onReadCode={handleReadCode}
          />
          {resolving && (
            <View style={styles.resolvingOverlay}>
              <ActivityIndicator size="large" color="#FFBF00" />
              <Text style={styles.resolvingText}>Looking up vehicle…</Text>
            </View>
          )}
          <Text style={styles.scanHint}>Point your camera at the QR code on the vehicle</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1.5) },
  centerStateText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.6), textAlign: 'center' },
  cameraWrap: { flex: 1, marginHorizontal: wp(5), marginBottom: hp(3), borderRadius: 20, overflow: 'hidden' },
  scanHint: {
    position: 'absolute',
    bottom: hp(3),
    alignSelf: 'center',
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.3),
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: 12,
  },
  resolvingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(1.5),
  },
  resolvingText: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  resultWrap: { flex: 1, paddingHorizontal: wp(8), paddingTop: hp(4) },
  resultCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: wp(6),
    alignItems: 'center',
    marginBottom: hp(3),
  },
  resultIconWrap: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  resultReg: { color: '#fff', fontFamily: 'Outfit-Black', fontSize: wp(5.5) },
  resultMakeModel: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.6), marginTop: hp(0.5) },
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    backgroundColor: '#FFBF00',
    paddingVertical: hp(1.8),
    borderRadius: 16,
    marginBottom: hp(1.5),
  },
  messageBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  rescanBtn: { alignItems: 'center', paddingVertical: hp(1.2) },
  rescanBtnText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4) },
});
