import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function VehicleSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultsVisible, setResultsVisible] = useState(false);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const searchInputRef = useRef<TextInput>(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setLoading(false);
    });
    return unsubscribe;
  }, [navigation]);

  const handleBack = () => navigation.goBack();

  const handleRCVerification = () => {
    if (isValidPlate) {
      setLoading(true);
      setTimeout(() => {
        navigation.navigate('AddVehicle', { registrationNumber: searchQuery });
      }, 500);
    } else {
      searchInputRef.current?.focus();
    }
  };

  const handleCheckChallan = () => {
    if (isValidPlate) {
      setLoading(true);
      setTimeout(() => {
        navigation.navigate('Challans', { vehicle: { registrationNumber: searchQuery } });
      }, 500);
    } else {
      searchInputRef.current?.focus();
    }
  };

  const handleDLVerification = () => {
    navigation.navigate('DLVerification');
  };

  const handleFastag = () => {
    navigation.navigate('Fastag');
  };

  const isValidPlate = searchQuery.length >= 6;

  const handleSearch = () => {
    if (isValidPlate) {
      Keyboard.dismiss();
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        setResultsVisible(true);
      }, 800);
    } else {
      searchInputRef.current?.focus();
    }
  };

  return (
    <View style={styles.container}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.container}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          
          {/* Header Section */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="chevron-back" size={28} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Search & Services</Text>
          </View>

          {/* Dynamic Search Bar Section */}
          <View style={styles.searchSection}>
            <View style={styles.searchBarContainer}>
              <View style={styles.flagContainer}>
                <View style={styles.flagIcon}>
                  <View style={styles.flagBlueDot} />
                  <Text style={styles.indText}>IND</Text>
                </View>
              </View>
              
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="EG. MH01AB1234"
                placeholderTextColor="rgba(0,0,0,0.3)"
                value={searchQuery}
                onChangeText={(t) => setSearchQuery(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              
              {searchQuery.length > 0 && (
                <TouchableOpacity 
                  onPress={() => {
                    setSearchQuery('');
                    setResultsVisible(false);
                  }} 
                  style={styles.clearIcon}
                >
                  <Ionicons name="close-circle" size={24} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            
            {!resultsVisible && (
              <TouchableOpacity 
                onPress={handleSearch} 
                style={[styles.standaloneSearchButton, !isValidPlate && styles.disabledStandaloneSearchButton]}
                disabled={!isValidPlate}
              >
                <Text style={styles.standaloneSearchButtonText}>Search Vehicle</Text>
              </TouchableOpacity>
            )}
          </View>

          <ScrollView 
            style={styles.content} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, !resultsVisible && { flexGrow: 1 }]}
          >
            {resultsVisible && (
              <>
                {/* 1. Quick Actions - Now First */}
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.servicesGrid}>
                   <TouchableOpacity 
                     style={styles.serviceCard} 
                     onPress={handleRCVerification}
                     activeOpacity={0.8}
                   >
                      <View style={[styles.serviceIconContainer, { backgroundColor: '#1A1A1A' }]}>
                         <MaterialIcon name="card-search-outline" size={32} color="#fff" />
                      </View>
                      <Text style={styles.serviceTitle}>RC Verification</Text>
                      <Text style={styles.serviceDesc}>Check RC details</Text>
                   </TouchableOpacity>

                   <TouchableOpacity 
                     style={styles.serviceCard} 
                     onPress={handleCheckChallan}
                     activeOpacity={0.8}
                   >
                      <View style={[styles.serviceIconContainer, { backgroundColor: '#1A1A1A' }]}>
                         <MaterialIcon name="file-document-outline" size={32} color="#fff" />
                      </View>
                      <Text style={styles.serviceTitle}>Check Challans</Text>
                      <Text style={styles.serviceDesc}>Traffic violations</Text>
                   </TouchableOpacity>
                </View>

                {/* 2. Essential Services - Now Second */}
                <Text style={styles.sectionTitle}>Essential Services</Text>
                <View style={styles.servicesGrid}>
                  <TouchableOpacity style={styles.serviceCard} onPress={handleDLVerification} activeOpacity={0.8}>
                    <View style={[styles.serviceIconContainer, { backgroundColor: '#1A1A1A' }]}>
                      <MaterialIcon name="card-account-details-star-outline" size={32} color="#fff" />
                    </View>
                    <Text style={styles.serviceTitle}>DL Verification</Text>
                    <Text style={styles.serviceDesc}>Verify your license</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity style={styles.serviceCard} onPress={handleFastag} activeOpacity={0.8}>
                    <View style={[styles.serviceIconContainer, { backgroundColor: '#1A1A1A' }]}>
                      <MaterialIcon name="tag-outline" size={32} color="#fff" />
                    </View>
                    <Text style={styles.serviceTitle}>FASTag</Text>
                    <Text style={styles.serviceDesc}>Balance & recharge</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}

            {!resultsVisible && (
               <View style={[styles.initialStateContainer, { flex: 1 }]}>
                  <View style={[styles.infoBanner, { marginTop: hp(1) }]}>
                    <MaterialIcon name="shield-check-outline" size={18} color="#007AFF" />
                    <Text style={styles.infoBannerText}>Enter vehicle number to see services</Text>
                  </View>
                  <View style={{ flex: 1 }} />
                  <Image 
                    source={require('../../assets/images/yellow_car_in_sv.png') as any}
                    style={styles.introImage}
                    resizeMode="contain"
                  />
               </View>
            )}

          </ScrollView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
      <LoadingSpinner visible={loading} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  searchSection: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    height: 60,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  flagContainer: {
    backgroundColor: '#002677',
    width: 38,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: 'rgba(0,0,0,0.1)',
  },
  flagIcon: {
    alignItems: 'center',
  },
  flagBlueDot: {
    width: 6,
    height: 6,
    backgroundColor: '#5F9EA0',
    borderRadius: 3,
    marginBottom: 2,
  },
  indText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'Outfit-Bold',
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    paddingHorizontal: 16,
    letterSpacing: 2,
  },
  clearIcon: {
    paddingHorizontal: 8,
  },
  standaloneSearchButton: {
    backgroundColor: '#007AFF', // Standard iOS Light Blue
    height: 56,
    borderRadius: 14,
    marginTop: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  standaloneSearchButtonText: {
    color: '#fff',
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
  },
  disabledStandaloneSearchButton: {
    opacity: 0.5,
    backgroundColor: '#333',
  },

  searchHint: {
    color: '#555',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    marginTop: 10,
    marginLeft: 4,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
  },
  sectionTitle: {
    color: '#888',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: hp(3),
    marginBottom: hp(2),
    marginLeft: 4,
  },
  servicesGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: wp(4),
    alignItems: 'flex-start',
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  serviceTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    marginBottom: 4,
  },
  serviceDesc: {
    color: '#666',
    fontSize: wp(3),
    fontFamily: 'Outfit-Regular',
  },

  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,122,255,0.08)',
    padding: 14,
    borderRadius: 12,
    marginTop: 0,
    gap: 8,
  },
  infoBannerText: {
    color: '#666',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
  },
  initialStateContainer: {
    alignItems: 'center',
    marginTop: 0,
  },
  introImage: {
    width: wp(100),
    height: hp(28),
    marginBottom: -hp(2), // Move it even lower
  },
});
