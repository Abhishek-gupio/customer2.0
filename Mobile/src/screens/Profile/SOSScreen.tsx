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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { sosService, type EmergencyContact, type SOSType } from '../../services/sosService';

let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
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
  const [nearbyHelp, setNearbyHelp] = useState<any[]>([]);
  const [searchingHelp, setSearchingHelp] = useState<boolean>(false);

  // Animation Refs
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // WebView Ref
  const webViewRef = useRef<WebView>(null);

  // Initialize
  useEffect(() => {
    fetchInitialData();
    startPulse();
    const watchId = startLocationTracking();
    
    return () => {
      if (watchId !== null && Geolocation) {
        Geolocation.clearWatch(watchId);
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
      const [contactList, activeSOS] = await Promise.all([
        sosService.getContacts(),
        sosService.getActiveSOS()
      ]);
      
      setContacts(contactList);
      
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
      const results = await sosService.getNearbyHelp(location.latitude, location.longitude, sosType);
      setNearbyHelp(results);
      
      // Inject markers into map
      const markersScript = `
        if (typeof updateNearbyMarkers === 'function') {
          updateNearbyMarkers(${JSON.stringify(results)});
        }
      `;
      webViewRef.current?.injectJavaScript(markersScript);
    } catch (error) {
      console.log('Nearby Help Error:', error);
    } finally {
      setSearchingHelp(false);
    }
  };

  const startLocationTracking = () => {
    if (!Geolocation) return null;

    return Geolocation.watchPosition(
      (position: any) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        setLocation(coords);
        setAddress(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`);
        
        // Update Leaflet Map main marker
        const script = `
          if (typeof updateMap === 'function') {
            updateMap(${coords.latitude}, ${coords.longitude});
          }
        `;
        webViewRef.current?.injectJavaScript(script);
      },
      (error: any) => console.log('Location Error:', error),
      { enableHighAccuracy: true, distanceFilter: 10, interval: 10000 }
    );
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
    if (triggering) return;
    if (!location) {
      Alert.alert('Location Required', 'Please wait until your location is acquired.');
      return;
    }

    setTriggering(true);
    Vibration.vibrate([0, 500, 200, 500]);

    try {
      const response = await sosService.triggerSOS({
        location,
        message,
        type: sosType,
      });

      if (response.success) {
        navigation.replace('ActiveSOS', {
          sosId: response.sosAlertId,
          type: sosType,
          lat: location.latitude,
          lon: location.longitude,
        });
      }
    } catch (error: any) {
      Alert.alert('SOS Failed', error.message || 'Unable to send SOS. Check your connection.');
    } finally {
      setTriggering(false);
    }
  };

  const leafLetHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; background: #000; }
        #map { height: 100vh; width: 100vw; }
        .marker-pulse {
          width: 24px;
          height: 24px;
          background: rgba(255, 215, 0, 0.4);
          border-radius: 50%;
          box-shadow: 0 0 0 rgba(255, 215, 0, 0.4);
          animation: pulse 2s infinite;
          z-index: 1000;
        }
        .marker-dot {
          width: 10px;
          height: 10px;
          background: #FFD700;
          border-radius: 50%;
          border: 2px solid white;
          position: absolute;
          top: 7px;
          left: 7px;
        }
        .nearby-marker {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          color: white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.5);
        }
        .bg-hospital { background: #ef4444; }
        .bg-police { background: #3b82f6; }
        .bg-fire { background: #f97316; }
        .bg-other { background: #6b7280; }

        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7); }
          70% { transform: scale(1.5); box-shadow: 0 0 0 10px rgba(255, 215, 0, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(255, 215, 0, 0); }
        }
        .leaflet-control-attribution { display: none; }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${location?.latitude || 0}, ${location?.longitude || 0}], 14);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19
        }).addTo(map);

        var customIcon = L.divIcon({
          className: 'custom-div-icon',
          html: "<div class='marker-pulse'><div class='marker-dot'></div></div>",
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });

        var marker = L.marker([${location?.latitude || 0}, ${location?.longitude || 0}], { icon: customIcon }).addTo(map);
        var nearbyLayer = L.layerGroup().addTo(map);

        function updateMap(lat, lon) {
          var newLatLng = new L.LatLng(lat, lon);
          marker.setLatLng(newLatLng);
          // map.panTo(newLatLng); // Don't pan automatically if user is browsing markers
        }

        function updateNearbyMarkers(items) {
          nearbyLayer.clearLayers();
          items.forEach(function(item) {
            var colorClass = 'bg-other';
            if (item.type === 'hospital') colorClass = 'bg-hospital';
            if (item.type === 'police') colorClass = 'bg-police';
            if (item.type === 'fire_station') colorClass = 'bg-fire';

            var icon = L.divIcon({
                className: 'nearby-div-icon',
                html: "<div class='nearby-marker " + colorClass + "'>" + item.name.substring(0,1) + "</div>",
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });
            L.marker([item.location.lat, item.location.lng], { icon: icon }).bindPopup("<b>" + item.name + "</b><br>" + item.type).addTo(nearbyLayer);
          });
        }
      </script>
    </body>
    </html>
  `;

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FFD700" />
        <Text style={styles.loaderText}>Initializing Secure SOS...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.profileRow}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.title}>EMERGENCY SOS</Text>
            <Text style={styles.subTitle}>Ready to assist 24/7</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Map Section */}
        <View style={styles.mapContainer}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: leafLetHTML }}
            style={styles.map}
            scrollEnabled={false}
          />
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
                onLongPress={handleTriggerSOS}
                delayLongPress={1500}
                activeOpacity={0.8}
              >
                <Text style={styles.sosText}>{triggering ? '...' : 'SOS'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.hint}>{triggering ? 'Contacting Emergency Services' : 'Hold for 1.5 seconds to trigger'}</Text>
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
});

export default SOSScreen;
