import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useFocusEffect, useNavigation } from '../../lib/react-navigation-native';
import {
  cancelDropRequest,
  getValetLocation,
  getVehicleRequestData,
  requestDrop,
  type VehicleRequestData,
} from '../../services/valetCustomerService';

export default function ValetService() {
  const navigation = useNavigation<any>();
  const [vehicleNumber, setVehicleNumber] = React.useState('');
  const [data, setData] = React.useState<VehicleRequestData | null>(null);
  const [location, setLocation] = React.useState<{ latitude?: number; longitude?: number } | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const currentVehicleNumber = (vehicleNumber || data?.vehicleNumber || '').toUpperCase().trim();

  const refresh = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const reqData = await getVehicleRequestData(currentVehicleNumber || undefined);
      setData(reqData);

      const targetVehicle = reqData.vehicleNumber || currentVehicleNumber;
      if (targetVehicle) {
        const loc = await getValetLocation(targetVehicle);
        setLocation({ latitude: loc.latitude, longitude: loc.longitude });
      } else {
        setLocation(null);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load valet data');
    } finally {
      setLoading(false);
    }
  }, [currentVehicleNumber]);

  const onRequestVehicle = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await requestDrop(currentVehicleNumber || undefined);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to request vehicle');
      setLoading(false);
    }
  }, [currentVehicleNumber, refresh]);

  const onCancelRequest = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await cancelDropRequest(currentVehicleNumber || undefined);
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Failed to cancel request');
      setLoading(false);
    }
  }, [currentVehicleNumber, refresh]);

  useFocusEffect(
    React.useCallback(() => {
      refresh();
      return () => {};
    }, [refresh]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Icon name="parking" size={28} color="#FFBF00" />
        <Text style={styles.title}>Valet Service</Text>
        <Text style={styles.subtitle}>Request vehicle and track valet from here.</Text>

        <TextInput
          value={vehicleNumber}
          onChangeText={setVehicleNumber}
          placeholder="Vehicle number (optional)"
          autoCapitalize="characters"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        {loading ? <ActivityIndicator color="#FFBF00" /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.infoBox}>
          <Text style={styles.infoLine}>
            Status: {data?.requestStatus || 'NO_REQUEST'}
          </Text>
          <Text style={styles.infoLine}>
            Vehicle: {data?.vehicleNumber || currentVehicleNumber || 'N/A'}
          </Text>
          <Text style={styles.infoLine}>
            Valet: {data?.pickupInfo?.pickedBy || 'Not assigned'}
          </Text>
          <Text style={styles.infoLine}>
            Live Location:{' '}
            {location?.latitude != null && location?.longitude != null
              ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
              : 'Unavailable'}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onRequestVehicle}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>Request Vehicle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onCancelRequest}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Cancel Request</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={refresh}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Refresh Status</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('VehicleList')}
        >
          <Text style={styles.secondaryButtonText}>Open My Garage</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1F2937',
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
  },
  subtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Outfit-Regular',
  },
  input: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E2E8F0',
    fontFamily: 'Outfit-Regular',
  },
  infoBox: {
    backgroundColor: '#0B1220',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  infoLine: {
    color: '#E2E8F0',
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontFamily: 'Outfit-Medium',
  },
  primaryButton: {
    marginTop: 10,
    backgroundColor: '#FFBF00',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#111827',
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  secondaryButtonText: {
    color: '#E2E8F0',
    fontFamily: 'Outfit-Bold',
    fontSize: 15,
  },
});
