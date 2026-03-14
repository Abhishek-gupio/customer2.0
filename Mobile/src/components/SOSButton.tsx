import { StyleSheet, Text, View, Image, Pressable, TouchableOpacity, Alert, ScrollView, Linking, Platform, TextInput, PermissionsAndroid } from 'react-native'
import React, { useCallback, useEffect, useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors } from '../theme/colors'
import { fontWeights as FW } from '../theme/Fontsize'
import Ionicons from "react-native-vector-icons/Ionicons";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useNavigation } from '../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../navigation/types';
import { sosService, type EmergencyContact, type NearbyHelpItem, type SOSType } from '../services/sosService';

let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}



const SOSButton = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [sendingSOS, setSendingSOS] = useState(false);
  const [nearbyHelp, setNearbyHelp] = useState<NearbyHelpItem[]>([]);
  const [loadingHelp, setLoadingHelp] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [newContactRelation, setNewContactRelation] = useState('');
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'denied' | 'error' | 'fixed'>('idle');
  const [lastGeoError, setLastGeoError] = useState<{ code?: number; message?: string } | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [locatingSince, setLocatingSince] = useState<number | null>(null);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'ios') {
      try {
        setLocationStatus('requesting');
        if (Geolocation?.requestAuthorization) {
          const status = await Geolocation.requestAuthorization('whenInUse');
          const ok = status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
          setLocationStatus(ok ? 'idle' : 'denied');
          setPermissionStatus(ok ? 'granted' : 'denied');
          return ok;
        }
        setLocationStatus('idle');
        setPermissionStatus('granted');
        return true;
      } catch (error) {
        console.log('iOS location permission error:', error);
        setLocationStatus('error');
        setPermissionStatus('denied');
        return false;
      }
    }

    try {
      setLocationStatus('requesting');
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      const fineHas = await PermissionsAndroid.check(fine);
      const coarseHas = await PermissionsAndroid.check(coarse);
      if (fineHas || coarseHas) {
        setLocationStatus('idle');
        setPermissionStatus('granted');
        return true;
      }
      const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
      const fineGranted = results[fine] === PermissionsAndroid.RESULTS.GRANTED;
      const coarseGranted = results[coarse] === PermissionsAndroid.RESULTS.GRANTED;
      const granted = fineGranted || coarseGranted;
      setLocationStatus(granted ? 'idle' : 'denied');
      setPermissionStatus(granted ? 'granted' : 'denied');
      return granted;
    } catch (error) {
      console.log('Android location permission error:', error);
      setLocationStatus('error');
      setPermissionStatus('denied');
      return false;
    }
  }, []);

  const getPositionOnce = useCallback(
    (options: any) =>
      new Promise<{ lat: number; lon: number } | null>((resolve) => {
        Geolocation.getCurrentPosition(
          (position: any) => {
            const coords = {
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            };
            setLastGeoError(null);
            resolve(coords);
          },
          (error: any) => {
            console.log('Geolocation error:', error);
            setLastGeoError({ code: error?.code, message: error?.message });
            resolve(null);
          },
          options,
        );
      }),
    [],
  );

  const fetchLocation = useCallback(async () => {
    if (!Geolocation) {
      setLocationError('Geolocation is not available in this build.');
      setLocationStatus('error');
      return null;
    }
    const permitted = await requestLocationPermission();
    if (!permitted) {
      setLocationError('Location permission denied.');
      return null;
    }
    setLocationError(null);
    setLastGeoError(null);
    setLocationStatus('requesting');
    setLocatingSince(Date.now());
    // Try high accuracy first, then fallback to low accuracy
    const first = await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      forceRequestLocation: true,
    });
    if (first) {
      setCurrentLocation(first);
      setLocationStatus('fixed');
      return first;
    }

    const second = await getPositionOnce({
      enableHighAccuracy: false,
      timeout: 15000,
      maximumAge: 0,
      forceRequestLocation: true,
    });
    if (second) {
      setCurrentLocation(second);
      setLocationStatus('fixed');
      return second;
    }

    setLocationError('Unable to get a GPS fix. Try again outdoors.');
    setLocationStatus('requesting');
    return null;
  }, [requestLocationPermission]);

  useEffect(() => {
    // Kick off permission request on mount so status is known
    requestLocationPermission()
      .then((ok) => {
        if (ok) fetchLocation();
      })
      .catch(() => { });
  }, [requestLocationPermission]);

  useEffect(() => {
    let watchId: number | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const startWatch = async () => {
      if (!Geolocation) {
        setLocationError('Geolocation is not available in this build.');
        setLocationStatus('error');
        setPermissionStatus('denied');
        return;
      }
      const permitted = await requestLocationPermission();
      if (!permitted) return;
      setLocationStatus('requesting');
      setLocatingSince(Date.now());
      watchId = Geolocation.watchPosition(
        (position: any) => {
          const coords = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          };
          setLocationError(null);
          setLocationStatus('fixed');
          setCurrentLocation(coords);
        },
        (error: any) => {
          console.log('Geolocation watch error:', error);
          if (error?.code === 3) {
            setLocationStatus('requesting');
          } else {
            setLocationError('Unable to access location. Please enable GPS.');
            setLocationStatus('error');
          }
        },
        { enableHighAccuracy: true, distanceFilter: 10, interval: 10000, fastestInterval: 5000, forceRequestLocation: true },
      );

      // If watch doesn't yield, retry getCurrentPosition periodically
      retryTimer = setInterval(() => {
        if (!currentLocation) fetchLocation();
      }, 15000);
    };

    startWatch();
    return () => {
      if (Geolocation && watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
      if (retryTimer) clearInterval(retryTimer);
    };
  }, [requestLocationPermission, fetchLocation, currentLocation]);

  const loadNearbyHelp = useCallback(async (lat: number, lon: number, type: SOSType) => {
    setLoadingHelp(true);
    try {
      const results = await sosService.getNearbyHelp(lat, lon, type);
      setNearbyHelp(results.slice(0, 5));
    } catch (error: any) {
      console.log('Nearby help error:', error?.message || error);
      setNearbyHelp([]);
    } finally {
      setLoadingHelp(false);
    }
  }, []);

  useEffect(() => {
    fetchLocation().then((coords) => {
      if (coords) {
        loadNearbyHelp(coords.lat, coords.lon, 'MEDICAL');
      }
    });
  }, [fetchLocation, loadNearbyHelp]);

  const gpsOff = locationStatus === 'denied' && !currentLocation;
  const locationLabel = currentLocation
    ? `${currentLocation.lat.toFixed(3)}, ${currentLocation.lon.toFixed(3)}`
    : locationStatus === 'requesting'
      ? 'Requesting...'
      : 'Locating...';

  const showRetryHint =
    !currentLocation &&
    (locationStatus === 'idle' || locationStatus === 'requesting') &&
    locatingSince != null &&
    Date.now() - locatingSince > 15000;

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const list = await sosService.getContacts();
      setContacts(list);
    } catch (error: any) {
      console.log('Contacts fetch error:', error?.message || error);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleAddContact = useCallback(async () => {
    if (addingContact) return;
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert('Missing details', 'Name and phone number are required.');
      return;
    }
    setAddingContact(true);
    try {
      await sosService.addContact({
        name: newContactName.trim(),
        phoneNumber: newContactPhone.trim(),
        relation: newContactRelation.trim() || undefined,
      });
      setNewContactName('');
      setNewContactPhone('');
      setNewContactRelation('');
      await loadContacts();
      Alert.alert('Contact added', 'Emergency contact saved.');
    } catch (error: any) {
      Alert.alert('Add failed', error?.message || 'Unable to add contact.');
    } finally {
      setAddingContact(false);
    }
  }, [addingContact, newContactName, newContactPhone, newContactRelation, loadContacts]);

  const handleDeleteContact = useCallback(async (id: string) => {
    try {
      await sosService.deleteContact(id);
      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (error: any) {
      Alert.alert('Delete failed', error?.message || 'Unable to delete contact.');
    }
  }, []);

  const ensureLocation = useCallback(async () => {
    if (currentLocation) return currentLocation;
    return fetchLocation();
  }, [currentLocation, fetchLocation]);

  const handleSOS = useCallback(async () => {
    if (sendingSOS) return;
    setSendingSOS(true);
    try {
      const coords = await ensureLocation();
      if (!coords) {
        Alert.alert('Location required', 'Enable GPS to trigger SOS.');
        return;
      }
      await sosService.createSOS({
        latitude: coords.lat,
        longitude: coords.lon,
        type: 'OTHER',
        metadata: {
          source: 'MOBILE_SOS_SCREEN',
          triggeredAt: new Date().toISOString(),
        },
      });
      Alert.alert('Emergency triggered', 'Your SOS has been sent to the backend.');
    } catch (error: any) {
      Alert.alert('SOS failed', error?.message || 'Unable to trigger SOS. Please try again.');
    } finally {
      setSendingSOS(false);
    }
  }, [ensureLocation, sendingSOS]);

  const makeCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const openMap = (lat: number, lon: number, label?: string) => {
    const query = encodeURIComponent(label || 'Help');
    const url = Platform.select({
      ios: `maps://?q=${query}&ll=${lat},${lon}`,
      android: `geo:${lat},${lon}?q=${lat},${lon}(${query})`,
    });
    if (url) Linking.openURL(url);
  };

  const openAppSettings = useCallback(() => {
    Linking.openSettings();
  }, []);


  type ActionButtonProps = {
    icon: string;
    label: string;
    color: string;
    onPress?: () => void;
  };

  const ActionButton = ({ icon, label, color, onPress }: ActionButtonProps) => (
    <TouchableOpacity style={styles.action} onPress={onPress}>
      <View style={[styles.circle, { backgroundColor: color }]}>
        <Ionicons name={icon} size={28} color="#111" />
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <Image
            source={{ uri: "https://m.media-amazon.com/images/I/41EjjV414pL.jpg" }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.title}>Hello, Shree!</Text>
            <Text style={styles.subTitle}>Stay protected wherever you are</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate("Alerts")} style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={20} color="#FFBF00" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroBadge, gpsOff && styles.heroBadgeWarning]}>
              <Ionicons name="shield-checkmark-outline" size={14} color={gpsOff ? "#ef4444" : "#22c55e"} />
              <Text style={styles.heroBadgeText}>
                {gpsOff ? 'GPS Off' : 'Protected'}
              </Text>
            </View>
            <TouchableOpacity style={styles.heroChip} onPress={fetchLocation}>
              <Ionicons name="location-outline" size={14} color="#FFBF00" />
              <Text style={styles.heroChipText}>
                {showRetryHint ? 'Tap to retry' : locationLabel}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.sosRing}>
            <View style={styles.sosOuter}>
              <TouchableOpacity
                style={styles.sosButton}
                onLongPress={handleSOS}
                delayLongPress={1500}
              >
                <Ionicons name="alert" size={38} color="#000" />
                <Text style={styles.sosText}>SOS</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>
            {sendingSOS ? 'Sending SOS...' : 'Long press for 1.5s to trigger'}
          </Text>
          {(gpsOff || showRetryHint) && (
            <TouchableOpacity style={styles.settingsButton} onPress={openAppSettings}>
              <Ionicons name="settings-outline" size={16} color="#111" />
              <Text style={styles.settingsButtonText}>Open Settings</Text>
            </TouchableOpacity>
          )}
          {lastGeoError?.message && (
            <Text style={styles.debugText}>
              GPS: {lastGeoError.code ?? '-'} • {lastGeoError.message}
            </Text>
          )}
          <Text style={styles.debugText}>
            Permission: {permissionStatus} • Status: {locationStatus}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <Text style={styles.sectionMeta}>Fast access</Text>
          </View>
          <View style={styles.row}>
            <ActionButton
              icon="location-outline"
              label={"Share\nLocation"}
              color="#22c55e"
              onPress={async () => {
                const coords = await ensureLocation();
                if (!coords) {
                  Alert.alert('Location unavailable', 'Unable to access GPS.');
                  return;
                }
                Alert.alert(
                  'Location Ready',
                  `Lat ${coords.lat.toFixed(4)}, Lon ${coords.lon.toFixed(4)}`,
                );
              }}
            />

            <ActionButton
              icon="people-outline"
              label={"Alert\nFamily"}
              color="#f97316"
              onPress={handleSOS}
            />

            <ActionButton
              icon="call-outline"
              label={"Call\nPolice"}
              color="#3b82f6"
              onPress={() => makeCall("100")}
            />
          </View>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {loadingHelp ? 'Searching Nearby Help...' : (nearbyHelp.length ? 'Nearby Help' : 'Nearby Safe Zones')}
            </Text>
            <Text style={styles.sectionMeta}>5 km radius</Text>
          </View>

          {nearbyHelp.length ? (
            nearbyHelp.map((item, index) => {
              const lat = item.location?.lat;
              const lon = item.location?.lng;
              return (
                <TouchableOpacity
                  key={`${item.placeId || item.name || 'help'}-${index}`}
                  style={styles.safeZoneItem}
                  onPress={() => (lat && lon ? openMap(lat, lon, item.name) : undefined)}
                >
                  <Ionicons name="navigate-outline" size={22} color="#22c55e" />
                  <View style={styles.safeZoneTextWrap}>
                    <Text style={styles.safeZoneText}>{item.name || 'Nearby Help'}</Text>
                    {!!item.address && <Text style={styles.safeZoneSubText}>{item.address}</Text>}
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <>
              <TouchableOpacity style={styles.safeZoneItem} onPress={() => makeCall("100")}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#3b82f6" />
                <Text style={styles.safeZoneText}>Police Station</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.safeZoneItem} onPress={() => makeCall("102")}>
                <Ionicons name="medkit-outline" size={22} color="#ef4444" />
                <Text style={styles.safeZoneText}>Hospital / Ambulance</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.safeZoneItem} onPress={() => makeCall("101")}>
                <Ionicons name="flame-outline" size={22} color="#f97316" />
                <Text style={styles.safeZoneText}>Fire Station</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.safeZoneItem} onPress={() => makeCall("112")}>
                <Ionicons name="call-outline" size={22} color="#22c55e" />
                <Text style={styles.safeZoneText}>National Emergency</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <Text style={styles.sectionMeta}>Trusted people</Text>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              placeholder="Name"
              placeholderTextColor="#7c7c7c"
              style={styles.input}
              value={newContactName}
              onChangeText={setNewContactName}
            />
            <TextInput
              placeholder="Phone"
              placeholderTextColor="#7c7c7c"
              style={styles.input}
              keyboardType="phone-pad"
              value={newContactPhone}
              onChangeText={setNewContactPhone}
            />
          </View>
          <View style={styles.inputRow}>
            <TextInput
              placeholder="Relation (optional)"
              placeholderTextColor="#7c7c7c"
              style={styles.input}
              value={newContactRelation}
              onChangeText={setNewContactRelation}
            />
            <TouchableOpacity
              style={[styles.addButton, addingContact && styles.addButtonDisabled]}
              onPress={handleAddContact}
              disabled={addingContact}
            >
              <Text style={styles.addButtonText}>{addingContact ? 'Adding...' : 'Add'}</Text>
            </TouchableOpacity>
          </View>

          {contactsLoading ? (
            <Text style={styles.mutedText}>Loading contacts...</Text>
          ) : contacts.length ? (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>
                    {contact.name?.trim()?.slice(0, 2)?.toUpperCase() || 'EC'}
                  </Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactMeta}>
                    {contact.phoneNumber}
                    {contact.relation ? ` • ${contact.relation}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteContact(contact.id)}>
                  <Ionicons name="trash-outline" size={22} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <Text style={styles.mutedText}>No contacts added yet.</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default SOSButton

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000000",
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(4),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(3),
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "#fff",
  },
  title: {
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.8),
  },
  subTitle: {
    color: "rgba(255,255,255,0.6)",
    fontSize: wp(3.3),
    fontFamily: 'Outfit-Medium',
    marginTop: hp(0.2),
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#111",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroCard: {
    backgroundColor: "#121212",
    marginHorizontal: wp(5),
    borderRadius: wp(6),
    padding: wp(5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowColor: "#FFBF00",
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: hp(2),
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    backgroundColor: "rgba(34, 197, 94, 0.15)",
    paddingHorizontal: wp(3.2),
    paddingVertical: hp(0.5),
    borderRadius: wp(5),
  },
  heroBadgeWarning: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  heroBadgeText: {
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    backgroundColor: "#1a1a1a",
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: wp(5),
  },
  heroChipText: {
    color: "#FFBF00",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  sosRing: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: hp(1.5),
  },
  sosOuter: {
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: "rgba(255, 191, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 191, 0, 0.2)",
  },
  sosButton: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "#FFBF00",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFBF00",
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 15,
  },
  sosText: {
    fontSize: 32,
    fontFamily: "Outfit-Black",
    color: "#000",
    letterSpacing: 1.5,
    marginTop: 2,
  },
  hint: {
    marginTop: hp(1.5),
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.4),
  },
  settingsButton: {
    marginTop: hp(1.2),
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: wp(2),
    backgroundColor: "rgba(255, 191, 0, 0.15)",
    borderWidth: 1,
    borderColor: "#FFBF00",
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: wp(5),
  },
  settingsButtonText: {
    color: "#FFBF00",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },
  debugText: {
    marginTop: hp(0.6),
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3),
  },
  sectionCard: {
    backgroundColor: "#121212",
    marginHorizontal: wp(5),
    marginTop: hp(2.5),
    padding: wp(5),
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(2.5),
  },
  sectionTitle: {
    fontSize: wp(4.8),
    color: "#fff",
    fontFamily: 'Outfit-Bold',
  },
  sectionMeta: {
    color: "#FFBF00",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  action: {
    alignItems: "center",
    width: 95,
    backgroundColor: "#1a1a1a",
    paddingVertical: hp(1.5),
    borderRadius: wp(4.5),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  circle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  label: {
    color: "#fff",
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    textAlign: 'center',
  },
  /* Safe Zones */
  safeZoneItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    padding: wp(4),
    borderRadius: wp(4),
    marginBottom: hp(1.2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  safeZoneTextWrap: {
    flex: 1,
    marginLeft: wp(3.5),
  },
  safeZoneText: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
  },
  safeZoneSubText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    marginTop: hp(0.2),
  },
  /* Inputs */
  inputRow: {
    flexDirection: "row",
    gap: wp(3),
    marginBottom: hp(1.5),
  },
  input: {
    flex: 1,
    backgroundColor: "#000",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    color: "#fff",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.8),
  },
  addButton: {
    flex: 0.6,
    backgroundColor: "#FFBF00",
    borderRadius: wp(3),
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  addButtonText: {
    color: "#000",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4),
  },
  /* Contacts */
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1a1a1a",
    padding: wp(4),
    borderRadius: wp(4),
    marginTop: hp(1.2),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  contactAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 191, 0, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(3.5),
  },
  contactAvatarText: {
    color: "#FFBF00",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.5),
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
  },
  contactMeta: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.2),
  },
  mutedText: {
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    fontFamily: 'Outfit-Regular',
    marginTop: hp(2),
  }
})
