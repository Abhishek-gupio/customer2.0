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
      Alert.alert(
        'Not a valid Gupio QR code',
        `Scanned: ${raw}\nExtracted Token: ${token}\nError: ${e?.message || 'Try scanning again.'}`,
        [{ text: 'OK', onPress: () => { scannedRef.current = false; } }]
      );
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
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Scan Vehicle QR</Text>
          <Text style={styles.headerSubtitle}>Instant anonymous owner alert</Text>
        </View>
      </View>

      {permitted === false ? (
        <View style={styles.centerState}>
          <View style={styles.offIconWrap}>
            <IconMC name="camera-off" size={wp(10)} color="#ef4444" />
          </View>
          <Text style={styles.centerStateTitle}>Camera Access Required</Text>
          <Text style={styles.centerStateText}>
            Grant camera permission to scan QR tags on vehicles and reach owners instantly.
          </Text>
        </View>
      ) : resolved ? (
        <View style={styles.resultWrap}>
          <View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <View style={styles.resultIconWrap}>
                <IconMC name="car-sports" size={wp(8)} color="#5F9EA0" />
              </View>
              <View style={styles.resultTitleWrap}>
                <Text style={styles.resultPlateLabel}>IDENTIFIED VEHICLE</Text>
                <Text style={styles.resultReg}>{resolved.registrationNumber}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRowGrid}>
              {resolved.make ? (
                <View style={styles.infoPill}>
                  <IconMC name="car-info" size={wp(4)} color="#5F9EA0" />
                  <Text style={styles.infoPillText}>{resolved.make} {resolved.model}</Text>
                </View>
              ) : null}
              {resolved.color ? (
                <View style={styles.infoPill}>
                  <IconMC name="palette" size={wp(4)} color="#5F9EA0" />
                  <Text style={styles.infoPillText}>{resolved.color}</Text>
                </View>
              ) : null}
              {resolved.ownerName ? (
                <View style={styles.infoPill}>
                  <IconMC name="account-check" size={wp(4)} color="#10b981" />
                  <Text style={styles.infoPillText}>Owner: {resolved.ownerName}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <TouchableOpacity style={styles.messageBtn} onPress={handleMessageOwner} disabled={starting} activeOpacity={0.85}>
            <IconMC name="message-processing" size={wp(5)} color="#090a0f" />
            <Text style={styles.messageBtnText}>{starting ? 'Connecting…' : 'Message Vehicle Owner'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rescanBtn}
            onPress={() => { setResolved(null); scannedRef.current = false; }}
            activeOpacity={0.8}
          >
            <IconMC name="qrcode-scan" size={wp(4)} color="#8890a6" />
            <Text style={styles.rescanBtnText}>Scan another vehicle</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.cameraWrap}>
          <Camera
            style={StyleSheet.absoluteFill}
            scanBarcode={true}
            onReadCode={handleReadCode}
          />
          
          {/* Overlay mask with viewfinder target */}
          <View style={styles.overlayContainer}>
            <View style={styles.overlayTop} />
            <View style={styles.overlayMiddleRow}>
              <View style={styles.overlaySide} />
              
              {/* Viewfinder box with 4 corner reticles */}
              <View style={styles.viewfinder}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
                <View style={styles.laserLine} />
              </View>
              
              <View style={styles.overlaySide} />
            </View>
            <View style={styles.overlayBottom}>
              <View style={styles.hintBadge}>
                <IconMC name="target" size={wp(4)} color="#5F9EA0" />
                <Text style={styles.scanHint}>Align vehicle QR code within frame</Text>
              </View>
            </View>
          </View>

          {resolving && (
            <View style={styles.resolvingOverlay}>
              <ActivityIndicator size="large" color="#5F9EA0" />
              <Text style={styles.resolvingText}>Decoding QR Tag & Looking up owner…</Text>
            </View>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(1.8) },
  headerTextWrap: { flex: 1, marginLeft: wp(3) },
  headerTitle: { fontSize: wp(5.2), fontFamily: 'Outfit-Bold', color: '#fff' },
  headerSubtitle: { fontSize: wp(2.8), fontFamily: 'Outfit-Medium', color: '#888', marginTop: 1 },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1.5) },
  offIconWrap: {
    width: wp(18),
    height: wp(18),
    borderRadius: wp(9),
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerStateTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5) },
  centerStateText: { color: '#8890a6', fontFamily: 'Outfit-Regular', fontSize: wp(3.4), textAlign: 'center', lineHeight: wp(5) },
  
  cameraWrap: { flex: 1, marginHorizontal: wp(4), marginBottom: hp(3), borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#222636' },
  overlayContainer: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(9, 10, 15, 0.65)' },
  overlayMiddleRow: { flexDirection: 'row', height: wp(68) },
  overlaySide: { flex: 1, backgroundColor: 'rgba(9, 10, 15, 0.65)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(9, 10, 15, 0.65)', alignItems: 'center', paddingTop: hp(3) },
  
  viewfinder: {
    width: wp(68),
    height: wp(68),
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  corner: {
    position: 'absolute',
    width: wp(6),
    height: wp(6),
    borderColor: '#5F9EA0',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 8 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 8 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 8 },
  laserLine: {
    width: '90%',
    height: 2,
    backgroundColor: '#5F9EA0',
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  
  hintBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: '#12141d',
    paddingHorizontal: wp(4.5),
    paddingVertical: hp(1.2),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160, 0.6)',
  },
  scanHint: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.3) },
  
  resolvingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 10, 15, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(1.5),
  },
  resolvingText: { color: '#fff', fontFamily: 'Outfit-Medium', fontSize: wp(3.6) },
  
  resultWrap: { flex: 1, paddingHorizontal: wp(5), paddingTop: hp(2) },
  resultCard: {
    backgroundColor: '#12141d',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#222636',
    padding: wp(5),
    marginBottom: hp(2.5),
  },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: wp(3.5) },
  resultIconWrap: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    backgroundColor: 'rgba(95, 158, 160,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultTitleWrap: { flex: 1 },
  resultPlateLabel: { fontSize: wp(2.6), fontFamily: 'Outfit-Bold', color: '#5F9EA0', letterSpacing: 0.8 },
  resultReg: { color: '#fff', fontFamily: 'Outfit-Black', fontSize: wp(5.5), letterSpacing: 1, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1d2130', marginVertical: hp(1.8) },
  infoRowGrid: { gap: hp(1) },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: '#171a26',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.1),
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222636',
  },
  infoPillText: { color: '#e2e8f0', fontFamily: 'Outfit-Medium', fontSize: wp(3.4) },
  
  messageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2.5),
    backgroundColor: '#5F9EA0',
    paddingVertical: hp(1.8),
    borderRadius: 18,
    marginBottom: hp(1.5),
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  messageBtnText: { color: '#090a0f', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  rescanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    paddingVertical: hp(1.4),
    borderRadius: 16,
    backgroundColor: '#12141d',
    borderWidth: 1,
    borderColor: '#222636',
  },
  rescanBtnText: { color: '#8890a6', fontFamily: 'Outfit-Medium', fontSize: wp(3.4) },
});
