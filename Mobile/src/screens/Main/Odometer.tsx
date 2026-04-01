import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import StatusModal from '../../components/common/Modals/StatusModal';
import { useFocusEffect } from '../../lib/react-navigation-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';
import { launchCamera } from 'react-native-image-picker';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { setWarrantyStatusNeedsRefresh } from '../../utils/refreshManager';
import { setLastOdometerUpdate } from '../../services/storage';

export default function Odometer() {
  const [loading, setLoading] = useState(true);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [reading, setReading] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });
  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };

  const fetchPrimary = useCallback(async () => {
    try {
      const list = await vehicleService.getVehicles();
      const primary = list.find((v: Vehicle) => v.isPrimary) || list[0];
      setVehicle(primary || null);
      if (primary?.currentOdometer) {
        setReading(String(primary.currentOdometer));
      } else {
        setReading('');
      }
    } catch (err) {
      console.error('Failed to fetch vehicles:', err);
      setVehicle(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchPrimary();
    }, [fetchPrimary])
  );

  const handleSaveReading = async () => {
    const value = reading.trim() ? parseInt(reading.replace(/\D/g, ''), 10) : 0;
    if (!vehicle?.id) {
      showStatus('No vehicle', 'Set a primary vehicle first.', 'error');
      return;
    }
    if (!value || value < 0) {
      showStatus('Invalid reading', 'Enter a valid odometer reading in km.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await vehicleService.addOdometer(vehicle.id, { reading: value });
      setLastOdometerUpdate(vehicle.id, Date.now());
      setWarrantyStatusNeedsRefresh();
      await fetchPrimary();
      showStatus('Success', 'Odometer updated successfully');
    } catch (err: any) {
      showStatus('Error', err?.message || 'Failed to update odometer', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpdate = async () => {
    if (!vehicle?.id) {
      showStatus('No vehicle', 'Set a primary vehicle first.', 'error');
      return;
    }
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Camera access is required to scan odometer reading.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
            buttonNeutral: 'Ask Me Later',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          showStatus('Permission denied', 'Camera permission is required to continue.', 'error');
          return;
        }
      }

      const result: any = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (result?.didCancel) return;
      if (result?.errorCode) {
        showStatus('Camera error', result?.errorMessage || 'Could not open camera.', 'error');
        return;
      }
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fd = new FormData();
        fd.append('photo', {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri?.replace('file://', ''),
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `odometer-${Date.now()}.jpg`,
        } as any);
        setPhotoSubmitting(true);
        try {
          const extracted = await vehicleService.extractOdometerViaAI(vehicle.id, fd);
          setReading(String(extracted.reading ?? ''));
        } catch (err: any) {
          showStatus('Error', err?.message || 'Could not read odometer from photo. Try manual entry.', 'error');
        } finally {
          setPhotoSubmitting(false);
        }
      }
    } catch (e) {
      console.error('Camera error:', e);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator size="large" color="#FFBF00" />
          <Text style={styles.loadingHint}>Loading your vehicle...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerFallback}>
          <Text style={styles.headerTitle}>Odometer</Text>
        </View>
        <View style={[styles.centered, { flex: 1 }]}>
          <Icon name="car" size={wp(20)} color="#333" />
          <Text style={styles.emptyText}>
            No primary vehicle set.{'\n'}Add a vehicle and set it as primary to track odometer.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <LinearGradient 
             colors={['rgba(255, 191, 0, 0.1)', 'transparent']}
             style={styles.headerGradient}
        >
          <Text style={styles.headerTitle}>Vehicle Odometer</Text>
          <View style={styles.vehicleBadge}>
            <Text style={styles.vehicleSub}>{vehicle.registrationNumber}</Text>
          </View>
          {vehicle.make && (
            <Text style={styles.vehicleMeta}>
              {vehicle.make} {vehicle.model || ''} {vehicle.year ? `(${vehicle.year})` : ''}
            </Text>
          )}
        </LinearGradient>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.currentCardWrapper}>
            <LinearGradient
                colors={['#171717', '#0A0A0A']}
                style={styles.currentCard}
            >
              <View style={styles.cardHeaderRow}>
                 <MaterialIcon name="speedometer" size={wp(5)} color="#888" />
                 <Text style={styles.currentLabel}>LAST RECORDED ODOMETER</Text>
              </View>
              
              <Text style={styles.currentValue}>
                {vehicle.currentOdometer != null
                  ? `${vehicle.currentOdometer.toLocaleString()}`
                  : '—'}
                {vehicle.currentOdometer != null && <Text style={styles.kmUnit}> KM</Text>}
              </Text>
              
              <View style={styles.hintBox}>
                <Icon name="info-circle" size={12} color="#666" />
                <Text style={styles.hint}>
                  Keeping this updated prevents missing critical maintenance schedules.
                </Text>
              </View>
            </LinearGradient>
          </View>

          <View style={styles.inputSection}>
            <Text style={styles.sectionLabel}>New Reading</Text>
            <View style={styles.inputContainer}>
              <MaterialIcon name="numeric" size={wp(6)} color="#666" style={{marginRight: 8}} />
              <TextInput
                style={styles.input}
                placeholder="Enter new km..."
                placeholderTextColor="#555"
                value={reading}
                onChangeText={setReading}
                keyboardType="number-pad"
                editable={!submitting}
                selectionColor="#FFBF00"
              />
            </View>

            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.btnPrimaryWrapper, (submitting || !reading.trim()) && styles.btnDisabled]}
              onPress={handleSaveReading}
              disabled={submitting || !reading.trim()}
            >
              <LinearGradient
                colors={['#FFBF00', '#D97706']}
                style={styles.btnPrimaryGradient}
              >
                {submitting ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.btnPrimaryText}>Update Odometer</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.btnSecondaryWrapper, photoSubmitting && styles.btnDisabled]}
            onPress={handlePhotoUpdate}
            disabled={photoSubmitting}
          >
             <LinearGradient
                colors={['#171717', '#0A0A0A']}
                style={styles.btnSecondaryGradient}
             >
                {photoSubmitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <MaterialIcon name="camera-iris" size={wp(5.5)} color="#FFBF00" style={styles.btnIcon} />
                    <Text style={styles.btnSecondaryText}>Scan Dashboard Photo</Text>
                  </>
                )}
             </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboard: {
    flex: 1,
  },
  headerFallback: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  loadingHint: {
    marginTop: hp(1.2),
    color: '#888',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
  },
  headerGradient: {
    paddingHorizontal: wp(6),
    paddingTop: hp(3),
    paddingBottom: hp(4),
  },
  headerTitle: {
    fontSize: wp(7.5),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    letterSpacing: 0.5,
  },
  vehicleBadge: {
    backgroundColor: 'rgba(255, 191, 0, 0.15)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: wp(2),
    alignSelf: 'flex-start',
    marginTop: hp(1),
    borderWidth: 1,
    borderColor: 'rgba(255, 191, 0, 0.2)',
  },
  vehicleSub: {
    fontSize: wp(3.8),
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
  },
  vehicleMeta: {
    fontSize: wp(3.5),
    color: '#888',
    fontFamily: 'Outfit-Medium',
    marginTop: hp(1.5),
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(4),
    paddingTop: hp(1),
  },
  currentCardWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
    marginBottom: hp(4),
    marginTop: -hp(2), // Pulled up into the header gradient a bit
  },
  currentCard: {
    borderRadius: wp(5),
    padding: wp(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
    gap: 8,
  },
  currentLabel: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  currentValue: {
    fontSize: wp(12),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    lineHeight: wp(13),
  },
  kmUnit: {
    fontSize: wp(5),
    fontFamily: 'Outfit-Medium',
    color: '#666',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    padding: wp(3),
    borderRadius: wp(2),
    marginTop: hp(2),
    gap: 8,
  },
  hint: {
    flex: 1,
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#666',
    lineHeight: hp(2),
  },
  inputSection: {
    marginBottom: hp(2),
  },
  sectionLabel: {
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    color: '#eee',
    marginBottom: hp(1.5),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: hp(2.5),
  },
  input: {
    flex: 1,
    height: hp(7),
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  btnPrimaryWrapper: {
    borderRadius: wp(4),
    overflow: 'hidden',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  btnPrimaryGradient: {
    height: hp(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Black',
    color: '#000',
    letterSpacing: 0.5,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(2),
    paddingHorizontal: wp(5),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#555',
    fontFamily: 'Outfit-Medium',
    paddingHorizontal: wp(4),
    fontSize: wp(3.5),
    letterSpacing: 2,
  },
  btnSecondaryWrapper: {
    borderRadius: wp(4),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  btnSecondaryGradient: {
    flexDirection: 'row',
    height: hp(7),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnIcon: {
    marginRight: 10,
  },
  btnSecondaryText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  emptyText: {
    color: '#888',
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: wp(6),
    lineHeight: 24,
  },
});
