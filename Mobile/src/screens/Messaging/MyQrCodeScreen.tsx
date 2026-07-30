import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Share, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { qrService, type VehicleQrToken } from '../../services/messagingService';
import { vehicleService } from '../../services/vehicleService';
import { getVehicleQrUrl } from '../../config';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface VehicleOption {
  id: string;
  registrationNumber: string;
  make?: string | null;
  model?: string | null;
}

export default function MyQrCodeScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = (route.params ?? {}) as { vehicleId?: string; registrationNumber?: string };
  const { user } = useSelector((state: RootState) => state.auth);

  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(
    params.vehicleId ? { id: params.vehicleId, registrationNumber: params.registrationNumber ?? '' } : null,
  );
  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [loadingVehicles, setLoadingVehicles] = useState(!params.vehicleId);
  const [token, setToken] = useState<VehicleQrToken | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [rotating, setRotating] = useState(false);

  // No vehicleId passed in — let the owner pick which vehicle's QR to show.
  useEffect(() => {
    if (params.vehicleId) return;
    vehicleService
      .getVehicles()
      .then((list) => {
        const myVehicles = list.filter((v) => v.customerId === user?.id);
        setVehicles(myVehicles as unknown as VehicleOption[]);
      })
      .catch((e: any) => Alert.alert('Could not load your vehicles', e?.message || 'Please try again'))
      .finally(() => setLoadingVehicles(false));
  }, [params.vehicleId]);

  useEffect(() => {
    if (!selectedVehicle) return;
    setLoadingToken(true);
    qrService
      .getMyToken(selectedVehicle.id)
      .then(setToken)
      .catch((e: any) => Alert.alert('Could not load QR code', e?.message || 'Please try again'))
      .finally(() => setLoadingToken(false));
  }, [selectedVehicle]);

  const handleRotate = () => {
    if (!selectedVehicle) return;
    Alert.alert(
      'Rotate QR code?',
      'Any printed sticker with the old code will stop working immediately. Use this if your sticker was lost, stolen, or shared publicly.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rotate',
          style: 'destructive',
          onPress: async () => {
            setRotating(true);
            try {
              const next = await qrService.rotateToken(selectedVehicle.id);
              setToken(next);
            } catch (e: any) {
              Alert.alert('Could not rotate QR code', e?.message || 'Please try again');
            } finally {
              setRotating(false);
            }
          },
        },
      ],
    );
  };

  const handleShare = () => {
    if (!token) return;
    Share.share({ message: `Scan this to message me about my vehicle — no app needed: ${getVehicleQrUrl(token.token)}` }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton
          onPress={() => (selectedVehicle && !params.vehicleId ? setSelectedVehicle(null) : navigation.goBack())}
        />
        <Text style={styles.headerTitle}>My QR Code</Text>
      </View>

      {!selectedVehicle ? (
        loadingVehicles ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#FFBF00" />
          </View>
        ) : vehicles.length === 0 ? (
          <View style={styles.centerState}>
            <IconMC name="car-off" size={wp(12)} color="#444" />
            <Text style={styles.emptyText}>Add a vehicle first to get its QR code.</Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerRow} onPress={() => setSelectedVehicle(item)} activeOpacity={0.8}>
                <IconMC name="car" size={wp(6)} color="#FFBF00" />
                <View style={styles.pickerRowBody}>
                  <Text style={styles.pickerReg}>{item.registrationNumber}</Text>
                  {item.make ? <Text style={styles.pickerMakeModel}>{item.make} {item.model}</Text> : null}
                </View>
                <IconMC name="chevron-right" size={wp(5)} color="#555" />
              </TouchableOpacity>
            )}
          />
        )
      ) : loadingToken ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : token ? (
        <View style={styles.content}>
          <View style={styles.qrCard}>
            <QRCode value={getVehicleQrUrl(token.token)} size={wp(60)} backgroundColor="#fff" color="#0a0a0a" />
          </View>
          {selectedVehicle.registrationNumber ? <Text style={styles.regNumber}>{selectedVehicle.registrationNumber}</Text> : null}
          <Text style={styles.hint}>
            Print this and stick it on your vehicle. Anyone can scan it with any camera — the Gupio app opens
            straight to chat if they have it, or a simple web page if they don't. Your phone number is never shown to them.
          </Text>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleShare} activeOpacity={0.85}>
            <IconMC name="share-variant" size={wp(4.5)} color="#111" />
            <Text style={styles.primaryBtnText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryBtn} onPress={handleRotate} disabled={rotating} activeOpacity={0.85}>
            <Icon name="sync-alt" size={wp(4)} color="#ef4444" />
            <Text style={styles.secondaryBtnText}>{rotating ? 'Rotating…' : 'Rotate QR code'}</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#090a0f' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { fontSize: wp(5.2), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1.5) },
  emptyText: { color: '#8890a6', fontFamily: 'Outfit-Medium', fontSize: wp(3.5), textAlign: 'center' },
  pickerList: { paddingHorizontal: wp(5), paddingTop: hp(1) },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3.5),
    backgroundColor: '#12141d',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#222636',
    padding: wp(4.5),
    marginBottom: hp(1.5),
  },
  pickerRowBody: { flex: 1 },
  pickerReg: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.2) },
  pickerMakeModel: { color: '#8890a6', fontFamily: 'Outfit-Regular', fontSize: wp(3.3), marginTop: 2 },
  content: { flex: 1, alignItems: 'center', paddingHorizontal: wp(8), paddingTop: hp(2) },
  qrCard: {
    backgroundColor: '#ffffff',
    padding: wp(6),
    borderRadius: 24,
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  regNumber: { color: '#fff', fontFamily: 'Outfit-Black', fontSize: wp(5), marginTop: hp(2.5), letterSpacing: 0.8 },
  hint: {
    color: '#8890a6',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.3),
    textAlign: 'center',
    lineHeight: wp(4.8),
    marginTop: hp(1.5),
    marginBottom: hp(3),
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(8),
    paddingVertical: hp(1.6),
    borderRadius: 16,
    marginBottom: hp(1.5),
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  primaryBtnText: { color: '#090a0f', fontFamily: 'Outfit-Bold', fontSize: wp(4) },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    borderWidth: 1,
    borderColor: '#ef4444',
    paddingHorizontal: wp(6),
    paddingVertical: hp(1.4),
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  secondaryBtnText: { color: '#ef4444', fontFamily: 'Outfit-Bold', fontSize: wp(3.5) },
});
