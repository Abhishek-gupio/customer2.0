import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  FlatList,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import LoadingSpinner from '../../components/LoadingSpinner';
import { navigateToServiceDestination } from '../../navigation/serviceNavigation';
import {
  getServiceHubItemById,
  serviceHubAds,
  serviceHubCategories,
  type ServiceHubId,
  type ServiceIconSet,
} from '../../config/servicesConfig';

function renderParkingIcon(color: string, size: number, large = false) {
  return (
    <View style={large ? styles.parkingIconLargeWrap : styles.parkingIconWrap}>
      <View style={large ? styles.parkingMarkerLarge : styles.parkingMarker}>
        <IconMC
          name="alpha-p-circle-outline"
          size={large ? size * 0.94 : size * 0.86}
          color={color}
        />
      </View>
      <View style={large ? styles.parkingCarLarge : styles.parkingCar}>
        <IconMC
          name="car-outline"
          size={large ? size * 0.94 : size * 0.86}
          color={color}
        />
      </View>
    </View>
  );
}

function renderTowingIcon(color: string, size: number, large = false) {
  return (
    <View style={large ? styles.towingIconLargeWrap : styles.towingIconWrap}>
      <IconMC name="tow-truck" size={size} color={color} />
    </View>
  );
}

function renderServiceIcon(
  item: { icon: string; iconSet: ServiceIconSet | 'fa' },
  color: string,
  size: number,
  large = false
) {
  if (item.iconSet === 'parking') {
    return renderParkingIcon(color, size, large);
  }

  if (item.iconSet === 'towing') {
    return renderTowingIcon(color, size, large);
  }

  if (item.iconSet === 'mc') {
    return <IconMC name={item.icon as any} size={size} color={color} />;
  }

  return <Icon name={item.icon as any} size={size} color={color} />;
}

export default function ServicesHub() {
  const navigation = useNavigation<any>();
  const [adIndex, setAdIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      let nextIndex = (adIndex + 1) % serviceHubAds.length;
      setAdIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [adIndex]);

  const onServicePress = useCallback((id: ServiceHubId) => {
    const service = getServiceHubItemById(id);
    if (!service) return;

    if (id === 'PartsWarranty') {
      setNavLoading(true);
      setTimeout(() => {
        setNavLoading(false);
        navigateToServiceDestination(navigation as any, service.destination, 'services');
      }, 300); // Brief transition delay for better animation feel
      return;
    }

    navigateToServiceDestination(navigation as any, service.destination, 'services');
  }, [navigation]);

  const adKeyExtractor = useCallback((item: typeof serviceHubAds[number]) => item.id, []);

  const renderAdItem = useCallback(
    ({ item }: { item: typeof serviceHubAds[number] }) => (
      <TouchableOpacity
        style={styles.adCard}
        activeOpacity={0.9}
        onPress={() => onServicePress(item.targetId)}
      >
        <View style={styles.adContent}>
          <View style={styles.adLeft}>
            <Text style={[styles.adSubtitle, { color: item.theme }]}>{item.subtitle}</Text>
            <Text style={styles.adTitle}>{item.title}</Text>
            <Text style={styles.adDesc} numberOfLines={2}>{item.desc}</Text>
            <View style={styles.tryNowBtn}>
              <Text style={[styles.tryNowText, { color: item.theme }]}>Try Now</Text>
              <Icon name="chevron-right" size={10} color={item.theme} />
            </View>
          </View>
          <View style={styles.adRight}>
            <View style={[styles.adIconCircle, { backgroundColor: `${item.theme}20` }]}>
              {renderServiceIcon(item as any, item.theme, wp(10), true)}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    ),
    [onServicePress]
  );

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredCategories = serviceHubCategories.map((cat) => {
    const filteredIds = cat.itemIds.filter((id) => {
      const item = getServiceHubItemById(id);
      if (!item) return false;
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        cat.title.toLowerCase().includes(normalizedSearch)
      );
    });
    return { ...cat, itemIds: filteredIds };
  }).filter((cat) => cat.itemIds.length > 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate('Home');
            }}
            activeOpacity={0.8}
          >
            <IconMC name="arrow-left" size={wp(6.2)} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Services Hub</Text>
            <Text style={styles.headerSubtitle}>Explore automotive care & utilities</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.headerIcon}
          onPress={() => {
            if (isSearchVisible && searchQuery.trim().length > 0) {
              setSearchQuery('');
              return;
            }
            setIsSearchVisible((prev) => !prev);
          }}
        >
          <IconMC
            name={isSearchVisible && searchQuery.trim().length > 0 ? 'close' : 'magnify'}
            size={wp(5.5)}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      {isSearchVisible ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchInputWrap}>
            <IconMC name="magnify" size={wp(4.5)} color="rgba(255,255,255,0.45)" />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search services..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              style={styles.searchInput}
              autoFocus
            />
          </View>
        </View>
      ) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Ad Carousel */}
        <View style={styles.adsWrapper}>
          <FlatList
            ref={flatListRef}
            data={serviceHubAds}
            keyExtractor={adKeyExtractor}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / wp(90));
              setAdIndex(index);
            }}
            renderItem={renderAdItem}
          />
          {/* Indicators */}
          <View style={styles.indicators}>
            {serviceHubAds.map((ad, i) => (
              <View
                key={ad.id}
                style={[
                  styles.dot,
                  adIndex === i ? styles.dotActive : styles.dotInactive
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {filteredCategories.map((cat) => (
            <View key={cat.title} style={styles.categoryWrap}>
              <Text style={[styles.categoryTitle, { borderLeftColor: cat.color }]}>{cat.title}</Text>
              <View style={styles.row}>
                {cat.itemIds.map((id) => {
                  const item = getServiceHubItemById(id);
                  if (!item) return null;
                  return (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.button}
                        onPress={() => onServicePress(item.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.iconBox}>
                          {renderServiceIcon(item, '#fff', wp(5.8))}
                        </View>
                        <Text style={styles.label} numberOfLines={2}>{item.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
          ))}
          {normalizedSearch && filteredCategories.length === 0 ? (
            <View style={styles.emptySearchState}>
              <IconMC name="magnify-close" size={wp(8)} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptySearchTitle}>No services found</Text>
              <Text style={styles.emptySearchText}>Try a different keyword like warranty, fuel, parking, or challan.</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.nearbyLauncher}
          activeOpacity={0.9}
          onPress={() => onServicePress('NearbyPlaces')}
        >
          <View style={styles.nearbyLauncherIcon}>
            <IconMC name="map-search" size={wp(6)} color="#fff" />
          </View>
          <View style={styles.nearbyLauncherTextWrap}>
            <Text style={styles.nearbyLauncherTitle}>Nearby</Text>
            <Text style={styles.nearbyLauncherText}>Open all nearby screens and place search</Text>
          </View>
          <IconMC name="chevron-right" size={wp(5.5)} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>

        <View style={styles.infoRow}>
          <Icon name="info-circle" size={wp(3)} color="#444" />
          <Text style={styles.infoText}>This hub now shows only direct services that are ready to use.</Text>
        </View>
      </ScrollView>
      <LoadingSpinner visible={navLoading} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    paddingTop: hp(4),
    paddingBottom: hp(2),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3.5),
    flexShrink: 1,
  },
  headerTitle: {
    fontSize: wp(6.5),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  backButton: {
    width: wp(13.5),
    height: wp(13.5),
    borderRadius: wp(4.5),
    backgroundColor: '#181818',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerIcon: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  scrollContent: {
    paddingBottom: hp(4),
  },
  nearbyLauncher: {
    marginHorizontal: wp(5),
    marginBottom: hp(2),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderRadius: 18,
    backgroundColor: '#12161d',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  nearbyLauncherIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nearbyLauncherTextWrap: {
    flex: 1,
  },
  nearbyLauncherTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
  },
  nearbyLauncherText: {
    color: 'rgba(255,255,255,0.6)',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.1),
    marginTop: hp(0.3),
  },
  searchWrap: {
    paddingHorizontal: wp(6),
    paddingBottom: hp(1.5),
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: wp(4),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.6),
    padding: 0,
  },
  adsWrapper: {
    marginBottom: hp(2),
    paddingHorizontal: wp(5),
  },
  adCard: {
    width: wp(90),
    height: hp(18),
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: wp(5),
    overflow: 'hidden',
  },
  adContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  adLeft: {
    flex: 1.5,
  },
  adSubtitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  adTitle: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(5),
    color: '#fff',
    marginBottom: 4,
  },
  adDesc: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(2.8),
    color: '#888',
    lineHeight: 16,
    marginBottom: 10,
  },
  tryNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tryNowText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  adRight: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  adIconCircle: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingIconWrap: {
    width: wp(8.8),
    height: wp(8.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingIconLargeWrap: {
    width: wp(11.8),
    height: wp(11.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  parkingMarker: {
    position: 'absolute',
    top: -wp(0.7),
    alignSelf: 'center',
    zIndex: 0,
    transform: [{ translateX: -wp(0.35) }],
  },
  parkingMarkerLarge: {
    position: 'absolute',
    top: -wp(0.95),
    alignSelf: 'center',
    zIndex: 0,
    transform: [{ translateX: -wp(0.45) }],
  },
  parkingCar: {
    position: 'absolute',
    bottom: -wp(0.65),
    alignSelf: 'center',
    zIndex: 1,
  },
  parkingCarLarge: {
    position: 'absolute',
    bottom: -wp(0.9),
    alignSelf: 'center',
    zIndex: 1,
  },
  towingIconWrap: {
    width: wp(8.8),
    height: wp(8.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  towingIconLargeWrap: {
    width: wp(11.8),
    height: wp(11.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    height: 4,
    width: 6,
    borderRadius: 2,
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 14,
  },
  dotInactive: {
    backgroundColor: '#444',
  },
  content: {
    paddingHorizontal: wp(4),
    paddingTop: hp(1),
  },
  categoryWrap: {
    marginBottom: hp(3),
  },
  categoryTitle: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    color: '#fff',
    marginBottom: hp(2),
    paddingLeft: wp(3),
    borderLeftWidth: 3,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: wp(2.5),
  },
  button: {
    width: wp(20),
    alignItems: 'center',
    marginBottom: hp(2),
  },
  iconBox: {
    width: wp(14.5),
    height: wp(14.5),
    borderRadius: wp(4.5),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(0.8),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  label: {
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    color: '#fff',
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: hp(2),
    opacity: 0.5,
  },
  infoText: {
    color: '#444',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
  },
  emptySearchState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(5),
    paddingHorizontal: wp(8),
  },
  emptySearchTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
    marginTop: hp(1.2),
  },
  emptySearchText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    marginTop: hp(0.8),
    lineHeight: 18,
  },
});
