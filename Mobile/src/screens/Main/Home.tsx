import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  TextInput,
  FlatList,
  ActivityIndicator,
  Modal,
  Linking,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import QuickServicesGrid from '../../components/QuickServicesGrid';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import ServiceOptionsOverlay from '../ServiceAndWarrenty/OptionModal';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry', 'Chandigarh', 'Ladakh', 'Jammu and Kashmir'];

export default function Home() {
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [numberPlate, setNumberPlate] = useState('');
  const [fuelPrices, setFuelPrices] = useState<{ petrol: number; diesel: number } | null>(null);
  const [selectedState, setSelectedState] = useState('Kerala');
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [fuelLoading, setFuelLoading] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Fetch fuel prices on component mount
  useEffect(() => {
    fetchFuelPrices();
  }, [selectedState]);

  const fetchFuelPrices = async () => {
    try {
      setFuelLoading(true);
      const response = await fetch(`http://localhost:9000/api/v1/fuel/state?name=${selectedState}`);
      const data = await response.json();
      if (data.success && data.data.petrol) {
        setFuelPrices(data.data);
      } else {
        console.warn('No fuel data available for', selectedState);
      }
    } catch (error) {
      console.error('Error fetching fuel prices:', error);
    } finally {
      setFuelLoading(false);
    }
  };

  const handleProfilePress = () => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('MyProfile');
    } else {
      navigation.navigate('MyProfile');
    }
  };

  const handleHelpPress = () => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('HelpSupport');
    } else {
      navigation.navigate('HelpSupport');
    }
  };

  const navigateToRootScreen = (screenName: keyof RootStackParamList, params?: any) => {
    const rootNav = navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      if (params) {
        rootNav.navigate(screenName as any, params);
      } else {
        rootNav.navigate(screenName as any);
      }
    } else {
      if (params) {
        navigation.navigate(screenName as any, params);
      } else {
        navigation.navigate(screenName as any);
      }
    }
  };

  const trendingVideos = [
    {
      id: '3',
      title: 'Future of car technology that may hit our shores',
      views: '285K',
      url: 'https://www.youtube.com/watch?v=zSiV8rLna_s',
      thumbnail: 'https://img.youtube.com/vi/zSiV8rLna_s/hqdefault.jpg'
    },
    {
      id: '4',
      title: 'Electric Vehicles Revolution 2026',
      views: '156K',
      url: 'https://www.youtube.com/watch?v=piMHbmX7vBM',
      thumbnail: 'https://img.youtube.com/vi/piMHbmX7vBM/hqdefault.jpg'
    },
    {
      id: '1',
      title: 'What could the future of cars look like?',
      views: '450K',
      tag: 'Popular',
      url: 'https://www.youtube.com/watch?v=Lz5moT15ZgI',
      thumbnail: 'https://img.youtube.com/vi/Lz5moT15ZgI/hqdefault.jpg'
    },
    {
      id: '2',
      title: 'Tesla overtaken by Chinese carmaker BYD as world\'s biggest seller',
      views: '320K',
      url: 'https://www.youtube.com/watch?v=d2ezNAf9vjw',
      thumbnail: 'https://img.youtube.com/vi/d2ezNAf9vjw/hqdefault.jpg'
    },
  ];

  const trendingNews = [
    { id: '1', title: 'India-made suzuki evitara launch prices', snippet: 'RS 48 lakh', time: '2 hours ago', url: 'https://www.rushlane.com/india-made-suzuki-evitara-brazil-launch-price-r-269990-rs-48-lakh-12541176.html' },
    { id: '2', title: 'Maruti e Vitara vs Tata Curvv EV compared: Which should you buy?', snippet: 'Electric SUV comparison guide', time: '5 hours ago', url: 'https://www.autocarindia.com/auto-features/maruti-e-vitara-vs-tata-curvv-ev-compared-which-should-you-buy-440302' },
  ];

  const handleVideoPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleNewsPress = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };;
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PREMIUM VEHICLE HEADER */}
        <View style={styles.headerWrapper}>
          <View style={styles.headerContent}>
            {/* Left Info Column */}
            <View style={styles.headerLeft}>
              <Text style={styles.headerNumberPlate}>DL 01 AB 1234</Text>
              <Text style={styles.headerCarModel}>Maruti Suzuki Swift</Text>

              <View style={styles.healthSection}>
                <Text style={styles.healthText}>
                  85% <Text style={styles.healthLabel}>Health</Text>
                </Text>
                <View style={styles.healthBarBg}>
                  <View style={[styles.healthBarFill, { width: '85%' }]} />
                </View>
              </View>
            </View>

            {/* Right Car Image Column */}
            <View style={styles.headerRight}>
              <Image
                source={require('../../assets/images/car_vehicle_demo.png') as any}
                style={styles.headerCarImage}
                resizeMode="contain"
              />
            </View>
          </View>

          {/* Bottom Footer Section - Now Full Width */}
          <View style={styles.headerFooter}>
            <View style={styles.footerItem}>
              <Text style={styles.footerLabel}>Service due in</Text>
              <Text style={styles.footerValue}>420 km</Text>
            </View>
            <View style={[styles.footerItem, { alignItems: 'flex-end' }]}>
              <Text style={styles.footerLabel}>FASTag</Text>
              <Text style={styles.footerValue}>₹ 860</Text>
            </View>
          </View>

          {/* Top Overlays */}
          <View style={styles.headerOverlay}>
            <TouchableOpacity onPress={handleProfilePress} style={styles.overlayIconButton}>
              <Icon name="user-circle" size={wp(6.5)} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleHelpPress} style={styles.overlayIconButton}>
              <Icon name="question-circle" size={wp(6.5)} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* NUMBER PLATE INPUT */}
        <View style={styles.numberPlateSection}>
          <View style={styles.numberPlateContainer}>
            <View style={styles.indContainer}>
              <Text style={styles.indText}>IND</Text>
            </View>
            <TextInput
              style={styles.numberPlateInput}
              placeholder="MH01CH4322"
              placeholderTextColor="#666"
              value={numberPlate}
              onChangeText={setNumberPlate}
              autoCapitalize="characters"
              maxLength={15}
            />
            <TouchableOpacity style={styles.searchButton}>
              <MaterialIcon name="magnify" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* QUICK SERVICES GRID */}
        <QuickServicesGrid
          onServicePress={label => {
            if (label === 'Document') {
              navigateToRootScreen('DocumentList');
            } else if (label === 'My Vehicle') {
              navigateToRootScreen('VehicleList');
            } else if (label === 'Expense') {
              navigateToRootScreen('Expenses');
            } else if (label === 'Valet') {
              navigateToRootScreen('VehicleList');
            }
          }}
        />

        {/* INSURANCE BANNER */}
        <View style={styles.bannerSection}>
          <View style={styles.insuranceBanner}>
            <Image
              source={require('../../assets/images/challan.png') as any}
              style={styles.bannerImage}
              resizeMode="contain"
            />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Check Your Challans & Avoid Trouble!</Text>
              <Text style={styles.bannerDesc}>Settle now to avoid late fees and skip the hassle of going to court.</Text>
              <TouchableOpacity style={styles.payNowButton}>
                <Text style={styles.payNowText}>Pay Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* TRENDING CAR VIDEOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Videos</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={trendingVideos}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.videoListContent}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.videoCard}
                onPress={() => handleVideoPress(item.url)}
              >
                {item.tag && <View style={styles.videoTag}><Text style={styles.tagText}>{item.tag}</Text></View>}
                <View style={styles.videoThumbnail}>
                  <Image
                    source={{ uri: item.thumbnail }}
                    style={styles.thumbnailImage}
                    resizeMode="cover"
                  />
                  <View style={styles.playButtonOverlay}>
                    <MaterialIcon name="play-circle" size={50} color="#fff" />
                  </View>
                  <Text style={styles.viewCount}>{item.views}</Text>
                </View>
                <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* FUEL PRICES SECTION */}
        <View style={styles.fuelSection}>
          <View style={styles.fuelHeaderBanner}>
            <Text style={styles.fuelHeaderTitle}>Current Fuel Prices in</Text>
            <TouchableOpacity
              style={styles.stateButton}
              onPress={() => setShowStateModal(true)}
            >
              <Text style={styles.stateButtonText}>{selectedState.split(' ')[0]}</Text>
              <MaterialIcon name="chevron-down" size={14} color="#0a0a0a" />
            </TouchableOpacity>
          </View>

          {fuelLoading ? (
            <View style={styles.fuelContentCard}>
              <ActivityIndicator size="large" color="#fff" style={styles.fuelLoader} />
            </View>
          ) : fuelPrices ? (
            <View style={styles.fuelContentCard}>
              <View style={styles.fuelInlineContainer}>
                <View style={styles.fuelInlineItem}>
                  <Text style={styles.fuelInlineLabel}>Petrol:</Text>
                  <Text style={styles.fuelInlineValue}>₹ {fuelPrices.petrol}</Text>
                </View>
                <View style={styles.fuelInlineSpacer} />
                <View style={styles.fuelInlineItem}>
                  <Text style={styles.fuelInlineLabel}>Diesel:</Text>
                  <Text style={styles.fuelInlineValue}>₹ {fuelPrices.diesel}</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.viewTrendsButton}>
                <Text style={styles.viewTrendsText}>View Trends</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.fuelContentCard}>
              <Text style={styles.loadingText}>Unable to load fuel prices</Text>
            </View>
          )}
        </View>

        {/* TRENDING CAR NEWS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Car News</Text>
            <TouchableOpacity>
              <Text style={styles.viewAllText}>View Trends</Text>
            </TouchableOpacity>
          </View>
          {trendingNews.map((news) => (
            <TouchableOpacity
              key={news.id}
              style={styles.newsCard}
              onPress={() => handleNewsPress(news.url)}
            >
              <View style={styles.newsContent}>
                <Text style={styles.newsTitle}>{news.title}</Text>
                <Text style={styles.newsSnippet} numberOfLines={1}>{news.snippet}</Text>
                <Text style={styles.newsTime}>{news.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* COMING SOON FEATURES */}
        <View style={styles.section}>
          <Text style={styles.sectionTitleCenter}>Coming Soon</Text>
          <View style={styles.featureRow}>
            <View style={styles.featureCard}>
              <MaterialIcon name="car-electric" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>EV Charging</Text>
            </View>
            <View style={styles.featureCard}>
              <MaterialIcon name="car-wash" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>Car Wash</Text>
            </View>
            <View style={styles.featureCard}>
              <MaterialIcon name="tow-truck" size={wp(8)} color="#555" />
              <Text style={styles.featureTitle}>Emergency</Text>
            </View>
          </View>
          <Image
            source={require('../../assets/images/coming_soon.png') as any}
            style={styles.comingSoonBadge}
            resizeMode="contain"
          />
        </View>

        <View style={{ height: hp(3) }} />
      </ScrollView>

      {/* STATE SELECTION MODAL */}
      <Modal
        visible={showStateModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowStateModal(false);
          setStateSearchQuery('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select State</Text>
              <TouchableOpacity onPress={() => {
                setShowStateModal(false);
                setStateSearchQuery('');
              }}>
                <MaterialIcon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.stateSearchContainer}>
              <MaterialIcon name="magnify" size={20} color="#999" style={styles.searchIcon} />
              <TextInput
                style={styles.stateSearchInput}
                placeholder="Search state..."
                placeholderTextColor="#666"
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
              />
              {stateSearchQuery && (
                <TouchableOpacity onPress={() => setStateSearchQuery('')}>
                  <MaterialIcon name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={STATES.filter(state =>
                state.toLowerCase().includes(stateSearchQuery.toLowerCase())
              )}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.stateOption, selectedState === item && styles.selectedStateOption]}
                  onPress={() => {
                    setSelectedState(item);
                    setShowStateModal(false);
                    setStateSearchQuery('');
                  }}
                >
                  <Text style={styles.stateOptionText}>{item}</Text>
                  {selectedState === item && <MaterialIcon name="check" size={20} color="#fff" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <ServiceOptionsOverlay
        visible={serviceModalVisible}
        onClose={() => setServiceModalVisible(false)}
        onSelect={(screen) => {
          setServiceModalVisible(false);
          navigation.navigate(screen);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: hp(2),
  },
  section: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
  },
  sectionTitleCenter: {
    fontSize: wp(5),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(2),
    textAlign: 'center',
  },
  viewAllText: {
    color: '#ccc',
    fontSize: wp(3.5),
    fontWeight: '500',
  },

  /* PREMIUM VEHICLE HEADER */
  headerWrapper: {
    width: '100%',
    height: hp(32),
    backgroundColor: '#1a1c2e',
    paddingTop: Platform.OS === 'ios' ? hp(0) : hp(1),
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    paddingTop: hp(6), // Offset for top icons
  },
  headerLeft: {
    flex: 1.3,
    justifyContent: 'flex-start',
  },
  headerRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerNumberPlate: {
    color: '#fff',
    fontSize: wp(7),
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerCarModel: {
    color: '#aaa',
    fontSize: wp(4),
    fontWeight: '500',
    marginTop: hp(0.2),
  },
  healthSection: {
    marginTop: hp(2.5),
  },
  healthText: {
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: '700',
  },
  healthLabel: {
    color: '#4ade80', // Greenish
    fontSize: wp(4.5),
    fontWeight: '600',
  },
  healthBarBg: {
    width: wp(45),
    height: hp(0.8),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginTop: hp(1),
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    backgroundColor: '#4ade80',
    borderRadius: 4,
  },
  headerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: hp(1),
    paddingHorizontal: wp(6),
    paddingBottom: hp(2.5),
  },
  footerItem: {
    justifyContent: 'center',
  },
  footerLabel: {
    color: '#999',
    fontSize: wp(3),
    fontWeight: '500',
  },
  footerValue: {
    color: '#fff',
    fontSize: wp(3.8),
    fontWeight: '700',
    marginTop: hp(0.2),
  },
  headerCarImage: {
    width: wp(45),
    height: hp(20),
    transform: [{ scale: 1.2 }, { translateX: wp(5) }],
  },
  headerOverlay: {
    position: 'absolute',
    top: hp(1),
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(5),
    zIndex: 10,
  },
  overlayIconButton: {
    padding: wp(2.5),
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 20,
  },

  /* NUMBER PLATE SECTION */
  numberPlateSection: {
    paddingHorizontal: wp(12),
    marginTop: hp(2),
    marginBottom: hp(2.5),
    justifyContent: 'center',
  },
  numberPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    height: hp(5.5),
    overflow: 'hidden',
  },
  indContainer: {
    backgroundColor: '#003399',
    height: '100%',
    paddingHorizontal: wp(2.5),
    justifyContent: 'center',
    alignItems: 'center',
  },
  indText: {
    color: '#fff',
    fontSize: wp(2.6),
    fontWeight: '800',
  },
  numberPlateInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontWeight: '600',
    paddingHorizontal: wp(2),
  },
  searchButton: {
    paddingHorizontal: wp(2),
    paddingVertical: hp(1),
  },

  /* VEHICLE SECTION */
  vehicleSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  vehicleTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
    marginBottom: hp(1.5),
  },
  vehicleCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  vehicleImageContainer: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: wp(1),
    justifyContent: 'center',
    alignItems: 'center',
    width: wp(28),
    height: wp(28),
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
  },
  vehicleDetails: {
    flex: 1,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(0.8),
  },
  detailLabel: {
    color: '#999',
    fontSize: wp(3),
    fontWeight: '500',
  },
  detailValue: {
    color: '#fff',
    fontSize: wp(3.2),
    fontWeight: '600',
  },
  chevronIcon: {
    alignSelf: 'center',
  },

  /* BANNER SECTION */
  bannerSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
  },
  insuranceBanner: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: wp(3),
    paddingVertical: wp(3),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 0,
    gap: wp(2),
  },
  bannerImage: {
    width: wp(20),
    height: wp(20),
    marginRight: wp(1),
  },
  bannerContent: {
    flex: 1,
    justifyContent: 'center',
  },
  bannerTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '700',
    marginBottom: hp(0.5),
  },
  bannerDesc: {
    color: '#999',
    fontSize: wp(3.2),
    lineHeight: hp(2.2),
  },
  payNowButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.6),
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: hp(1),
    alignSelf: 'flex-start',
  },
  payNowText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontWeight: '700',
  },

  /* TRENDING VIDEOS */
  videoListContent: {
    paddingHorizontal: wp(5),
  },
  videoCard: {
    width: wp(60),
    marginRight: wp(4),
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 0,
  },
  videoTag: {
    position: 'absolute',
    top: wp(2),
    left: wp(2),
    backgroundColor: 'rgba(255,215,0,0.9)',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.4),
    borderRadius: 4,
    zIndex: 10,
  },
  tagText: {
    color: '#0a0a0a',
    fontSize: wp(2.8),
    fontWeight: '700',
  },
  videoThumbnail: {
    width: '100%',
    height: hp(18),
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  playButtonOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  viewCount: {
    position: 'absolute',
    bottom: wp(2),
    right: wp(2),
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    paddingHorizontal: wp(2),
    paddingVertical: hp(0.3),
    borderRadius: 4,
    fontSize: wp(3),
    fontWeight: '600',
    zIndex: 11,
  },
  videoTitle: {
    color: '#fff',
    fontSize: wp(3.5),
    fontWeight: '600',
    padding: wp(3),
    lineHeight: hp(2.2),
  },

  /* NEWS CARDS */
  newsCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 0,
  },
  newsContent: {
    flex: 1,
  },
  newsTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '600',
    marginBottom: hp(0.5),
  },
  newsSnippet: {
    color: '#999',
    fontSize: wp(3.5),
    marginBottom: hp(0.5),
  },
  newsTime: {
    color: '#666',
    fontSize: wp(3),
  },

  /* FUEL PRICES */
  fuelSection: {
    marginHorizontal: wp(5),
    marginBottom: hp(2.5),
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  fuelHeaderBanner: {
    backgroundColor: '#bbec50ff', // Sky Blue background
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelHeaderTitle: {
    color: '#333',
    fontSize: wp(3.8),
    fontWeight: '600',
  },
  stateButton: {
    backgroundColor: '#fff',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(0.8),
  },
  stateButtonText: {
    color: '#0a0a0a',
    fontSize: wp(3.2),
    fontWeight: '700',
  },
  fuelContentCard: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    gap: hp(1.5),
  },
  fuelInlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  fuelInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  fuelInlineLabel: {
    color: '#999',
    fontSize: wp(3.5),
    fontWeight: '500',
  },
  fuelInlineValue: {
    color: '#FFC107',
    fontSize: wp(4.2),
    fontWeight: '700',
  },
  fuelInlineSpacer: {
    width: 1,
    height: hp(3),
    backgroundColor: '#333',
  },
  viewTrendsButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  viewTrendsText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontWeight: '600',
  },
  fuelLoader: {
    marginVertical: hp(2),
  },
  loadingText: {
    color: '#888',
    fontSize: wp(4),
    textAlign: 'center',
    paddingVertical: hp(2),
  },

  /* COMING SOON */
  featureRow: {
    flexDirection: 'row',
    gap: wp(3),
    justifyContent: 'space-between',
  },
  featureCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 14,
    paddingVertical: hp(2),
    paddingHorizontal: wp(2),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  comingSoonBadge: {
    width: wp(90),
    height: hp(40),
    alignSelf: 'center',
    marginTop: hp(-4),
    marginBottom: hp(-15),
  },
  featureTitle: {
    color: '#fff',
    fontSize: wp(3.2),
    fontWeight: '600',
    marginTop: hp(1),
    textAlign: 'center',
  },

  /* STATE SELECTION MODAL */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: hp(80),
    paddingTop: hp(2),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingBottom: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
  },
  stateOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  selectedStateOption: {
    backgroundColor: 'rgba(255,215,0,0.1)',
  },
  stateOptionText: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: '500',
  },

  /* STATE SEARCH */
  stateSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    marginHorizontal: wp(5),
    marginBottom: hp(2),
    paddingHorizontal: wp(3),
    height: hp(5),
    gap: wp(2),
    borderWidth: 0,
  },
  searchIcon: {
    marginRight: wp(1),
  },
  stateSearchInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
    fontWeight: '500',
    paddingVertical: hp(1),
  },
});
