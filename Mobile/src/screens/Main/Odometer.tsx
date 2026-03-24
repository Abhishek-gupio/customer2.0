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
      Alert.alert('No vehicle', 'Set a primary vehicle first.');
      return;
    }
    if (!value || value < 0) {
      Alert.alert('Invalid reading', 'Enter a valid odometer reading in km.');
      return;
    }
    setSubmitting(true);
    try {
      await vehicleService.addOdometer(vehicle.id, { reading: value });
      setLastOdometerUpdate(vehicle.id, Date.now());
      setWarrantyStatusNeedsRefresh();
      await fetchPrimary();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update odometer');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePhotoUpdate = async () => {
    if (!vehicle?.id) {
      Alert.alert('No vehicle', 'Set a primary vehicle first.');
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
          Alert.alert('Permission denied', 'Camera permission is required to continue.');
          return;
        }
      }

      const result: any = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (result?.didCancel) return;
      if (result?.errorCode) {
        Alert.alert('Camera error', result?.errorMessage || 'Could not open camera.');
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
          Alert.alert('Error', err?.message || 'Could not read odometer from photo. Try manual entry.');
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
      <SafeAreaView style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#FFBF00" />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
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
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Odometer</Text>
          <Text style={styles.vehicleSub}>{vehicle.registrationNumber}</Text>
          {vehicle.make && (
            <Text style={styles.vehicleMeta}>
              {vehicle.make} {vehicle.model || ''} {vehicle.year ? `(${vehicle.year})` : ''}
            </Text>
          )}
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>Current reading</Text>
            <Text style={styles.currentValue}>
              {vehicle.currentOdometer != null
                ? `${vehicle.currentOdometer.toLocaleString()} km`
                : '—'}
            </Text>
            <Text style={styles.hint}>
              Keep this updated so Parts & Warranty can predict when to change parts.
            </Text>
          </View>

          <Text style={styles.sectionLabel}>Update reading</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter km (e.g. 45000)"
            placeholderTextColor="#666"
            value={reading}
            onChangeText={setReading}
            keyboardType="number-pad"
            editable={!submitting}
          />

          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary, (submitting || !reading.trim()) && styles.btnDisabled]}
            onPress={handleSaveReading}
            disabled={submitting || !reading.trim()}
          >
            {submitting ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.btnPrimaryText}>Save reading</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.btn, styles.btnSecondary, photoSubmitting && styles.btnDisabled]}
            onPress={handlePhotoUpdate}
            disabled={photoSubmitting}
          >
            {photoSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Icon name="camera" size={wp(5)} color="#fff" style={styles.btnIcon} />
                <Text style={styles.btnSecondaryText}>Update from dashboard photo</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboard: {
    flex: 1,
  },
  header: {
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  headerTitle: {
    fontSize: wp(6),
    fontFamily: 'Outfit-Black',
    color: '#fff',
  },
  vehicleSub: {
    fontSize: wp(4),
    color: '#FFBF00',
    fontFamily: 'Outfit-Bold',
    marginTop: 4,
  },
  vehicleMeta: {
    fontSize: wp(3.5),
    color: '#888',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(4),
  },
  currentCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: wp(5),
    marginBottom: hp(3),
  },
  currentLabel: {
    fontSize: wp(3.5),
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  currentValue: {
    fontSize: wp(8),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    marginTop: 4,
  },
  hint: {
    fontSize: wp(3.2),
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    fontSize: wp(5),
    color: '#fff',
    marginBottom: hp(2),
  },
  btn: {
    borderRadius: 18,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  btnPrimary: {
    backgroundColor: '#FFBF00',
    marginBottom: hp(2),
  },
  btnPrimaryText: {
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Black',
    color: '#000',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(2),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#333',
  },
  dividerText: {
    color: '#666',
    paddingHorizontal: wp(3),
    fontSize: wp(3.5),
  },
  btnSecondary: {
    backgroundColor: '#222',
    borderWidth: 1,
    borderColor: '#444',
  },
  btnIcon: {
    marginRight: 8,
  },
  btnSecondaryText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  emptyText: {
    color: '#888',
    fontSize: wp(4),
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: wp(6),
  },
});
