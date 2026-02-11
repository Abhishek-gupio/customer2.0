import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  FlatList,
  Dimensions,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Video from 'react-native-video';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH;

// Color scheme
const COLORS = {
  white: '#FFFFFF',
  navyBlue: '#001f3f',
  yellow: '#FFC107',
  lightGray: '#F5F5F5',
  darkGray: '#333333',
  borderGray: '#E0E0E0',
  textGray: '#666666',
  lightBlue: '#E3F2FD',
};

interface CarouselItem {
  id: string;
  video: any;
}

interface HomeScreenProps {
  navigation: any;
}

interface QuickActionButton {
  id: string;
  title: string;
  icon: string;
  color: string;
  onPress: () => void;
}

interface BottomNavItem {
  id: string;
  label: string;
  icon: string;
  iconType?: 'ionicon' | 'emoji';
  active: boolean;
}

export const Home: React.FC<HomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [activeBottomTab, setActiveBottomTab] = useState('home');
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const carouselRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  // Carousel data - videos (place three mp4 files in `src/assets/videos`)
  const carouselItems: CarouselItem[] = [
    { id: '1', video: require('../../assets/videos/video1.mp4') },
    { id: '2', video: require('../../assets/videos/video2.mp4') },
    { id: '3', video: require('../../assets/videos/video3.mp4') },
  ];

  // Auto-scroll carousel every 8 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % carouselItems.length;
        carouselRef.current?.scrollToIndex({
          index: nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [carouselItems.length]);

  const quickActionButtons: QuickActionButton[] = [
    {
      id: '1',
      title: 'Service',
      icon: '🔧',
      color: '#FF6B6B',
      onPress: () => console.log('Service pressed'),
    },
    {
      id: '2',
      title: 'Booking',
      icon: '📅',
      color: '#4ECDC4',
      onPress: () => console.log('Booking pressed'),
    },
    {
      id: '3',
      title: 'History',
      icon: '📋',
      color: '#95E1D3',
      onPress: () => console.log('History pressed'),
    },
    {
      id: '4',
      title: 'Support',
      icon: '💬',
      color: '#F38181',
      onPress: () => console.log('Support pressed'),
    },
  ];

  const secondRowButtons: QuickActionButton[] = [
    {
      id: '5',
      title: 'Vehicles',
      icon: '🚗',
      color: '#AA96DA',
      onPress: () => console.log('Vehicles pressed'),
    },
    {
      id: '6',
      title: 'Documents',
      icon: '📄',
      color: '#FCBAD3',
      onPress: () => console.log('Documents pressed'),
    },
    {
      id: '7',
      title: 'Expenses',
      icon: '💰',
      color: '#A8D8EA',
      onPress: () => console.log('Expenses pressed'),
    },
    {
      id: '8',
      title: 'Valet',
      icon: '🅿️',
      color: '#FFD3B6',
      onPress: () => console.log('Valet pressed'),
    },
  ];

  const bottomNavItems: BottomNavItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: 'home',
      iconType: 'ionicon',
      active: activeBottomTab === 'home',
    },
    {
      id: 'search',
      label: 'Search',
      icon: 'search',
      iconType: 'ionicon',
      active: activeBottomTab === 'search',
    },
    {
      id: 'ai',
      label: 'AI',
      icon: 'sparkles',
      iconType: 'ionicon',
      active: activeBottomTab === 'ai',
    },
    {
      id: 'notification',
      label: 'Notify',
      icon: 'notifications',
      iconType: 'ionicon',
      active: activeBottomTab === 'notification',
    },
    {
      id: 'history',
      label: 'History',
      icon: 'time',
      iconType: 'ionicon',
      active: activeBottomTab === 'history',
    },
  ];

  const renderCarouselItem = ({ item }: { item: CarouselItem }) => (
    <View style={styles.carouselItemContainer}>
      <View style={styles.carouselCard}>
        <Video
          source={item.video}
          style={styles.carouselVideo}
          resizeMode="cover"
          repeat
          muted
          paused={false}
        />
      </View>
    </View>
  );

  const renderQuickActionButton = (item: QuickActionButton) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={styles.quickActionButton}
        onPress={item.onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.iconContainer, { backgroundColor: item.color }]}>
          <Text style={styles.buttonIcon}>{item.icon}</Text>
        </View>
        <Text style={styles.buttonLabel}>{item.title}</Text>
      </TouchableOpacity>
    );
  };

  const renderBottomNavItem = (item: BottomNavItem) => {
    return (
      <TouchableOpacity
        key={item.id}
        style={[
          styles.bottomNavItem,
          item.active && styles.bottomNavItemActive,
        ]}
        onPress={() => setActiveBottomTab(item.id)}
        activeOpacity={0.7}
      >
        <Ionicons
          name={item.icon}
          size={24}
          color={item.active ? COLORS.navyBlue : COLORS.textGray}
          style={styles.bottomNavIcon}
        />
        <Text
          style={[
            styles.bottomNavLabel,
            item.active && styles.bottomNavLabelActive,
          ]}
        >
          {item.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCarouselDot = (index: number) => (
    <View
      key={index}
      style={[
        styles.carouselDot,
        index === currentCarouselIndex && styles.carouselDotActive,
      ]}
    />
  );

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header with Logo */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => console.log('Profile pressed')}
        >
          <View style={styles.profileCircle}>
            <Text style={styles.profileIcon}>👤</Text>
          </View>
        </TouchableOpacity>

        {/* Centered Logo */}
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/Gicon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => console.log('Help & Support pressed')}
        >
          <View style={styles.supportCircle}>
            <Text style={styles.supportIcon}>❓</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Carousel Slider */}
        <View style={styles.carouselSection}>
          <FlatList
            ref={carouselRef}
            data={carouselItems}
            renderItem={renderCarouselItem}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { x: scrollX } } }],
              { useNativeDriver: false }
            )}
          />
          {/* Carousel Dots */}
          <View style={styles.carouselDotsContainer}>
            {carouselItems.map((_, index) => renderCarouselDot(index))}
          </View>
        </View>

        {/* First Row of Quick Action Buttons */}
        <View style={styles.buttonRowContainer}>
          <Text style={styles.sectionTitle}>Quick Services</Text>
          <View style={styles.buttonRow}>
            {quickActionButtons.map(renderQuickActionButton)}
          </View>
        </View>

        {/* Second Row of Quick Action Buttons */}
        <View style={styles.buttonRowContainer}>
          <View style={styles.buttonRow}>
            {secondRowButtons.map(renderQuickActionButton)}
          </View>
        </View>

        {/* Additional Content Area */}
        <View style={styles.contentSection}>
          <Text style={styles.sectionTitle}>Recommended For You</Text>
          <View style={styles.recommendedCard}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: COLORS.navyBlue, alignSelf: 'flex-start' },
              ]}
            >
              <Text style={styles.buttonIcon}>🔧</Text>
            </View>
            <View style={styles.recommendedCardContent}>
              <Text style={styles.recommendedTitle}>
                Vehicle Maintenance Due
              </Text>
              <Text style={styles.recommendedSubtitle}>
                Schedule service to keep your vehicle running smoothly
              </Text>
              <TouchableOpacity style={styles.recommendedButton}>
                <Text style={styles.recommendedButtonText}>Book Now</Text>
                <Text style={styles.arrowIcon}>→</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavigation}>
        {bottomNavItems.map(renderBottomNavItem)}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGray,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 22,
  },
  profileCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.navyBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileIcon: {
    fontSize: 20,
  },
  supportCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.yellow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportIcon: {
    fontSize: 20,
  },
  logoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  carouselSection: {
    paddingVertical: 16,
  },
  carouselItemContainer: {
    width: CAROUSEL_ITEM_WIDTH,
    paddingHorizontal: 0,
  },
  carouselCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: COLORS.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  carouselImage: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.lightGray,
  },
  carouselVideo: {
    width: '100%',
    height: 180,
    backgroundColor: COLORS.lightGray,
  },
  carouselContent: {
    padding: 16,
    backgroundColor: COLORS.navyBlue,
  },
  carouselTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.white,
    marginBottom: 6,
  },
  carouselDescription: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 18,
    marginBottom: 12,
  },
  carouselButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  carouselButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.navyBlue,
  },
  arrowIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.navyBlue,
  },
  carouselDotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.borderGray,
  },
  carouselDotActive: {
    backgroundColor: COLORS.navyBlue,
    width: 24,
  },
  buttonRowContainer: {
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: COLORS.navyBlue,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonIcon: {
    fontSize: 24,
  },
  buttonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.white,
    textAlign: 'center',
  },
  contentSection: {
    paddingHorizontal: 16,
    marginVertical: 16,
  },
  recommendedCard: {
    backgroundColor: COLORS.lightBlue,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  recommendedCardContent: {
    flex: 1,
  },
  recommendedTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.navyBlue,
    marginBottom: 4,
  },
  recommendedSubtitle: {
    fontSize: 12,
    color: COLORS.textGray,
    lineHeight: 16,
    marginBottom: 10,
  },
  recommendedButton: {
    flexDirection: 'row',
    backgroundColor: COLORS.yellow,
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
  },
  recommendedButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.navyBlue,
  },
  bottomNavigation: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderGray,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bottomNavItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  bottomNavItemActive: {
    backgroundColor: 'rgba(0, 31, 63, 0.05)',
    borderRadius: 8,
    marginHorizontal: 4,
  },
  bottomNavIcon: {
    marginBottom: 4,
  },
  bottomNavLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: COLORS.textGray,
    marginTop: 4,
  },
  bottomNavLabelActive: {
    color: COLORS.navyBlue,
    fontWeight: '600',
  },
});

export default Home;
