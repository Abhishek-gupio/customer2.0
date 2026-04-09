import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Image,
  Linking,
  RefreshControl,
} from 'react-native';
import FastImage from 'react-native-fast-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { useNavigation } from '../../lib/react-navigation-native';
import { api } from '../../services/api';
import BackButton from '../../components/BackButton';
import { getDIYGuidesCache, setDIYGuidesCache } from '../../services/storage';
import LoadingSpinner from '../../components/LoadingSpinner';

interface DIYGuide {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  videoUrl: string;
  duration: string;
  category: 'MAINTENANCE' | 'REPAIR' | 'CLEANING' | 'ESSENTIALS';
}

const FALLBACK_THUMBNAILS: Record<DIYGuide['category'], any> = {
  MAINTENANCE: require('../../assets/images/car_service.jpg'),
  REPAIR: require('../../assets/images/mechanic_icon.jpg'),
  CLEANING: require('../../assets/images/yellow_car_in_sv.png'),
  ESSENTIALS: require('../../assets/images/service_custom.jpg'),
};

function getYouTubeVideoId(url: unknown): string | null {
  if (typeof url !== 'string') return null;

  const trimmedUrl = url.trim();
  if (!trimmedUrl) return null;

  try {
    const parsedUrl = new URL(trimmedUrl);
    const hostname = parsedUrl.hostname.replace(/^www\./, '').replace(/^m\./, '');

    if (hostname === 'youtu.be') {
      const shortId = parsedUrl.pathname.split('/').filter(Boolean)[0] ?? '';
      return shortId.length === 11 ? shortId : null;
    }

    const watchId = parsedUrl.searchParams.get('v');
    if (watchId?.length === 11) return watchId;

    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
    const pathPrefixIndex = pathSegments.findIndex((segment) =>
      ['embed', 'shorts', 'v'].includes(segment)
    );

    if (pathPrefixIndex >= 0) {
      const pathId = pathSegments[pathPrefixIndex + 1] ?? '';
      return pathId.length === 11 ? pathId : null;
    }

    const fallbackMatch = trimmedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/
    );
    return fallbackMatch?.[1] ?? null;
  } catch {
    const fallbackMatch = trimmedUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/|v\/|u\/\w\/))([A-Za-z0-9_-]{11})/
    );
    return fallbackMatch?.[1] ?? null;
  }
}

function getGuidePreviewSource(guide: DIYGuide) {
  const youtubeId = getYouTubeVideoId(guide.videoUrl);
  if (youtubeId) {
    return { uri: `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg` };
  }

  const trimmedThumbnail = typeof guide.thumbnail === 'string' ? guide.thumbnail.trim() : '';
  if (trimmedThumbnail) {
    return { uri: trimmedThumbnail };
  }

  return null;
}

export default function DIYGuides() {
  const navigation = useNavigation();
  const [guides, setGuides] = useState<DIYGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  const fetchGuides = useCallback(async (isManualRefresh = false) => {
    try {
      const cached = getDIYGuidesCache();
      if (cached && guides.length === 0 && !isManualRefresh) {
        setGuides(cached);
        setLoading(false);
      } else if (!isManualRefresh) {
        setLoading(true);
      }

      const response = await api.get<{ success: boolean; data: DIYGuide[] }>('/v1/diy/guides');
      const data = (response as any).data || response;
      
      if (Array.isArray(data)) {
        setGuides(data);
        setDIYGuidesCache(data);
      }
    } catch (error) {
      console.error('Failed to fetch DIY guides:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [guides.length]);

  useEffect(() => {
    fetchGuides();
  }, [fetchGuides]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGuides(true);
  }, [fetchGuides]);

  const filteredGuides = activeCategory === 'ALL' 
    ? guides 
    : guides.filter(g => g.category === activeCategory);

  const categories = ['ALL', 'MAINTENANCE', 'REPAIR', 'ESSENTIALS', 'CLEANING'];

  const handleWatchVideo = (url: string) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <BackButton style={styles.backBtn} onPress={() => navigation.goBack()} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Engine Mastery</Text>
          <Text style={styles.headerSubtitle}>EXPERT MECHANICAL GUIDES</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        <View style={styles.heroSection}>
          <Text style={styles.heroTitle}>Master Your Machine</Text>
          <Text style={styles.heroDesc}>Professional tutorials for vehicle maintenance. Performance precision in every step.</Text>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>CATEGORIES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsContent}>
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.tab,
                  activeCategory === cat && styles.activeTab,
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.tabText,
                  activeCategory === cat && styles.activeTabText,
                ]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.listSection}>
          <View style={styles.sectionHeader}>
             <Text style={styles.sectionTitle}>TUTORIALS</Text>
             <Text style={styles.countBadge}>{filteredGuides.length} GUIDES</Text>
          </View>

          {filteredGuides.map((guide) => (
            <TouchableOpacity 
              key={guide.id} 
              style={styles.guideCard}
              onPress={() => handleWatchVideo(guide.videoUrl)}
              activeOpacity={0.9}
            >
              <View style={styles.thumbnailContainer}>
                {(() => {
                  const previewSource = getGuidePreviewSource(guide);
                  return (
                    <>
                      <Image
                        source={FALLBACK_THUMBNAILS[guide.category]}
                        style={styles.fallbackThumbnail}
                        resizeMode="cover"
                      />
                      {previewSource ? (
                        <FastImage
                          source={{
                            ...(previewSource as any),
                            priority: FastImage.priority.high,
                          }}
                          style={styles.cardThumbnail}
                          resizeMode={FastImage.resizeMode.cover}
                        />
                      ) : null}
                    </>
                  );
                })()}
                <View style={styles.thumbnailShade} />
                <View style={styles.playOverlay}>
                  <IconMC name="play" size={wp(5)} color="#000" />
                </View>
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{guide.duration}</Text>
                </View>
              </View>
              
              <View style={styles.cardInfo}>
                 <View style={styles.cardInfoTop}>
                    <View style={styles.categoryBadge}>
                       <Text style={styles.categoryText}>{guide.category}</Text>
                    </View>
                    <IconMC name="youtube" size={wp(3.5)} color="#444" />
                 </View>
                 <Text style={styles.cardTitle} numberOfLines={2}>{guide.title}</Text>
                 <Text style={styles.cardDesc} numberOfLines={2}>{guide.description}</Text>
                 
                 <View style={styles.cardFooter}>
                    <View style={styles.verifiedTag}>
                       <IconMC name="shield-check" size={wp(3.2)} color="#22C55E" />
                       <Text style={styles.verifiedText}>GUPIO VERIFIED</Text>
                    </View>
                    <View style={styles.watchLink}>
                       <Text style={styles.watchLinkText}>WATCH NOW</Text>
                       <IconMC name="arrow-right" size={wp(3)} color="#fff" />
                    </View>
                 </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredGuides.length === 0 && !loading && (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconCircle}>
                 <IconMC name="toolbox-outline" size={wp(10)} color="#1a1a1a" />
              </View>
              <Text style={styles.emptyTitle}>New Guides Incoming</Text>
              <Text style={styles.emptyText}>Our experts are documenting new tutorials. Check back soon.</Text>
            </View>
          )}
        </View>
        
        <View style={styles.disclaimer}>
           <IconMC name="alert-circle-outline" size={wp(3.5)} color="#222" />
           <Text style={styles.disclaimerText}>FOLLOW SAFETY PROTOCOLS. DATA SOURCED FROM OEM MANUALS.</Text>
        </View>
      </ScrollView>
      <LoadingSpinner visible={loading && guides.length === 0} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2),
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)'
  },
  backBtn: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#111' },
  headerTitleContainer: { flex: 1, marginLeft: wp(4) },
  headerTitle: { fontSize: wp(5), fontFamily: 'Outfit-Bold', color: '#fff' },
  headerSubtitle: { fontSize: wp(2.5), fontFamily: 'Outfit-Black', color: '#444' },
  content: { flex: 1 },
  heroSection: { paddingHorizontal: wp(6), paddingVertical: hp(4), backgroundColor: '#030303' },
  heroTitle: { color: '#fff', fontSize: wp(7.5), fontFamily: 'Outfit-Black' },
  heroDesc: { color: '#444', fontSize: wp(3.5), fontFamily: 'Outfit-Medium', marginTop: hp(1), lineHeight: wp(5.5) },
  
  filterSection: { paddingVertical: hp(2.5) },
  filterLabel: { color: '#222', fontSize: wp(2.8), fontFamily: 'Outfit-Black', marginLeft: wp(6), marginBottom: hp(1.5), letterSpacing: 1 },
  tabsContent: { paddingHorizontal: wp(6), gap: wp(2) },
  tab: { paddingHorizontal: wp(5), paddingVertical: hp(1), borderRadius: 12, backgroundColor: '#050505', borderWidth: 1, borderColor: '#111' },
  activeTab: { backgroundColor: '#fff', borderColor: '#fff' },
  tabText: { fontSize: wp(3), fontFamily: 'Outfit-Bold', color: '#444' },
  activeTabText: { color: '#000' },

  listSection: { paddingHorizontal: wp(5) },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: hp(3), paddingHorizontal: wp(1) },
  sectionTitle: { color: '#fff', fontSize: wp(3.2), fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
  countBadge: { color: '#222', fontSize: wp(2.5), fontFamily: 'Outfit-Black' },
  
  guideCard: { backgroundColor: '#050505', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#111', marginBottom: hp(3) },
  thumbnailContainer: {
    height: hp(20),
    width: '100%',
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackThumbnail: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  cardThumbnail: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 1,
  },
  thumbnailShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  playOverlay: { position: 'absolute', width: wp(12), height: wp(12), borderRadius: wp(6), backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  durationBadge: { position: 'absolute', bottom: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.8)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  durationText: { color: '#fff', fontSize: wp(2.5), fontFamily: 'Outfit-Bold' },
  
  cardInfo: { padding: wp(5) },
  cardInfoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#111', borderRadius: 6 },
  categoryText: { color: '#fff', fontSize: wp(2.4), fontFamily: 'Outfit-Black', letterSpacing: 0.5 },
  cardTitle: { fontSize: wp(4.5), fontFamily: 'Outfit-Bold', color: '#fff', lineHeight: wp(6) },
  cardDesc: { marginTop: 8, fontSize: wp(3.2), fontFamily: 'Outfit-Regular', color: '#444', lineHeight: wp(5) },
  
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: hp(2.5), paddingTop: hp(2), borderTopWidth: 1, borderTopColor: '#111' },
  verifiedTag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedText: { fontSize: wp(2.4), color: '#22C55E', fontFamily: 'Outfit-Black' },
  watchLink: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  watchLinkText: { color: '#fff', fontFamily: 'Outfit-Black', fontSize: wp(2.8) },

  emptyState: { alignItems: 'center', marginTop: hp(5), gap: hp(2) },
  emptyIconCircle: { width: wp(20), height: wp(20), borderRadius: wp(10), backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#111' },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5) },
  emptyText: { color: '#444', fontFamily: 'Outfit-Regular', fontSize: wp(3.5), textAlign: 'center', paddingHorizontal: wp(10) },
  
  disclaimer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: hp(6), paddingHorizontal: wp(10) },
  disclaimerText: { fontSize: wp(2.2), color: '#1a1a1a', textAlign: 'center', fontFamily: 'Outfit-Black', letterSpacing: 1 }
});
