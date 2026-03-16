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
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { api } from '../../services/api';

const STATES = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Puducherry', 'Chandigarh', 'Ladakh', 'Jammu and Kashmir'];

export default function Home() {
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [numberPlate, setNumberPlate] = useState('');
  const [fuelPrices, setFuelPrices] = useState<{ petrol: number; diesel: number; cng?: number } | null>(null);
  const [selectedState, setSelectedState] = useState('Kerala');
  const [showStateModal, setShowStateModal] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [fuelLoading, setFuelLoading] = useState(false);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [vehicleLoading, setVehicleLoading] = useState(true);
  const [serviceDueText, setServiceDueText] = useState('Checking...');
  const [trendingVideos, setTrendingVideos] = useState<any[]>([]);
  const [trendingNews, setTrendingNews] = useState<any[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);
  const placeholders = ['MH01CH4322', 'AP39CH5621', 'UP31CH4259'];
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Fetch all home data
  useEffect(() => {
    const loadData = async () => {
      await Promise.all([
        fetchPrimaryVehicle(),
        fetchFuelPrices(),
        fetchDiscoveryContent()
      ]);
    };
    loadData();
  }, [selectedState]);

  // Auto-scroll carousel every 5 seconds
  // Use a ref to avoid stale closure & re-creating the interval on every slide,
  // which caused IllegalStateException from conflicting Animated frame timestamps.
  const carouselIndexRef = useRef(0);
  useEffect(() => {
    const timer = setInterval(() => {
      const nextIndex = (carouselIndexRef.current + 1) % 4;
      carouselIndexRef.current = nextIndex;
      setCarouselIndex(nextIndex);
      try {
        carouselRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
      } catch (_) {
        // guard against layout-not-ready race
      }
    }, 5000);
    return () => clearInterval(timer);
  }, []); // ← empty deps: interval is created once, uses ref internally

  // Typewriter animation for rotating number plate placeholders
  useEffect(() => {
    let currentIdx = 0;
    let placeholderIdx = 0;
    let isDeleting = false;
    let timeout: any;

    const animatePlaceholder = () => {
      const fullText = placeholders[placeholderIdx];

      if (!isDeleting) {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx + 1));
        currentIdx++;
        if (currentIdx === fullText.length) {
          isDeleting = true;
          timeout = setTimeout(animatePlaceholder, 2000); // Wait before deleting
        } else {
          timeout = setTimeout(animatePlaceholder, 150);
        }
      } else {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx - 1));
        currentIdx--;
        if (currentIdx === 0) {
          isDeleting = false;
          // Move to next placeholder in the list
          placeholderIdx = (placeholderIdx + 1) % placeholders.length;
          timeout = setTimeout(animatePlaceholder, 500); // Wait before typing next
        } else {
          timeout = setTimeout(animatePlaceholder, 100);
        }
      }
    };

    animatePlaceholder();
    return () => clearTimeout(timeout);
  }, []);

  const fetchPrimaryVehicle = async () => {
    try {
      setVehicleLoading(true);
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];

      if (primary) {
        setVehicle(primary);
        // Also fetch upcoming service to show in header footer
        try {
          const upcoming = await api.get<any[]>(`/v1/expenses/warranty/vehicles/${primary.id}/upcoming`);
          const overdue = (upcoming as any).data?.find((p: any) => p.urgency === 'OVERDUE');
          if (overdue) {
            setServiceDueText('Overdue!');
          } else {
            // Find closest logic... for simplicity using first
            const first = (upcoming as any).data?.[0];
            if (first) {
              const kmLeft = first.lifecycleKm - first.kmSinceReplacement;
              setServiceDueText(`${kmLeft > 0 ? kmLeft : 0} km`);
            } else {
              setServiceDueText('Healthy');
            }
          }
        } catch (err) {
          console.warn('Could not fetch upcoming service for home', err);
          setServiceDueText('N/A');
        }
      }
    } catch (error) {
      console.error('Error fetching primary vehicle:', error);
    } finally {
      setVehicleLoading(false);
    }
  };

  const fetchFuelPrices = async () => {
    try {
      setFuelLoading(true);
      const res = await api.get<any>(`/v1/fuel/state?name=${selectedState}`);
      const data = (res as any).data || res;
      if (data && (data.PETROL || data.petrol)) {
        setFuelPrices({
          petrol: data.PETROL || data.petrol,
          diesel: data.DIESEL || data.diesel,
          cng: data.CNG || data.cng
        });
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

  const fetchDiscoveryContent = async () => {
    try {
      setDiscoveryLoading(true);
      const res = await api.get<any>('/v1/discovery/trending');
      const data = (res as any).data || res;
      if (data) {
        if (data.news) setTrendingNews(data.news);
        if (data.videos) setTrendingVideos(data.videos);
      }
    } catch (error) {
      console.error('Error fetching discovery content:', error);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  const handleVideoPress = async (url: string) => {
    try {
      if (url) await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  const handleNewsPress = async (url: string) => {
    try {
      if (url) await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#000000' : undefined}
      />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PREMIUM VEHICLE CAROUSEL HEADER */}
        <View style={styles.headerWrapper}>
          <FlatList
            ref={carouselRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / wp(100));
              setCarouselIndex(index);
            }}
            data={[0, 1, 2, 3]} // 4 slides
            keyExtractor={(item) => item.toString()}
            renderItem={({ item }) => {
              if (item === 0) {
                return (
                  <View style={styles.slideFull}>
                    <View style={styles.headerContent}>
                      <View style={styles.headerLeft}>
                        {vehicleLoading ? (
                          <ActivityIndicator color="#fff" style={{ alignSelf: 'flex-start' }} />
                        ) : vehicle ? (
                          <>
                            <Text style={styles.headerNumberPlate}>{vehicle.registrationNumber}</Text>
                            <Text style={styles.headerCarModel}>{vehicle.make} {vehicle.model}</Text>
                            <View style={styles.healthSection}>
                              <Text style={styles.healthText}>
                                {vehicle.healthScore?.overallScore || 100}% <Text style={styles.healthLabel}>Health</Text>
                              </Text>
                              <View style={styles.healthBarBg}>
                                <View style={[styles.healthBarFill, { width: `${vehicle.healthScore?.overallScore || 100}%` }]} />
                              </View>
                            </View>
                          </>
                        ) : (
                          <TouchableOpacity onPress={() => navigateToRootScreen('AddVehicle')}>
                            <Text style={styles.headerNumberPlate}>Add Vehicle</Text>
                            <Text style={styles.headerCarModel}>Tap to get started</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={styles.headerRight}>
                        <Image
                          source={require('../../assets/images/car_vehicle_demo.png') as any}
                          style={styles.headerCarImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                    <View style={styles.headerFooter}>
                      <View style={styles.footerItem}>
                        <Text style={styles.footerLabel}>Service due in</Text>
                        <Text style={styles.footerValue}>{serviceDueText}</Text>
                      </View>
                      <View style={[styles.footerItem, { alignItems: 'flex-end' }]}>
                        <Text style={styles.footerLabel}>FASTag</Text>
                        <Text style={styles.footerValue}>₹ ---</Text>
                      </View>
                    </View>
                  </View>
                );
              }
              if (item === 1) {
                return (
                  <TouchableOpacity
                    style={styles.slideFull}
                    activeOpacity={0.9}
                    onPress={() => navigateToRootScreen('Expenses')}
                  >
                    <View style={styles.promoSlide}>
                      <View style={styles.promoLeft}>
                        <Text style={[styles.promoSubtitle, { color: '#FFBF00' }]}>Smart Tracking</Text>
                        <Text style={styles.promoTitle}>Expense Tracker</Text>
                        <Text style={styles.promoDesc}>Monitor your fuel, service and other vehicle costs easily.</Text>
                        <View style={styles.promoAction}>
                          <Text style={styles.promoActionText}>Try Now</Text>
                          <MaterialIcon name="chevron-right" size={18} color="#FFBF00" />
                        </View>
                      </View>
                      <View style={styles.promoRight}>
                        <Image
                          source={require('../../assets/images/expense_AD.png') as any}
                          style={styles.adImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              if (item === 2) {
                return (
                  <TouchableOpacity
                    style={styles.slideFull}
                    activeOpacity={0.9}
                    onPress={() => setServiceModalVisible(true)}
                  >
                    <View style={styles.promoSlide}>
                      <View style={styles.promoLeft}>
                        <Text style={[styles.promoSubtitle, { color: '#4ade80' }]}>Premium Care</Text>
                        <Text style={styles.promoTitle}>Featured Services</Text>
                        <Text style={styles.promoDesc}>Book maintenance, car wash, and emergency repairs instantly.</Text>
                        <View style={styles.promoAction}>
                          <Text style={[styles.promoActionText, { color: '#4ade80' }]}>Explore</Text>
                          <MaterialIcon name="chevron-right" size={18} color="#4ade80" />
                        </View>
                      </View>
                      <View style={styles.promoRight}>
                        <Image
                          source={require('../../assets/images/vehicle_AD.png') as any}
                          style={styles.adImage}
                          resizeMode="contain"
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }
              return (
                <View style={styles.slideFull}>
                  <View style={styles.promoSlide}>
                    <View style={styles.promoLeft}>
                      <Text style={styles.promoSubtitle}>Stay Connected</Text>
                      <Text style={styles.promoTitle}>Follow Us on Instagram</Text>
                      <View style={styles.promoButtons}>
                        <TouchableOpacity
                          style={styles.promoBtn}
                          onPress={() => Linking.openURL('https://www.instagram.com/gupio.in/')}
                        >
                          <Icon name="instagram" size={14} color="#000" />
                          <Text style={styles.promoBtnText}>Instagram</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.promoBtn, { backgroundColor: '#333' }]}
                          onPress={() => Linking.openURL('https://gupio.in/')}
                        >
                          <MaterialIcon name="earth" size={14} color="#fff" />
                          <Text style={[styles.promoBtnText, { color: '#fff' }]}>Website</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.promoRight}>
                      <Image
                        source={require('../../assets/images/insta&website_AD.png') as any}
                        style={styles.adImage}
                        resizeMode="contain"
                      />
                    </View>
                  </View>
                </View>
              );
            }}
          />

          {/* Carousel Indicators */}
          <View style={styles.indicatorContainer}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  carouselIndex === i ? styles.dotActive : styles.dotInactive
                ]}
              />
            ))}
          </View>

          {/* Top Overlays - Fixed on top of carousel */}
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
              placeholder={animatedPlaceholder}
              placeholderTextColor="#fff"
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
            } else if (label === 'Service') {
              navigation.navigate('Services' as any, { screen: 'ServicesHome' });
            } else if (label === 'Driving') {
              navigateToRootScreen('DrivingSummary');
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
                <Text style={styles.payNowText}>Check Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* TRENDING CAR VIDEOS */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Trending Videos</Text>
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
                {fuelPrices.cng && (
                  <>
                    <View style={styles.fuelInlineSpacer} />
                    <View style={styles.fuelInlineItem}>
                      <Text style={styles.fuelInlineLabel}>CNG:</Text>
                      <Text style={styles.fuelInlineValue}>₹ {fuelPrices.cng}</Text>
                    </View>
                  </>
                )}
              </View>
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

        {/* FULL HEIGHT HOME ADVERTISEMENT */}
        {/* <View style={styles.fullAdSection}>
          <Text style={styles.fullAdTitle}>Featured Services</Text>
          <Image
            source={require('../../assets/images/Home_AD.png') as any}
            style={styles.fullAdImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={styles.exploreAdButton}
            onPress={() => navigation.navigate('Services' as any, { screen: 'ServicesHome' })}
          >
            <Text style={styles.exploreAdButtonText}>Explore</Text>
          </TouchableOpacity>
        </View> */}

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
    backgroundColor: '#000000',
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
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    fontSize: wp(5),
  },
  sectionTitleCenter: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(5),
    color: '#FFFFFF',
    marginBottom: hp(2),
    textAlign: 'center',
  },
  viewAllText: {
    fontFamily: 'Outfit-Medium',
    color: '#ccc',
    fontSize: wp(3.5),
  },

  /* PREMIUM VEHICLE HEADER */
  headerWrapper: {
    width: '100%',
    height: hp(32),
    backgroundColor: '#0d0f14',
    paddingTop: 0,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    paddingTop: hp(4), // Avoid top overlay
    alignItems: 'center', // Center vertically
  },
  headerLeft: {
    flex: 1.3,
    justifyContent: 'center',
  },
  headerRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  headerNumberPlate: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: '800',
    letterSpacing: 1,
  },
  headerCarModel: {
    fontFamily: 'Outfit-Medium',
    color: '#aaa',
    fontSize: wp(3.5),
    fontWeight: '500',
    marginTop: hp(0.2),
  },
  healthSection: {
    marginTop: hp(1.5),
  },
  healthText: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
  },
  healthLabel: {
    color: '#4ade80', // Greenish
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  healthBarBg: {
    width: wp(40),
    height: hp(0.5),
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 4,
    marginTop: hp(1),
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    backgroundColor: '#32D74B',
    borderRadius: 4,
  },
  headerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingBottom: hp(6),
  },
  footerItem: {
    justifyContent: 'center',
  },
  footerLabel: {
    fontFamily: 'Outfit-Medium',
    color: '#999',
    fontSize: wp(3),
  },
  footerValue: {
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(3.8),
    marginTop: hp(0.2),
  },
  headerCarImage: {
    width: wp(40),
    height: hp(16),
    transform: [{ scale: 1.1 }, { translateX: wp(5) }],
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  /* CAROUSEL SLIDE STYLES */
  slideFull: {
    width: wp(100),
    height: '100%',
  },
  promoSlide: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: hp(4), // Add space to push content down into the middle
    paddingBottom: hp(4), // Balanced padding
  },
  promoLeft: {
    flex: 1.4,
    justifyContent: 'center',
  },
  promoRight: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  adImage: {
    width: wp(35),
    height: hp(18),
  },
  promoSubtitle: {
    color: '#aaa',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(0.5),
  },
  promoTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    marginBottom: hp(1.5),
  },
  promoDesc: {
    color: '#ccc',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    lineHeight: hp(2),
    marginBottom: hp(2),
  },
  promoButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: wp(2),
    marginTop: hp(1),
  },
  promoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: wp(2.5),
    paddingVertical: hp(0.8),
    borderRadius: 6,
    gap: wp(1),
  },
  promoBtnText: {
    color: '#000',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Bold',
  },
  promoAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1),
  },
  promoActionText: {
    color: '#FFBF00',
    fontSize: wp(4),
    fontWeight: '700',
  },
  indicatorContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: hp(5), // Positioned above the overlapping vehicle input
    left: 0,
    right: 0,
    gap: wp(1.5),
  },
  dot: {
    width: wp(1.5),
    height: wp(1.5),
    borderRadius: wp(0.75),
  },
  dotActive: {
    backgroundColor: '#fff',
    width: wp(4),
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  /* NUMBER PLATE SECTION */
  numberPlateSection: {
    paddingHorizontal: wp(12),
    marginTop: -hp(2.80), // 50% of the 5.5hp height to overlap header
    marginBottom: hp(2.0),
    justifyContent: 'center',
    zIndex: 10, // Ensure it's above the header
  },
  numberPlateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(2.6),
  },
  numberPlateInput: {
    fontFamily: 'Outfit-SemiBold',
    flex: 1,
    color: '#fff',
    fontSize: wp(3.8),
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
    fontFamily: 'Outfit-Medium',
  },
  detailValue: {
    color: '#fff',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-SemiBold',
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
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingHorizontal: wp(4),
    paddingVertical: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    gap: wp(3),
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
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    fontSize: wp(4),
    marginBottom: hp(0.5),
  },
  bannerDesc: {
    fontFamily: 'Outfit-Regular',
    color: '#999',
    fontSize: wp(3.2),
    lineHeight: hp(2.2),
  },
  payNowButton: {
    backgroundColor: '#FFBF00',
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
    fontFamily: 'Outfit-Bold',
  },

  /* TRENDING VIDEOS */
  videoListContent: {
    paddingHorizontal: wp(5),
  },
  videoCard: {
    width: wp(60),
    marginRight: wp(4),
    backgroundColor: '#111111',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
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
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-SemiBold',
    zIndex: 11,
  },
  videoTitle: {
    color: '#fff',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-SemiBold',
    padding: wp(3),
    lineHeight: hp(2.2),
  },

  /* NEWS CARDS */
  newsCard: {
    backgroundColor: '#111111',
    borderRadius: 16,
    padding: wp(4.5),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  newsContent: {
    flex: 1,
  },
  newsTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-SemiBold',
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
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  fuelHeaderBanner: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fuelHeaderTitle: {
    color: '#333',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-SemiBold',
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
    fontFamily: 'Outfit-Bold',
  },
  fuelContentCard: {
    backgroundColor: '#111111',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2.5),
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
    fontFamily: 'Outfit-Medium',
  },
  fuelInlineValue: {
    color: '#FFBF00',
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-SemiBold',
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
    backgroundColor: '#111111',
    borderRadius: 16,
    paddingVertical: hp(2.5),
    paddingHorizontal: wp(2),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
    fontFamily: 'Outfit-SemiBold',
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
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-Medium',
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
    fontFamily: 'Outfit-Medium',
    paddingVertical: hp(1),
  },

  /* FULL HEIGHT AD */
  fullAdSection: {
    paddingHorizontal: wp(5),
    marginBottom: hp(2.5),
    marginTop: hp(-1), // Reduced top spacing as requested
    width: wp(100), // Taking full available viewport instead of arbitrary percentage wrapper
    alignItems: 'center',
  },
  fullAdTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '700',
    alignSelf: 'flex-start',
    marginBottom: hp(1.5),
  },
  fullAdImage: {
    width: wp(90),
    height: hp(40), // Adjusted to reduce letterbox whitespace and fit closely above the button
    borderRadius: 12,
  },
  exploreAdButton: {
    backgroundColor: '#FFD700',
    paddingHorizontal: wp(12),
    paddingVertical: hp(1.6),
    borderRadius: 8,
    marginTop: hp(-2), // Pull the button slightly up against the image bounds
  },
  exploreAdButtonText: {
    color: '#0a0a0a',
    fontSize: wp(4.5),
    fontWeight: '800',
  },
});
