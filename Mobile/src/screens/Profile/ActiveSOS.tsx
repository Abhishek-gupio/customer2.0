import { StyleSheet, Text, View, Image, TouchableOpacity, Alert, ScrollView, Linking, Platform, Animated, Easing } from 'react-native'
import React, { useCallback, useEffect, useState, useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import Ionicons from "react-native-vector-icons/Ionicons";
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { useNavigation, useRoute, RouteProp } from '../../lib/react-navigation-native';
import { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import { RootStackParamList } from '../../navigation/types';
import { sosService, type EmergencyContact, type NearbyHelpItem } from '../../services/sosService';

const ActiveSOS = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'ActiveSOS'>>();
  const { sosId, type, lat, lon } = route.params;

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
   const [nearbyHelp, setNearbyHelp] = useState<NearbyHelpItem[]>([]);
   const [loading, setLoading] = useState(false);
   const [resolving, setResolving] = useState(false);
   const [humanAddress, setHumanAddress] = useState<string | null>(null);

  // Animations
  const glowAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(hp(5))).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Glow pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Entry animation
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        easing: Easing.out(Easing.back(1)),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      })
    ]).start();

    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [contactList, helpList, activeSOS] = await Promise.all([
        sosService.getContacts(),
        sosService.getNearbyHelp(lat, lon, type as any),
        sosService.getActiveSOS(),
      ]);
      setContacts(contactList);
      setNearbyHelp(helpList.slice(0, 3));
      if (activeSOS?.address) {
        setHumanAddress(activeSOS.address);
      }
    } catch (error: any) {
      console.log('Error loading active SOS data:', error);
      Alert.alert(
        "Connection Error",
        "Unable to load nearby help or contacts. Please check your internet connection.",
        [{ text: "Retry", onPress: loadData }, { text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    Alert.alert(
      "Confirm Safety",
      "Are you safe? This will stop the emergency signal.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "I am Safe", 
          style: "default",
          onPress: async () => {
            setResolving(true);
            try {
              await sosService.resolveSOS(sosId);
              navigation.replace('SOS');
            } catch (error: any) {
              Alert.alert("Error", "Could not resolve SOS. Please try again.");
            } finally {
              setResolving(false);
            }
          }
        }
      ]
    );
  };

  const makeCall = (number: string) => Linking.openURL(`tel:${number}`);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Dynamic Background Glow */}
      <Animated.View style={[styles.bgGlow, { 
        opacity: glowAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.1, 0.35]
        }) 
      }]} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View style={[styles.header, { transform: [{ translateY: slideAnim }], opacity: opacityAnim }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="shield-checkmark" size={40} color="#FF4F00" />
          </View>
          <Text style={styles.alertTitle}>HELP IS ON THE WAY</Text>
          <Text style={styles.alertSubTitle}>{type} emergency signal is active</Text>
          
          <View style={styles.locationBadge}>
            <Ionicons name="location" size={14} color="#FF4F00" />
            <Text style={styles.locationText} numberOfLines={1}>
              {humanAddress || `${lat.toFixed(4)}, ${lon.toFixed(4)}`}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Alerted Contacts</Text>
              <View style={styles.statusBadge}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>Notified via SMS</Text>
              </View>
            </View>
            
            {contacts.map((contact, index) => (
              <View key={contact.id} style={styles.contactItem}>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phoneNumber}</Text>
                </View>
                <TouchableOpacity style={styles.callSmall} onPress={() => makeCall(contact.phoneNumber)}>
                  <Ionicons name="call" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {contacts.length === 0 && (
              <Text style={styles.emptyText}>No emergency contacts found.</Text>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Nearby Help</Text>
            {nearbyHelp.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.helpItem}
                onPress={() => {
                  if (item.location) {
                    const url = Platform.select({
                      ios: `maps://?q=${item.name}&ll=${item.location.lat},${item.location.lng}`,
                      android: `geo:${item.location.lat},${item.location.lng}?q=${item.location.lat},${item.location.lng}(${item.name})`,
                    });
                    if (url) Linking.openURL(url);
                  }
                }}
              >
                <View style={styles.helpIcon}>
                  <Ionicons name="navigate" size={20} color="#00F2FF" />
                </View>
                <View style={styles.helpInfo}>
                  <Text style={styles.helpName}>{item.name}</Text>
                  <Text style={styles.helpAddress}>{item.address}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.3)" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity 
            style={styles.resolveButton} 
            onPress={handleResolve}
            disabled={resolving}
          >
            <Ionicons name="checkmark-circle" size={24} color="#fff" style={{marginRight: 10}} />
            <Text style={styles.resolveText}>{resolving ? 'Resolving...' : 'I AM SAFE NOW'}</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.policeButton} 
            onPress={() => makeCall('100')}
          >
            <Ionicons name="call" size={20} color="#fff" style={{marginRight: 8}} />
            <Text style={styles.policeText}>CALL POLICE</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

export default ActiveSOS

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  bgGlow: {
    position: 'absolute',
    top: -hp(20),
    left: -wp(50),
    right: -wp(50),
    height: hp(60),
    backgroundColor: '#FF4F00',
    borderRadius: wp(100),
    filter: 'blur(100px)',
  },
  scrollContent: {
    paddingBottom: hp(5),
  },
  header: {
    alignItems: 'center',
    marginTop: hp(6),
    marginBottom: hp(4),
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 79, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 79, 0, 0.4)',
    marginBottom: hp(3),
  },
  alertTitle: {
    fontSize: wp(7.5),
    fontFamily: 'Outfit-Black',
    color: '#fff',
    letterSpacing: 1,
  },
  alertSubTitle: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.6)',
    marginTop: hp(1),
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: hp(2.5),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  locationText: {
    color: '#FF4F00',
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    marginLeft: 6,
  },
  content: {
    paddingHorizontal: wp(6),
  },
  section: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 20,
    padding: 20,
    marginBottom: hp(2.5),
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
    marginRight: 6,
  },
  statusText: {
    color: '#22c55e',
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
  },
  contactPhone: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
  },
  callSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 15,
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 242, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },
  helpInfo: {
    flex: 1,
  },
  helpName: {
    color: '#fff',
    fontSize: 15,
    fontFamily: 'Outfit-SemiBold',
  },
  helpAddress: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: wp(6),
    marginTop: hp(2),
  },
  resolveButton: {
    backgroundColor: '#22c55e',
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#22c55e',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  resolveText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    letterSpacing: 1,
  },
  policeButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  policeText: {
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Outfit-Bold',
  },
})
