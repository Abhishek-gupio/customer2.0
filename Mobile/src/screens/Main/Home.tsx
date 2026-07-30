import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTheme } from '../../theme/ThemeContext';
import {
  Animated,
  BackHandler,
  Dimensions,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {
  useNavigation,
  useFocusEffect,
} from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import QuickServicesGrid from '../../components/QuickServicesGrid';
import ServiceOptionsOverlay from '../ServiceAndWarrenty/OptionModal';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { api, getNetworkOnlineState, subscribeNetworkState } from '../../services/api';
import { getCachedValue, getStaleCachedValue, setCachedValue } from '../../services/cache';
import { COLORS } from '../../components/Vehicles/VehicleUI';
import { GEO } from '../../config';

import { getLastOdometerUpdate } from '../../services/storage';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { fetchDocuments } from '../../store/slices/documentsSlice';
import { createStyles } from './homeStyles';
import {
  ComingSoonSection,
  ChallanBanner,
  FloatingVideoPlayer,
  FuelPricesSection,
  NumberPlateSearchBar,
  OwnershipTimeline,
  StateSelectionModal,
  TrendingNewsSection,
  TrendingVideosSection,
} from './HomeSections';
import {
  DrivingBehaviorSlide,
  ExpenseSlide,
  OdometerSlide,
  ServicesSlide,
  SocialSlide,
  TripPlannerSlide,
  VehicleSlide,
} from './HomeSlides';
import { useHomeCarousel } from './hooks/useHomeCarousel';
import { useHomeDiscovery } from './hooks/useHomeDiscovery';
import { useHomeFuel } from './hooks/useHomeFuel';
import { useHomeLocation } from './hooks/useHomeLocation';
import { useHomeVehicle } from './hooks/useHomeVehicle';
import { useFloatingVideo } from './hooks/useFloatingVideo';
import {
  HOME_STATES,
  type HomeCarouselSlide,
  type TimelineItem,
} from './types/home';
import {
  buildYouTubeEmbedUrl,
  getYouTubeVideoId,
} from './utils/youtubeHelpers';

const PLACEHOLDERS = ['MH01CH4322', 'AP39CH5621', 'UP31CH4259'];

export default function Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const dispatch = useAppDispatch();
  const documents = useAppSelector(state => state.documents.documents);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [serviceModalVisible, setServiceModalVisible] = useState(false);
  const [showStateModal, setShowStateModal] = useState(false);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const fetchPrimaryVehicleRef = useRef<(() => void) | null>(null);
  const lastKnownNetworkStateRef = useRef(getNetworkOnlineState());
  const reconnectRefreshInFlightRef = useRef(false);
  const timelineEntranceAnim = useRef(new Animated.Value(0)).current;

  const {
    selectedState,
    setSelectedState,
    userLocationDisplay,
    locationLoading,
    fetchUserLocationWithRetry,
    fuelStateLockedByUserRef,
  } = useHomeLocation();
  const { fuelPrices, fuelLoading, fetchFuelPrices } =
    useHomeFuel(selectedState);
  const {
    vehicle,
    vehicleLoading,
    serviceDueText,
    serviceAlertCount,
    serviceDueSoonCount,
    monthlySpendTotal,
    monthlyExpenseCount,
    expenseAlertCount,
    expenseHeadline,
    showOdometerSlide,
    fetchPrimaryVehicle,
  } = useHomeVehicle();
  const {
    trendingVideos,
    trendingNews,
    discoveryLoading,
    fetchDiscoveryContent,
  } = useHomeDiscovery();
  const {
    selectedVideo,
    setSelectedVideo,
    closeSelectedVideo,
    isVideoDragging,
    isVideoExpanded,
    miniBaseLeft,
    miniBaseTop,
    miniVideoCardWidth,
    expandedBaseLeft,
    expandedBaseTop,
    expandedVideoCardWidth,
    videoBaseX,
    videoBaseY,
    videoDragX,
    videoDragY,
    videoDragGestureEvent,
    handleVideoGestureStateChange,
    toggleVideoExpanded,
  } = useFloatingVideo();

  const bannerWidth = Dimensions.get('window').width;
  const carouselSlides = useMemo<HomeCarouselSlide[]>(() => {
    const slides: HomeCarouselSlide[] = [
      'vehicle',
      'expenses',
      'services',
      'social',
      'drivingBehavior',
      'tripPlanner',
    ];

    if (showOdometerSlide) {
      slides.push('odometer');
    }

    return slides;
  }, [showOdometerSlide]);
  const {
    carouselIndex,
    carouselRef,
    handleBannerMomentumEnd,
    pauseAutoScrollTemporarily,
  } = useHomeCarousel({
    bannerWidth,
    slideCount: carouselSlides.length,
  });

  const getBannerVehicleShortName = useCallback(
    (currentVehicle: typeof vehicle): string => {
      if (!currentVehicle) {
        return 'Vehicle';
      }

      const makeWords = (currentVehicle.make || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const modelWords = (currentVehicle.model || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
      const makeFirst = makeWords[0] || '';
      let modelFirst = modelWords[0] || '';

      if (
        makeFirst &&
        modelFirst &&
        makeFirst.toLowerCase() === modelFirst.toLowerCase()
      ) {
        modelFirst = modelWords[1] || modelFirst;
      }

      const shortName = [makeFirst, modelFirst]
        .filter(Boolean)
        .join(' ')
        .trim();
      return (
        shortName || currentVehicle.model || currentVehicle.make || 'Vehicle'
      );
    },
    [],
  );

  useEffect(() => {
    void fetchDiscoveryContent();
    void fetchUserLocationWithRetry(0);
    dispatch(fetchDocuments());
  }, [dispatch, fetchDiscoveryContent, fetchUserLocationWithRetry]);

  useFocusEffect(
    useCallback(() => {
      void fetchPrimaryVehicle();
      void fetchDiscoveryContent();
      dispatch(fetchDocuments());
    }, [dispatch, fetchDiscoveryContent, fetchPrimaryVehicle]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        fetchPrimaryVehicle(),
        fetchDiscoveryContent(),
        fetchUserLocationWithRetry(0),
        dispatch(fetchDocuments()) as unknown as Promise<unknown>,
        selectedState &&
        selectedState !== 'Detecting...' &&
        HOME_STATES.includes(selectedState as (typeof HOME_STATES)[number])
          ? fetchFuelPrices()
          : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [
    dispatch,
    fetchDiscoveryContent,
    fetchFuelPrices,
    fetchPrimaryVehicle,
    fetchUserLocationWithRetry,
    selectedState,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') {
        return undefined;
      }

      const onBackPress = () => {
        if (selectedVideo) {
          closeSelectedVideo();
          return true;
        }

        return false;
      };

      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );

      return () => subscription.remove();
    }, [closeSelectedVideo, selectedVideo]),
  );

  useFocusEffect(
    useCallback(() => {
      lastKnownNetworkStateRef.current = getNetworkOnlineState();

      const unsubscribe = subscribeNetworkState((online) => {
        const wasOnline = lastKnownNetworkStateRef.current;
        lastKnownNetworkStateRef.current = online;

        if (!wasOnline && online && !reconnectRefreshInFlightRef.current) {
          reconnectRefreshInFlightRef.current = true;
          handleRefresh().finally(() => {
            reconnectRefreshInFlightRef.current = false;
          });
        }
      });

      return () => {
        unsubscribe();
        reconnectRefreshInFlightRef.current = false;
      };
    }, [handleRefresh])
  );


  // Typewriter animation for rotating number plate placeholders
  useEffect(() => {
    let currentIdx = 0;
    let placeholderIdx = 0;
    let isDeleting = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const animatePlaceholder = () => {
      const fullText = PLACEHOLDERS[placeholderIdx];

      if (!isDeleting) {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx + 1));
        currentIdx += 1;
        if (currentIdx === fullText.length) {
          isDeleting = true;
          timeout = setTimeout(animatePlaceholder, 2000);
        } else {
          timeout = setTimeout(animatePlaceholder, 150);
        }
      } else {
        setAnimatedPlaceholder(fullText.substring(0, currentIdx - 1));
        currentIdx -= 1;
        if (currentIdx === 0) {
          isDeleting = false;
          placeholderIdx = (placeholderIdx + 1) % PLACEHOLDERS.length;
          timeout = setTimeout(animatePlaceholder, 500);
        } else {
          timeout = setTimeout(animatePlaceholder, 100);
        }
      }
    };

    animatePlaceholder();
    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, []);

  const navigateToRootScreen = useCallback(
    (screenName: keyof RootStackParamList, params?: any) => {
      const rootNav =
        navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
      if (rootNav) {
        if (params) {
          rootNav.navigate(screenName as any, params);
        } else {
          rootNav.navigate(screenName as any);
        }
        return;
      }

      if (params) {
        navigation.navigate(screenName as any, params);
      } else {
        navigation.navigate(screenName as any);
      }
    },
    [navigation],
  );

  const navigateToServicesScreen = useCallback(
    (
      screen:
        | 'ServicesHome'
        | 'NearbyPlaces'
        | 'CheckChallan'
        | 'ServiceHistory'
        | 'WarrantyStatus',
      params?: any,
    ) => {
      if (params) {
        navigation.navigate('Services' as any, { screen, params });
        return;
      }
      navigation.navigate('Services' as any, { screen });
    },
    [navigation],
  );

  const navigateToGarageTab = useCallback(() => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('Main', { screen: 'my_garage' });
      return;
    }

    navigation.navigate('my_garage' as any);
  }, [navigation]);

  const handleProfilePress = useCallback(() => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('MyProfile');
    } else {
      navigation.navigate('MyProfile');
    }
  }, [navigation]);

  const handleSOSPress = useCallback(() => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('SOS');
    } else {
      (navigation as any).navigate('SOS');
    }
  }, [navigation]);

  const handleAlertsPress = useCallback(() => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('Alerts');
    } else {
      navigation.navigate('Alerts');
    }
  }, [navigation]);

  const handleHelpPress = useCallback(() => {
    const rootNav =
      navigation.getParent<NativeStackNavigationProp<RootStackParamList>>();
    if (rootNav) {
      rootNav.navigate('HelpSupport');
    } else {
      navigation.navigate('HelpSupport');
    }
  }, [navigation]);

  const handleVehicleSearchPress = useCallback(() => {
    navigation.navigate('VehicleSearch');
  }, [navigation]);
  const handleExpenseSlidePress = useCallback(() => {
    navigateToRootScreen('Expenses');
  }, [navigateToRootScreen]);
  const handleServicesSlidePress = useCallback(() => {
    setServiceModalVisible(true);
  }, []);
  const handleDrivingBehaviorSlidePress = useCallback(() => {
    navigateToRootScreen('DrivingSummary');
  }, [navigateToRootScreen]);
  const handleTripPlannerSlidePress = useCallback(() => {
    navigateToRootScreen('TripExpense');
  }, [navigateToRootScreen]);
  const handleChallanPress = useCallback(() => {
    navigateToServicesScreen('CheckChallan');
  }, [navigateToServicesScreen]);
  const handleStateModalOpen = useCallback(() => {
    setShowStateModal(true);
  }, []);
  const handleStateModalClose = useCallback(() => {
    setShowStateModal(false);
  }, []);

  const handleQuickServicePress = useCallback(
    (id: string) => {
      if (id === 'document') {
        navigateToRootScreen('DocumentList');
      } else if (id === 'garage') {
        navigateToRootScreen('VehicleList');
      } else if (id === 'expense') {
        navigateToRootScreen('Expenses');
      } else if (id === 'valet') {
        navigateToRootScreen('Valet');
      } else if (id === 'service') {
        navigateToServicesScreen('ServicesHome');
      } else if (id === 'driving') {
        navigateToRootScreen('DrivingSummary');
      } else if (id === 'nearby') {
        navigation.navigate('Services' as any, {
          screen: 'NearbyPlaces',
          params: { fromHome: true },
        });
      } else if (id === 'support') {
        handleHelpPress();
      } else if (id === 'tripcost' || id === 'trip_planner') {
        navigateToRootScreen('TripExpense');
      } else if (id === 'more') {
        navigation.navigate('Services' as any);
      }
    },
    [
      handleHelpPress,
      navigateToRootScreen,
      navigateToServicesScreen,
      navigation,
    ],
  );

  const openAiAssistant = useCallback(
    (userMessage?: string) => {
      if (userMessage) {
        (navigation as any).navigate('AIAssistant', { userMessage });
        return;
      }
      (navigation as any).navigate('AIAssistant');
    },
    [navigation],
  );

  const handleVideoPress = useCallback(
    (url: unknown, title: unknown) => {
      const videoId = getYouTubeVideoId(url);
      if (videoId) {
        setSelectedVideo({
          id: videoId,
          embedUrl: buildYouTubeEmbedUrl(videoId),
          title:
            typeof title === 'string' && title.trim()
              ? title
              : 'Trending Video',
        });
      } else {
        console.warn(
          'Unable to extract YouTube video ID for trending video:',
          url,
        );
      }
    },
    [setSelectedVideo],
  );

  const handleNewsPress = useCallback(async (url: string) => {
    try {
      if (url) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  }, []);

  const handleViewMoreVideos = useCallback(() => {
    (navigation as any).navigate('TrendingList', {
      type: 'videos',
      title: 'Trending Videos',
      items: trendingVideos,
    });
  }, [navigation, trendingVideos]);

  const handleViewMoreNews = useCallback(() => {
    (navigation as any).navigate('TrendingList', {
      type: 'news',
      title: 'Trending News',
      items: trendingNews,
    });
  }, [navigation, trendingNews]);


  const handleStateSelect = useCallback(
    (state: string) => {
      fuelStateLockedByUserRef.current = true;
      setSelectedState(state);
      setShowStateModal(false);
    },
    [setSelectedState, fuelStateLockedByUserRef],
  );

  const lastOdometerUpdate = vehicle?.id
    ? getLastOdometerUpdate(vehicle.id)
    : null;
  const currentTimeMs = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const odometerAgeDays = lastOdometerUpdate
    ? Math.floor((currentTimeMs - lastOdometerUpdate) / dayMs)
    : null;
  const odometerSummary = !lastOdometerUpdate
    ? 'No reading saved yet. Keeping odometer updated improves health and expense accuracy.'
    : odometerAgeDays === 0
      ? 'Odometer was updated today. Keep logging consistently to sharpen insights.'
      : `Last reading was ${odometerAgeDays} day${odometerAgeDays === 1 ? '' : 's'} ago.`;

  const healthScore = vehicle?.healthScore?.overallScore ?? null;
  const fuelSummary = fuelPrices
    ? `Petrol \u20B9${fuelPrices.petrol} \u2022 Diesel \u20B9${fuelPrices.diesel}${
        fuelPrices.cng ? ` \u2022 CNG \u20B9${fuelPrices.cng}` : ''
      }`
    : selectedState === 'Detecting...'
      ? 'We are finding fuel prices for your current state.'
      : `Fuel prices for ${selectedState} will appear here when available.`;
  const requiredDocumentTypes = ['RC', 'Insurance', 'PUC', 'DL'];
  const requiredDocumentLabels: Record<string, string> = {
    RC: 'RC',
    Insurance: 'insurance',
    PUC: 'PUC',
    DL: 'license',
  };
  const requiredDocuments = requiredDocumentTypes.map(type =>
    documents.find(doc => doc.type === type),
  );
  const missingDocumentTypes = requiredDocumentTypes.filter(
    type => !documents.find(doc => doc.type === type),
  );
  const documentsNeedingReview = requiredDocuments.filter(
    doc => doc && doc.status !== 'verified',
  );
  const documentBadge =
    missingDocumentTypes.length > 0
      ? `${missingDocumentTypes.length} missing`
      : documentsNeedingReview.length > 0
        ? `${documentsNeedingReview.length} review`
        : 'Ready';
  const documentAccent =
    missingDocumentTypes.length > 0
      ? '#5f9ea0'
      : documentsNeedingReview.length > 0
        ? '#fb7185'
        : '#22c55e';
  const documentTitle =
    missingDocumentTypes.length > 0
      ? 'Complete your glovebox'
      : documentsNeedingReview.length > 0
        ? 'Review document expiry'
        : 'Documents look healthy';
  const documentSummary =
    missingDocumentTypes.length > 0
      ? `Add ${missingDocumentTypes
          .slice(0, 2)
          .map(type => requiredDocumentLabels[type])
          .join(' and ')} so you have the essentials for daily driving.`
      : documentsNeedingReview.length > 0
        ? 'One or more stored documents are expiring or expired. Review them before your next trip.'
        : 'RC, insurance, PUC and license are already stored in your glovebox.';
  const serviceBadge =
    serviceAlertCount > 0
      ? `${serviceAlertCount} overdue`
      : serviceDueSoonCount > 0
        ? `${serviceDueSoonCount} due soon`
        : vehicle
          ? 'Live'
          : 'Start here';
  const serviceAccent =
    serviceAlertCount > 0
      ? '#fb7185'
      : serviceDueSoonCount > 0
        ? '#5f9ea0'
        : '#4ade80';
  const serviceTitle = vehicle
    ? serviceAlertCount > 0
      ? `${serviceAlertCount} service alert${serviceAlertCount === 1 ? '' : 's'}`
      : serviceDueSoonCount > 0
        ? `${serviceDueSoonCount} parts need attention`
        : `${healthScore ?? 100}% health score`
    : 'Add your first vehicle';
  const serviceSummary = vehicle
    ? serviceAlertCount > 0
      ? `${serviceAlertCount} part${serviceAlertCount === 1 ? '' : 's'} are overdue. Open health to review the most urgent replacements.`
      : serviceDueSoonCount > 0
        ? `${serviceDueSoonCount} part${serviceDueSoonCount === 1 ? '' : 's'} are due soon. Your next checkpoint is ${serviceDueText}.`
        : `Your next service checkpoint is ${serviceDueText}.`
    : 'Connect your vehicle to unlock service, trip and document insights.';
  const spendTitle =
    monthlySpendTotal !== null
      ? `\u20B9${Math.round(monthlySpendTotal).toLocaleString('en-IN')} this month`
      : 'Track every rupee';
  const spendBadge =
    expenseAlertCount > 0
      ? `${expenseAlertCount} alert${expenseAlertCount === 1 ? '' : 's'}`
      : monthlyExpenseCount > 0
        ? 'Monthly spend'
        : 'Cost view';
  const spendAccent = expenseAlertCount > 0 ? '#5f9ea0' : '#60a5fa';
  const spendSummary =
    monthlySpendTotal !== null && monthlyExpenseCount > 0
      ? `${expenseHeadline} ${fuelSummary}`
      : expenseHeadline;

  const handleOdometerPress = useCallback(() => {
    (navigation as any).navigate('Odometer');
  }, [navigation]);

  const ownershipTimelineItems = useMemo<TimelineItem[]>(
    () => [
      {
        id: 'health',
        eyebrow: vehicle ? 'Vehicle health' : 'Garage setup',
        title: serviceTitle,
        description: serviceSummary,
        icon: vehicle ? 'shield-check' : 'car-plus',
        iconSet: 'mc',
        accent: serviceAccent,
        badge: serviceBadge,
        cta: vehicle ? 'Open health' : 'Go to garage',
        stage:
          serviceAlertCount > 0
            ? 'Now'
            : serviceDueSoonCount > 0
              ? 'Next'
              : 'Later',
        priority:
          serviceAlertCount > 0
            ? 'urgent'
            : serviceDueSoonCount > 0
              ? 'normal'
              : 'good',
        priorityScore:
          serviceAlertCount > 0 ? 100 : serviceDueSoonCount > 0 ? 80 : 40,
        onPress: () =>
          vehicle
            ? navigateToRootScreen('WarrantyStatus')
            : navigateToRootScreen('VehicleList'),
      },
      {
        id: 'documents',
        eyebrow: 'Document readiness',
        title: documentTitle,
        description: documentSummary,
        icon: 'file-document-check-outline',
        iconSet: 'mc',
        accent: documentAccent,
        badge: documentBadge,
        cta: 'Open glovebox',
        stage:
          missingDocumentTypes.length > 0
            ? 'Now'
            : documentsNeedingReview.length > 0
              ? 'Next'
              : 'Later',
        priority:
          missingDocumentTypes.length > 0
            ? 'urgent'
            : documentsNeedingReview.length > 0
              ? 'normal'
              : 'good',
        priorityScore:
          missingDocumentTypes.length > 0
            ? 90
            : documentsNeedingReview.length > 0
              ? 75
              : 35,
        onPress: () => navigateToRootScreen('DocumentList'),
      },
      {
        id: 'odometer',
        eyebrow: 'Daily upkeep',
        title: !lastOdometerUpdate
          ? 'Update odometer'
          : odometerAgeDays && odometerAgeDays > 7
            ? 'Odometer is stale'
            : 'Keep readings fresh',
        description: odometerSummary,
        icon: 'speedometer-outline',
        iconSet: 'ion',
        accent:
          !lastOdometerUpdate ||
          (odometerAgeDays !== null && odometerAgeDays > 7)
            ? '#5f9ea0'
            : '#38bdf8',
        badge: !lastOdometerUpdate
          ? 'Missing'
          : odometerAgeDays === 0
            ? 'Updated today'
            : `${odometerAgeDays ?? 0}d ago`,
        cta: 'Update reading',
        stage:
          !lastOdometerUpdate ||
          (odometerAgeDays !== null && odometerAgeDays > 7)
            ? 'Now'
            : 'Later',
        priority:
          !lastOdometerUpdate ||
          (odometerAgeDays !== null && odometerAgeDays > 7)
            ? 'urgent'
            : 'good',
        priorityScore: !lastOdometerUpdate
          ? 92
          : odometerAgeDays !== null && odometerAgeDays > 7
            ? 88
            : 28,
        onPress: handleOdometerPress,
      },
      {
        id: 'costs',
        eyebrow: 'Running costs',
        title: spendTitle,
        description: spendSummary,
        icon: 'wallet',
        iconSet: 'fa',
        accent: spendAccent,
        badge: fuelLoading ? 'Updating' : spendBadge,
        cta: 'Open expenses',
        stage:
          expenseAlertCount > 0
            ? 'Now'
            : monthlyExpenseCount > 0
              ? 'Next'
              : 'Later',
        priority:
          expenseAlertCount > 0
            ? 'urgent'
            : monthlyExpenseCount > 0
              ? 'normal'
              : 'good',
        priorityScore:
          expenseAlertCount > 0 ? 85 : monthlyExpenseCount > 0 ? 60 : 25,
        onPress: () => navigateToRootScreen('Expenses'),
      },
      {
        id: 'trip',
        eyebrow: 'Trip ready',
        title: 'Plan the next drive',
        description: userLocationDisplay.includes(',')
          ? `Estimate route costs, stops and trip spend around ${userLocationDisplay}.`
          : 'Build a route budget before your next long drive.',
        icon: 'map-search-outline',
        iconSet: 'mc',
        accent: '#a78bfa',
        badge: 'Planner',
        cta: 'Plan trip',
        stage: 'Later',
        priority: 'normal',
        priorityScore: 20,
        onPress: () => navigateToRootScreen('TripExpense'),
      },
      {
        id: 'ai',
        eyebrow: 'AI copilot',
        title: 'Ask what needs attention',
        description: vehicle
          ? `Get a quick summary for your ${getBannerVehicleShortName(vehicle)} with service, spend and support suggestions.`
          : 'Use AI to set up your garage, expenses and support faster.',
        icon: 'sparkles',
        iconSet: 'mc',
        accent: '#22d3ee',
        badge: 'Action ready',
        cta: 'Open AI',
        stage: 'Next',
        priority: 'normal',
        priorityScore: 50,
        onPress: () =>
          openAiAssistant(
            vehicle
              ? `Give me a quick ownership summary for my ${getBannerVehicleShortName(vehicle)} and tell me what I should do next.`
              : 'Help me set up my garage and tell me the first three things I should complete in the app.',
          ),
      },
    ],
    [
      documentAccent,
      documentBadge,
      documentSummary,
      documentTitle,
      documentsNeedingReview.length,
      expenseAlertCount,
      fuelLoading,
      getBannerVehicleShortName,
      handleOdometerPress,
      lastOdometerUpdate,
      missingDocumentTypes.length,
      monthlyExpenseCount,
      navigateToRootScreen,
      odometerAgeDays,
      odometerSummary,
      openAiAssistant,
      serviceAccent,
      serviceAlertCount,
      serviceBadge,
      serviceDueSoonCount,
      serviceSummary,
      serviceTitle,
      spendBadge,
      spendSummary,
      spendTitle,
      userLocationDisplay,
      vehicle,
    ],
  );

  const sortedOwnershipTimelineItems = useMemo(
    () =>
      [...ownershipTimelineItems].sort(
        (a, b) => b.priorityScore - a.priorityScore,
      ),
    [ownershipTimelineItems],
  );
  const recommendedTimelineItemId = sortedOwnershipTimelineItems[0]?.id;

  useEffect(() => {
    timelineEntranceAnim.setValue(0);
    Animated.timing(timelineEntranceAnim, {
      toValue: 1,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [recommendedTimelineItemId, timelineEntranceAnim]);

  const renderCarouselSlide = useCallback(
    ({ item }: { item: HomeCarouselSlide }) => {
      if (item === 'vehicle') {
        return (
          <VehicleSlide
            bannerWidth={bannerWidth}
            vehicleLoading={vehicleLoading}
            vehicle={vehicle}
            serviceDueText={serviceDueText}
            navigateToGarageTab={navigateToGarageTab}
            getBannerVehicleShortName={getBannerVehicleShortName}
          />
        );
      }

      if (item === 'expenses') {
        return (
          <ExpenseSlide
            bannerWidth={bannerWidth}
            onPress={handleExpenseSlidePress}
          />
        );
      }

      if (item === 'services') {
        return (
          <ServicesSlide
            bannerWidth={bannerWidth}
            onPress={handleServicesSlidePress}
          />
        );
      }

      if (item === 'social') {
        return <SocialSlide bannerWidth={bannerWidth} />;
      }

      if (item === 'drivingBehavior') {
        return (
          <DrivingBehaviorSlide
            bannerWidth={bannerWidth}
            onPress={handleDrivingBehaviorSlidePress}
          />
        );
      }

      if (item === 'tripPlanner') {
        return (
          <TripPlannerSlide
            bannerWidth={bannerWidth}
            onPress={handleTripPlannerSlidePress}
          />
        );
      }

      if (item === 'odometer') {
        return (
          <OdometerSlide
            bannerWidth={bannerWidth}
            vehicle={vehicle}
            onPress={handleOdometerPress}
          />
        );
      }

      return null;
    },
    [
      bannerWidth,
      getBannerVehicleShortName,
      handleDrivingBehaviorSlidePress,
      handleExpenseSlidePress,
      handleOdometerPress,
      handleServicesSlidePress,
      handleTripPlannerSlidePress,
      navigateToGarageTab,
      serviceDueText,
      vehicle,
      vehicleLoading,
    ],
  );

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
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#5F9EA0"
            colors={['#5F9EA0']}
          />
        }
      >
        <View style={styles.headerWrapper}>
          <FlatList
            ref={carouselRef}
            horizontal
            pagingEnabled
            decelerationRate="fast"
            snapToInterval={bannerWidth}
            snapToAlignment="start"
            disableIntervalMomentum
            bounces={false}
            getItemLayout={(_: any, index: number) => ({
              length: bannerWidth,
              offset: bannerWidth * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              carouselRef.current?.scrollToOffset({
                offset: info.index * bannerWidth,
                animated: true,
              });
            }}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={pauseAutoScrollTemporarily}
            onMomentumScrollEnd={handleBannerMomentumEnd}
            data={carouselSlides}
            keyExtractor={item => item}
            onTouchStart={pauseAutoScrollTemporarily}
            renderItem={renderCarouselSlide}
          />

          <View style={styles.indicatorContainer}>
            {carouselSlides.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  carouselIndex === index
                    ? styles.dotActive
                    : styles.dotInactive,
                ]}
              />
            ))}
          </View>

          <View style={styles.headerOverlay}>
            <TouchableOpacity
              onPress={handleProfilePress}
              style={styles.overlayIconButton}
            >
              <Icon name="user" size={wp(5.2)} color="#fff" />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity
                onPress={handleAlertsPress}
                style={styles.overlayIconButton}
              >
                <Icon name="bell" size={wp(4.6)} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSOSPress}
                style={styles.sosOverlayButton}
              >
                <Icon name="shield-alt" size={wp(4)} color="#fff" />
                <Text style={styles.sosOverlayText}>SOS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <NumberPlateSearchBar
          animatedPlaceholder={animatedPlaceholder}
          onPress={handleVehicleSearchPress}
        />

        <QuickServicesGrid onServicePress={handleQuickServicePress} />

        <OwnershipTimeline
          items={sortedOwnershipTimelineItems}
          recommendedId={recommendedTimelineItemId}
          entranceAnim={timelineEntranceAnim}
        />

        <ChallanBanner onPress={handleChallanPress} />

        <TrendingVideosSection
          videos={trendingVideos}
          loading={discoveryLoading}
          selectedVideoId={selectedVideo?.id}
          onVideoPress={handleVideoPress}
          getYouTubeVideoId={getYouTubeVideoId}
          onViewMorePress={handleViewMoreVideos}
        />

        <FuelPricesSection
          fuelPrices={fuelPrices}
          fuelLoading={fuelLoading}
          selectedState={selectedState}
          userLocationDisplay={userLocationDisplay}
          locationLoading={locationLoading}
          onStateModalOpen={handleStateModalOpen}
        />

        <TrendingNewsSection
          news={trendingNews}
          loading={discoveryLoading}
          onNewsPress={handleNewsPress}
          onViewMorePress={handleViewMoreNews}
        />

        <ComingSoonSection />

        <View style={{ height: hp(3) }} />
      </ScrollView>

      <StateSelectionModal
        visible={showStateModal}
        selectedState={selectedState}
        onSelect={handleStateSelect}
        onClose={handleStateModalClose}
      />

      <FloatingVideoPlayer
        selectedVideo={selectedVideo}
        isVideoDragging={isVideoDragging}
        isVideoExpanded={isVideoExpanded}
        miniBaseTop={miniBaseTop}
        miniBaseLeft={miniBaseLeft}
        miniVideoCardWidth={miniVideoCardWidth}
        expandedBaseTop={expandedBaseTop}
        expandedBaseLeft={expandedBaseLeft}
        expandedVideoCardWidth={expandedVideoCardWidth}
        videoBaseX={videoBaseX}
        videoBaseY={videoBaseY}
        videoDragX={videoDragX}
        videoDragY={videoDragY}
        videoDragGestureEvent={videoDragGestureEvent}
        handleVideoGestureStateChange={handleVideoGestureStateChange}
        onToggleExpanded={toggleVideoExpanded}
        onClose={closeSelectedVideo}
      />

      <ServiceOptionsOverlay
        visible={serviceModalVisible}
        onClose={() => setServiceModalVisible(false)}
        onSelect={screen => {
          setServiceModalVisible(false);
          navigateToServicesScreen(screen);
        }}
      />
    </SafeAreaView>
  );
}
