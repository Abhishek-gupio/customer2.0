import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  Animated,
  Vibration,
  Image,
  ActivityIndicator,
  Linking,
  Platform,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { sosService, type EmergencyContact, type NearbyHelpItem, type SOSType } from '../../services/sosService';
import { googleMapsService } from '../../services/googleMapsService';
import { FlashList } from '@shopify/flash-list';
const FlashListAny = FlashList as any;
import { getProfile } from '../../services/profileService';
import { getAbsoluteUrl } from '../../config';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

// Removed Geolocation logic

const SOS_TYPE_OPTIONS: SOSType[] = ['MEDICAL', 'POLICE', 'FIRE', 'ACCIDENT', 'MECHANICAL'];

const INCIDENT_GUIDES: Record<SOSType, { title: string; steps: string[] }> = {
  MEDICAL: {
    title: 'Medical response',
    steps: [
      'Trigger SOS and keep the phone unlocked so responders can reach you.',
      'Call an ambulance if the patient needs immediate transport.',
      'Share your live location with a trusted contact and stay visible.',
    ],
  },
  POLICE: {
    title: 'Police support',
    steps: [
      'Trigger SOS first so your trusted contacts get your location immediately.',
      'Move to a safer public area if you can do so without escalating risk.',
      'Call police and keep note of landmarks or vehicle details around you.',
    ],
  },
  FIRE: {
    title: 'Fire response',
    steps: [
      'Get clear of smoke and heat before doing anything else.',
      'Trigger SOS so your contacts know your exact position.',
      'Call the fire service and warn anyone nearby if it is safe.',
    ],
  },
  ACCIDENT: {
    title: 'Accident support',
    steps: [
      'Trigger SOS and share your live location with family or support.',
      'Call emergency services if anyone is injured or traffic is unsafe.',
      'Stay visible, move to the shoulder if possible, and wait for help.',
    ],
  },
  MECHANICAL: {
    title: 'Breakdown help',
    steps: [
      'Trigger SOS if you are stranded in an unsafe area or at night.',
      'Share your location with a trusted contact before you step out.',
      'Use nearby help and map actions to find the fastest response option.',
    ],
  },
  OTHER: {
    title: 'Emergency support',
    steps: [
      'Trigger SOS to alert your trusted contacts immediately.',
      'Share your live location so someone can track where you are.',
      'Use the quickest call option that matches the situation.',
    ],
  },
};

function openLocationInMaps(latitude: number, longitude: number, label: string) {
  const destination = `${latitude},${longitude}`;
  const encodedLabel = encodeURIComponent(label);
  const url = Platform.OS === 'ios'
    ? `https://maps.apple.com/?ll=${destination}&q=${encodedLabel}`
    : `geo:${destination}?q=${destination}(${encodedLabel})`;

  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${destination}`).catch(() => {});
  });
}

const SOSScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  
  // State
  const [location, setLocation] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [address, setAddress] = useState<string>('Searching location...');
  const [message, setMessage] = useState<string>('EMERGENCY: I need immediate assistance!');
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [triggering, setTriggering] = useState<boolean>(false);
  const [sosType, setSosType] = useState<SOSType>('OTHER');
  const [nearbyHelp, setNearbyHelp] = useState<NearbyHelpItem[]>([]);
  const [searchingHelp, setSearchingHelp] = useState<boolean>(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('');

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Map Ref
  const mapRef = useRef<MapView>(null);
  const locationInterval = useRef<any>(null);
  const primaryContact = contacts[0] || null;
  const incidentGuide = INCIDENT_GUIDES[sosType] || INCIDENT_GUIDES.OTHER;

  // Initialize
  const fetchInitialData = React.useCallback(async () => {
    try {
      const [contactList, activeSOS, profileData] = await Promise.all([
        sosService.getContacts(),
        sosService.getActiveSOS(),
        getProfile().catch(() => null),
      ]);

      setContacts(contactList);

      if (profileData) {
        setProfileName(profileData.fullName || '');
        if (profileData.profilePic) {
          setProfilePic(getAbsoluteUrl(profileData.profilePic));
        }
      }

      if (activeSOS) {
        navigation.replace('ActiveSOS', {
          sosId: activeSOS.id,
          type: activeSOS.type,
          lat: activeSOS.latitude,
          lon: activeSOS.longitude
        });
      }
    } catch (error) {
      console.error('SOS Init Error:', error);
    } finally {
      setLoading(false);
    }
  }, [navigation]);

  const fetchNearbyHelp = React.useCallback(async () => {
    if (!location || searchingHelp) return;
    setSearchingHelp(true);
    try {
      // Hits the backend which now uses Google Maps Places API seamlessly
      const results = await sosService.getNearbyHelp(location.latitude, location.longitude, sosType);
      setNearbyHelp(results);
      
      // Animate map to show bounds if needed
      if (mapRef.current && results.length > 0 && location) {
        const coords = results.filter((r) => r.location).map((r) => ({
            latitude: r.location!.lat,
            longitude: r.location!.lng,
        }));
        coords.push({ latitude: location.latitude, longitude: location.longitude });
        
        mapRef.current.fitToCoordinates(coords, {
          edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
          animated: true,
        });
      }
    } catch (error) {
      console.log('Nearby Help Error:', error);
    } finally {
      setSearchingHelp(false);
    }
  }, [location, searchingHelp, sosType]);

  const fetchAccurateLocation = React.useCallback(async () => {
    try {
      const coords = await googleMapsService.getCurrentLocation();
      setLocation(coords);
      
      const addr = await googleMapsService.getAddress(coords.latitude, coords.longitude);
      setAddress(addr);
      
      if (mapRef.current) {
         mapRef.current.animateToRegion({
            latitude: coords.latitude,
            longitude: coords.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
         }, 1000);
      }
    } catch (error) {
      console.log('Location Error:', error);
    }
  }, []);

  const startLocationTracking = React.useCallback(() => {
    fetchAccurateLocation();
    
    // Auto update every 30 seconds
    locationInterval.current = setInterval(() => {
      fetchAccurateLocation();
    }, 30000);
  }, [fetchAccurateLocation]);

  const startPulse = React.useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  useEffect(() => {
    fetchInitialData();
    startPulse();
    startLocationTracking();
    
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, [fetchInitialData, startLocationTracking, startPulse]);

  // Fetch Nearby help whenever type or first location is set
  useEffect(() => {
    if (location) {
      fetchNearbyHelp();
    }
  }, [fetchNearbyHelp, location]);

  const handleTriggerSOS = async () => {
    console.log('[SOSScreen] SOS Trigger Pressed');
    if (triggering) {
      console.log('[SOSScreen] Already triggering, returning early');
      return;
    }
    if (!location) {
      console.warn('[SOSScreen] Location missing, cannot trigger SOS');
      Alert.alert('Location Required', 'Please wait until your location is acquired.');
      return;
    }

    setTriggering(true);
    Vibration.vibrate([0, 500, 200, 500]);

    try {
      console.log(`[SOSScreen] Triggering SOS with type: ${sosType} at Lat: ${location.latitude}, Lon: ${location.longitude}`);
      const response = await sosService.triggerSOS({
        location,
        message,
        type: sosType,
      });

      console.log(`[SOSScreen] SOS Trigger response success:`, response.success);
      if (response.success) {
        navigation.replace('ActiveSOS', {
          sosId: response.sosAlertId,
          type: sosType,
          lat: location.latitude,
          lon: location.longitude,
        });
      }
    } catch (error: any) {
      console.error('[SOSScreen] Failed to trigger SOS:', error);
      Alert.alert('SOS Failed', error.message || 'Unable to send SOS. Check your connection.');
    } finally {
      setTriggering(false);
    }
  };

  const handleCallPolice = () => {
    console.log('[SOSScreen] Quick Action: Calling Police');
    Linking.openURL('tel:100');
  };

  const handleCallAmbulance = () => {
    console.log('[SOSScreen] Quick Action: Calling Ambulance');
    Linking.openURL('tel:102');
  };

  const handleCallFire = () => {
    console.log('[SOSScreen] Quick Action: Calling Fire');
    Linking.openURL('tel:101');
  };

  const handleCallPrimaryContact = () => {
    if (!primaryContact?.phoneNumber) {
      Alert.alert('No Contact Ready', 'Add an emergency contact in your profile to use this shortcut.');
      return;
    }
    Linking.openURL(`tel:${primaryContact.phoneNumber}`);
  };

  const handleShareLocation = async () => {
    if (!location) {
      Alert.alert('Location Pending', 'Please wait until your live location is available.');
      return;
    }

    const mapUrl = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
    try {
      await Share.share({
        message: `${message}\n\nEmergency type: ${sosType}\nLocation: ${address}\n${mapUrl}`,
      });
    } catch {
      // Ignore user cancel
    }
  };

  const handleOpenCurrentLocation = () => {
    if (!location) {
      Alert.alert('Location Pending', 'We are still fetching your current location.');
      return;
    }
    openLocationInMaps(location.latitude, location.longitude, address || 'My Location');
  };

  const handleOpenNearbyResource = (item: NearbyHelpItem) => {
    if (!item?.location) {
      Alert.alert(item?.name || 'Nearby resource', item?.address || 'Location details are not available yet.');
      return;
    }
    openLocationInMaps(item.location.lat, item.location.lng, item.name || 'Nearby Help');
  };

  // Map UI logic removed since using react-native-maps directly

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerTitleGroup}>
            <Text style={styles.title}>EMERGENCY SOS</Text>
            <Text style={styles.subTitle}>
              {profileName ? `${profileName.split(' ')[0]}, support is ready 24/7` : 'Ready to assist 24/7'}
            </Text>
          </View>
        </View>
        {/* Profile Photo */}
        {profilePic ? (
          <Image
            source={{ uri: profilePic }}
            style={styles.headerAvatar}
          />
        ) : (
          <View style={styles.headerAvatarPlaceholder}>
            <Ionicons name="person" size={18} color="rgba(255,255,255,0.6)" />
          </View>
        )}
      </View>
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#5F9EA0" />
          <Text style={styles.loadingBannerText}>Initializing Secure SOS...</Text>
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Section */}
        <View style={styles.mapContainer}>
          {location ? (
             <MapView
               ref={mapRef}
               provider={PROVIDER_GOOGLE}
               style={styles.map}
               initialRegion={{
                 latitude: location?.latitude || 0,
                 longitude: location?.longitude || 0,
                 latitudeDelta: 0.01,
                 longitudeDelta: 0.01,
               }}
               showsUserLocation={true}
               showsMyLocationButton={false}
               showsCompass={false}
             >
               <Marker 
                 coordinate={{ latitude: location.latitude, longitude: location.longitude }}
                 title="Your Current Location" 
                 pinColor="#5F9EA0" 
               />
               
               {nearbyHelp.map((item, index) => item.location && (
                  <Marker
                    key={index}
                    coordinate={{ latitude: item.location.lat, longitude: item.location.lng }}
                    title={item.name}
                    description={item.type?.toUpperCase()}
                    pinColor={getNearbyColor(item.type)}
                  />
               ))}
             </MapView>
          ) : (
             <View style={styles.locationPendingWrap}>
                 <ActivityIndicator size="small" color="#5F9EA0" />
                 <Text style={styles.locationPendingText}>Getting accurate location...</Text>
             </View>
          )}
          <View style={styles.heroBadge}>
            <Ionicons name="location" size={14} color="#fff" />
            <Text style={styles.heroBadgeText}>{address}</Text>
          </View>
        </View>

        {/* Premium SOS Panel */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={[styles.heroBadge, styles.heroBadgeWarning]}>
              <Ionicons name="shield-checkmark" size={14} color="#fff" />
              <Text style={styles.heroBadgeText}>ENCRYPTED</Text>
            </View>
            <View style={styles.heroChip}>
              <Ionicons name="flash" size={14} color="#5F9EA0" />
              <Text style={styles.heroChipText}>Priority 1</Text>
            </View>
          </View>

          {/* Dynamic SOS Trigger */}
          <View style={styles.sosRing}>
            <Animated.View style={[styles.pulseRing, styles.pulseRingVisible, { transform: [{ scale: pulseAnim }] }]} />
            <View style={styles.sosOuter}>
              <TouchableOpacity
                style={[styles.sosButton, triggering && styles.sosButtonDisabled]}
                onPress={handleTriggerSOS}
                activeOpacity={0.8}
                disabled={triggering}
              >
                {triggering ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.sosText}>SOS</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>{triggering ? 'Contacting Emergency Services' : 'Tap to trigger emergency support'}</Text>
        </View>

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Incident Mode</Text>
            <Text style={styles.sectionMeta}>{incidentGuide.title}</Text>
          </View>

          <View style={styles.readinessRow}>
            <View style={styles.readinessChip}>
              <Text style={styles.readinessValue}>{contacts.length}</Text>
              <Text style={styles.readinessLabel}>contacts ready</Text>
            </View>
            <View style={styles.readinessChip}>
              <Text style={styles.readinessValue}>{nearbyHelp.length}</Text>
              <Text style={styles.readinessLabel}>nearby options</Text>
            </View>
            <View style={styles.readinessChip}>
              <Text style={styles.readinessValue}>{location ? 'Live' : '...'}</Text>
              <Text style={styles.readinessLabel}>location lock</Text>
            </View>
          </View>

          <View style={styles.incidentActionRow}>
            <TouchableOpacity style={styles.incidentActionBtn} onPress={handleShareLocation}>
              <Ionicons name="share-social" size={18} color="#5F9EA0" />
              <Text style={styles.incidentActionText}>Share location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.incidentActionBtn} onPress={handleOpenCurrentLocation}>
              <Ionicons name="map" size={18} color="#5F9EA0" />
              <Text style={styles.incidentActionText}>Open map</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.incidentActionBtn} onPress={handleCallPrimaryContact}>
              <Ionicons name="call" size={18} color="#5F9EA0" />
              <Text style={styles.incidentActionText}>Call contact</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.guideList}>
            {incidentGuide.steps.map((step, index) => (
              <View key={`${sosType}-${index}`} style={styles.guideItem}>
                <View style={styles.guideIndex}>
                  <Text style={styles.guideIndexText}>{index + 1}</Text>
                </View>
                <Text style={styles.guideText}>{step}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Call Actions</Text>
          <View style={styles.quickActionRow}>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallPolice}>
              <View style={[styles.quickActionIcon, styles.quickActionIconPolice]}>
                <Ionicons name="shield" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.quickActionText}>Police</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallAmbulance}>
              <View style={[styles.quickActionIcon, styles.quickActionIconAmbulance]}>
                <Ionicons name="medkit" size={24} color="#ef4444" />
              </View>
              <Text style={styles.quickActionText}>Ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallFire}>
              <View style={[styles.quickActionIcon, styles.quickActionIconFire]}>
                <Ionicons name="flame" size={24} color="#f97316" />
              </View>
              <Text style={styles.quickActionText}>Fire</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Message Input */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Emergency Message</Text>
          <TextInput
            style={styles.input}
            value={message}
            onChangeText={setMessage}
            multiline
            placeholder="Type your emergency here..."
            placeholderTextColor="rgba(255,255,255,0.3)"
          />
        </View>

        {/* Resource Selection */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Select Assistance Type</Text>
          <View style={styles.typeGrid}>
            {SOS_TYPE_OPTIONS.map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, sosType === type && styles.typeButtonActive]}
                onPress={() => setSosType(type)}
                disabled={triggering}
              >
                <Ionicons 
                  name={getIconForType(type)} 
                  size={18} 
                  color={sosType === type ? '#000' : '#5F9EA0'} 
                />
                <Text style={[styles.typeText, sosType === type && styles.typeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby Resources Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Response Resources</Text>
            {searchingHelp && <ActivityIndicator size="small" color="#5F9EA0" />}
          </View>

          {nearbyHelp.length === 0 ? (
            <Text style={styles.mutedText}>
              {searchingHelp ? 'Searching for nearby help...' : 'No nearby services found in 5km.'}
            </Text>
          ) : (
            <FlashListAny
              horizontal
              data={nearbyHelp}
              estimatedItemSize={wp(30)}
              renderItem={({ item }: { item: NearbyHelpItem }) => (
                <TouchableOpacity
                   style={styles.nearbyItem}
                   onPress={() => handleOpenNearbyResource(item)}
                >
                  <View style={[styles.nearbyIcon, { backgroundColor: getNearbyColor(item.type) }]}>
                    <Ionicons name={getNearbyIcon(item.type)} size={20} color="#fff" />
                  </View>
                  <Text style={styles.nearbyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.nearbyType}>{(item.type || 'help').toUpperCase()}</Text>
                  <Text style={styles.nearbyMeta}>Open route</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        {/* Contacts Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('MyProfile')}>
              <Text style={styles.sectionMeta}>MANAGE</Text>
            </TouchableOpacity>
          </View>
          
          {contacts.length === 0 ? (
            <Text style={styles.mutedText}>No contacts added yet. Edit in Profile Settings.</Text>
          ) : (
            contacts.map((contact) => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactAvatarText}>{contact.name.substring(0, 1)}</Text>
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactMeta}>{contact.phoneNumber}</Text>
                </View>
                <View style={styles.contactActionRow}>
                   <Ionicons 
                    name="call" 
                    size={18} 
                    color="rgba(255, 255, 255, 0.4)" 
                    onPress={() => Linking.openURL(`tel:${contact.phoneNumber}`)} 
                  />
                  <Ionicons 
                    name="mail" 
                    size={18} 
                    color={contact.email ? "#5F9EA0" : "rgba(255, 255, 255, 0.2)"} 
                    onPress={() => {
                      if (contact.email) {
                        Linking.openURL(`mailto:${contact.email}?subject=Emergency Update`);
                      }
                    }}
                  />
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const getIconForType = (type: SOSType) => {
  switch (type) {
    case 'MEDICAL': return 'medkit';
    case 'POLICE': return 'shield';
    case 'FIRE': return 'flame';
    case 'ACCIDENT': return 'car';
    case 'MECHANICAL': return 'build';
    default: return 'alert-circle';
  }
};

const getNearbyColor = (type?: string) => {
  switch (type) {
    case 'hospital': return '#ef4444';
    case 'police': return '#3b82f6';
    case 'fire_station': return '#f97316';
    default: return '#4a7c7e';
  }
};

const getNearbyIcon = (type?: string) => {
  switch (type) {
    case 'hospital': return 'medkit';
    case 'police': return 'shield';
    case 'fire_station': return 'flame';
    default: return 'location';
  }
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#000",
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loaderText: {
    marginTop: 20,
    color: '#5F9EA0',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 10,
  },
  loadingBannerText: {
    color: '#5F9EA0',
    fontSize: wp(3.4),
    fontFamily: 'Outfit-Medium',
    marginTop: hp(1.2),
    textAlign: 'center',
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
  headerTitleGroup: {
    flex: 1,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#5F9EA0',
  },
  headerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
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
  scrollContent: {
    paddingBottom: hp(4),
  },
  mapContainer: {
    height: hp('30%'),
    width: wp('90%'),
    alignSelf: 'center',
    borderRadius: wp(6),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.2)',
    marginBottom: hp(2),
  },
  map: {
    flex: 1,
  },
  locationPendingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
  },
  locationPendingText: {
    color: '#fff',
    marginTop: 10,
  },
  heroCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    marginHorizontal: wp(5),
    borderRadius: wp(6),
    padding: wp(6),
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
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
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(5),
    position: 'absolute',
    bottom: 10,
    left: 10,
  },
  heroBadgeWarning: {
    backgroundColor: "rgba(255, 79, 0, 0.1)",
    borderColor: "rgba(255, 79, 0, 0.3)",
    position: 'relative',
    bottom: 0,
    left: 0,
  },
  heroBadgeText: {
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },
  heroChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: wp(1.5),
    backgroundColor: "rgba(95, 158, 160, 0.16)",
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(5),
  },
  heroChipText: {
    color: "#5F9EA0",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.4),
  },
  sosRing: {
    alignItems: "center",
    justifyContent: "center",
    height: 180,
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#5F9EA0',
  },
  pulseRingVisible: {
    opacity: 0.3,
  },
  sosOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(95, 158, 160, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(95, 158, 160, 0.2)",
  },
  sosButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#5F9EA0",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#5F9EA0",
    shadowOpacity: 0.8,
    shadowRadius: 20,
    elevation: 15,
  },
  sosButtonDisabled: {
    backgroundColor: "#666",
    shadowOpacity: 0.2,
  },
  sosText: {
    fontSize: 24,
    fontFamily: "Outfit-Black",
    color: "#000",
    letterSpacing: 1,
  },
  hint: {
    marginTop: hp(1),
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.4),
  },
  sectionCard: {
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    marginHorizontal: wp(5),
    marginTop: hp(2),
    padding: wp(5),
    borderRadius: wp(6),
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(2),
  },
  sectionTitle: {
    fontSize: wp(4.2),
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    marginBottom: hp(1.5),
  },
  sectionMeta: {
    color: "#5F9EA0",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  quickActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  readinessRow: {
    flexDirection: 'row',
    gap: wp(2.2),
  },
  readinessChip: {
    flex: 1,
    backgroundColor: '#111',
    borderRadius: wp(4),
    paddingVertical: hp(1.4),
    paddingHorizontal: wp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  readinessValue: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.4),
    textAlign: 'center',
  },
  readinessLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.7),
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: hp(0.5),
    letterSpacing: 0.5,
  },
  incidentActionRow: {
    flexDirection: 'row',
    gap: wp(2),
    marginTop: hp(2),
  },
  incidentActionBtn: {
    flex: 1,
    backgroundColor: 'rgba(95, 158, 160,0.12)',
    borderRadius: wp(4),
    paddingVertical: hp(1.4),
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.3)',
    gap: hp(0.6),
  },
  incidentActionText: {
    color: '#5F9EA0',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.8),
    textAlign: 'center',
  },
  guideList: {
    marginTop: hp(2.2),
    gap: hp(1.2),
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  guideIndex: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(95, 158, 160,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    marginTop: 1,
  },
  guideIndexText: {
    color: '#5F9EA0',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.9),
  },
  guideText: {
    flex: 1,
    color: 'rgba(255,255,255,0.78)',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.2),
    lineHeight: hp(2.1),
  },
  input: {
    backgroundColor: "#111",
    borderRadius: wp(4),
    padding: wp(4),
    color: "#fff",
    fontFamily: 'Outfit-Regular',
    minHeight: hp(10),
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    paddingVertical: hp(1),
    paddingHorizontal: wp(4),
    borderRadius: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.2)',
  },
  typeButtonActive: {
    backgroundColor: '#5F9EA0',
    borderColor: '#5F9EA0',
  },
  typeText: {
    marginLeft: wp(2),
    color: '#5F9EA0',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
  },
  typeTextActive: {
    color: '#000',
  },
  nearbyScroll: {
    marginTop: hp(1),
  },
  nearbyItem: {
    backgroundColor: '#111',
    padding: wp(3),
    borderRadius: wp(4),
    marginRight: wp(3),
    width: wp(35),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  nearbyIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  nearbyName: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  nearbyType: {
    color: 'rgba(255,255,255,0.4)',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.6),
    marginTop: 2,
  },
  nearbyMeta: {
    color: '#5F9EA0',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.6),
    marginTop: hp(0.7),
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#111",
    padding: wp(4),
    borderRadius: wp(5),
    marginBottom: hp(1),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(95, 158, 160, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(3),
  },
  contactAvatarText: {
    color: "#5F9EA0",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.5),
  },
  contactInfo: {
    flex: 1,
  },
  contactActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  contactName: {
    color: "#fff",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.8),
  },
  contactMeta: {
    color: "rgba(255,255,255,0.5)",
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3),
  },
  mutedText: {
    color: "rgba(255,255,255,0.3)",
    textAlign: "center",
    fontFamily: 'Outfit-Regular',
    paddingVertical: hp(2),
  },
  quickActionButton: {
    alignItems: 'center',
    gap: 8,
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionIconPolice: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  quickActionIconAmbulance: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
  },
  quickActionIconFire: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
  },
  quickActionText: {
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
  },
});

export default SOSScreen;
