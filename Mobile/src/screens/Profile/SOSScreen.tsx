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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { sosService, type EmergencyContact, type SOSType } from '../../services/sosService';
import { googleMapsService } from '../../services/googleMapsService';
import { getProfile } from '../../services/profileService';
import { getAbsoluteUrl } from '../../config';

// Removed Geolocation logic

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
  const [nearbyHelp, setNearbyHelp] = useState<any[]>([]);
  const [searchingHelp, setSearchingHelp] = useState<boolean>(false);
  const [profilePic, setProfilePic] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string>('');

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Map Ref
  const mapRef = useRef<MapView>(null);
  const locationInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize
  useEffect(() => {
    fetchInitialData();
    startPulse();
    startLocationTracking();
    
    return () => {
      if (locationInterval.current) {
        clearInterval(locationInterval.current);
      }
    };
  }, []);

  // Fetch Nearby help whenever type or first location is set
  useEffect(() => {
    if (location) {
      fetchNearbyHelp();
    }
  }, [sosType, location?.latitude]);

  const fetchInitialData = async () => {
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
  };

  const fetchNearbyHelp = async () => {
    if (!location || searchingHelp) return;
    setSearchingHelp(true);
    try {
      // Hits the backend which now uses Google Maps Places API seamlessly
      const results = await sosService.getNearbyHelp(location.latitude, location.longitude, sosType);
      setNearbyHelp(results);
      
      // Animate map to show bounds if needed
      if (mapRef.current && results.length > 0 && location) {
        const coords = results.filter((r: any) => r.location).map((r: any) => ({
            latitude: r.location.lat,
            longitude: r.location.lng,
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
  };

  const fetchAccurateLocation = async () => {
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
  };

  const startLocationTracking = () => {
    fetchAccurateLocation();
    
    // Auto update every 30 seconds
    locationInterval.current = setInterval(() => {
      fetchAccurateLocation();
    }, 30000);
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();
  };

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
            <Text style={styles.subTitle}>Ready to assist 24/7</Text>
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
        <View style={styles.loadingBanner}>
          <ActivityIndicator size="small" color="#FFD700" />
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
                 pinColor="#FFD700" 
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
             <View style={{flex:1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111'}}>
                 <ActivityIndicator size="small" color="#FFD700" />
                 <Text style={{color: '#fff', marginTop: 10}}>Getting accurate location...</Text>
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
              <Ionicons name="flash" size={14} color="#FFD700" />
              <Text style={styles.heroChipText}>Priority 1</Text>
            </View>
          </View>

          {/* Dynamic SOS Trigger */}
          <View style={styles.sosRing}>
            <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: 0.3 }]} />
            <View style={styles.sosOuter}>
               <TouchableOpacity
                style={[styles.sosButton, triggering && styles.sosButtonDisabled]}
                onPress={handleTriggerSOS}
                activeOpacity={0.8}
              >
                <Text style={styles.sosText}>{triggering ? '...' : 'SOS'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>{triggering ? 'Contacting Emergency Services' : 'Tap to trigger emergency support'}</Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Quick Call Actions</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }}>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallPolice}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]}>
                <Ionicons name="shield" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.quickActionText}>Police</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallAmbulance}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                <Ionicons name="medkit" size={24} color="#ef4444" />
              </View>
              <Text style={styles.quickActionText}>Ambulance</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.quickActionButton} onPress={handleCallFire}>
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(249, 115, 22, 0.2)' }]}>
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
            {(['MEDICAL', 'POLICE', 'FIRE', 'ACCIDENT', 'MECHANICAL'] as SOSType[]).map((type) => (
              <TouchableOpacity
                key={type}
                style={[styles.typeButton, sosType === type && styles.typeButtonActive]}
                onPress={() => setSosType(type)}
              >
                <Ionicons 
                  name={getIconForType(type)} 
                  size={18} 
                  color={sosType === type ? '#000' : '#FFD700'} 
                />
                <Text style={[styles.typeText, sosType === type && styles.typeTextActive]}>{type}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Nearby Resources Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Resources (OSM)</Text>
            {searchingHelp && <ActivityIndicator size="small" color="#FFD700" />}
          </View>

          {nearbyHelp.length === 0 ? (
            <Text style={styles.mutedText}>
              {searchingHelp ? 'Searching for nearby help...' : 'No nearby services found in 5km.'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.nearbyScroll}>
              {nearbyHelp.map((item) => (
                <TouchableOpacity 
                   key={item.id} 
                   style={styles.nearbyItem}
                   onPress={() => Alert.alert(item.name, `${item.type.toUpperCase()}\nLocation pinned on map.`)}
                >
                  <View style={[styles.nearbyIcon, { backgroundColor: getNearbyColor(item.type) }]}>
                    <Ionicons name={getNearbyIcon(item.type)} size={20} color="#fff" />
                  </View>
                  <Text style={styles.nearbyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.nearbyType}>{item.type.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Contacts Section */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Emergency Contacts</Text>
            <TouchableOpacity onPress={() => navigation.navigate('HelpSupport')}>
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
                <View style={{ flexDirection: 'row', gap: 10 }}>
                   <Ionicons 
                    name="call" 
                    size={18} 
                    color="rgba(255, 255, 255, 0.4)" 
                    onPress={() => Alert.alert('Call', `Calling ${contact.phoneNumber}...`)} 
                  />
                  <Ionicons 
                    name="mail" 
                    size={18} 
                    color={contact.email ? "#FFD700" : "rgba(255, 255, 255, 0.2)"} 
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

const getNearbyColor = (type: string) => {
  switch (type) {
    case 'hospital': return '#ef4444';
    case 'police': return '#3b82f6';
    case 'fire_station': return '#f97316';
    default: return '#6b7280';
  }
};

const getNearbyIcon = (type: string) => {
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
    color: '#FFD700',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingHorizontal: wp(5),
    paddingBottom: hp(1),
  },
  loadingBannerText: {
    color: '#FFD700',
    fontSize: wp(3.4),
    fontFamily: 'Outfit-Medium',
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
    borderColor: '#FFD700',
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
    borderColor: 'rgba(255,215,0,0.1)',
    marginBottom: hp(2),
  },
  map: {
    flex: 1,
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
    backgroundColor: "rgba(255, 215, 0, 0.08)",
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.6),
    borderRadius: wp(5),
  },
  heroChipText: {
    color: "#FFD700",
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
    borderColor: '#FFD700',
  },
  sosOuter: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 215, 0, 0.03)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
    borderColor: "rgba(255, 215, 0, 0.1)",
  },
  sosButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#FFD700",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#FFD700",
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
    color: "#FFD700",
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
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
    borderColor: 'rgba(255,215,0,0.1)',
  },
  typeButtonActive: {
    backgroundColor: '#FFD700',
    borderColor: '#FFD700',
  },
  typeText: {
    marginLeft: wp(2),
    color: '#FFD700',
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
    backgroundColor: "rgba(255, 215, 0, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: wp(3),
  },
  contactAvatarText: {
    color: "#FFD700",
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.5),
  },
  contactInfo: {
    flex: 1,
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
  quickActionText: {
    color: '#fff',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3),
  },
});

export default SOSScreen;
