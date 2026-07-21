import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from 'react-native-fast-image';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { communityService, type Community } from '../../services/communityService';
import { useCommunityStore } from '../../store/communityStore';
import { getAbsoluteUrl } from '../../config';
import { colors } from '../../theme';

const TOPIC_CATEGORIES = ['All', 'Electric', 'Maintenance', 'DIY', 'Sedans', 'SUVs', 'Offroad'];

export default function CommunitiesDiscoverScreen() {
  const navigation = useNavigation<any>();
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  
  // Create Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    // If selectedCategory is not 'All', we append it as filter/search query
    const searchQuery = query.trim() || (selectedCategory !== 'All' ? selectedCategory : undefined);
    
    communityService
      .discover({ q: searchQuery, limit: 30 })
      .then(setCommunities)
      .finally(() => setLoading(false));
  }, [query, selectedCategory]);

  useEffect(load, [load]);

  const handleJoinToggle = async (community: Community) => {
    setJoiningId(community.id);
    try {
      if (community.isMember) {
        await communityService.leave(community.id);
      } else {
        await communityService.join(community.id);
      }
      bumpVersion();
      load();
    } finally {
      setJoiningId(null);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await communityService.createCommunity({
        name: newName.trim(),
        type: 'TOPIC',
        description: newDesc.trim() || undefined,
      });
      setNewName('');
      setNewDesc('');
      setModalVisible(false);
      bumpVersion();
      load();
    } finally {
      setCreating(false);
    }
  };

  const handleCategoryPress = (category: string) => {
    setSelectedCategory(category);
    if (category === 'All') {
      setQuery('');
    }
  };

  // Featured communities are communities that have member count > 2 or just first 4 elements when query is empty
  const featuredCommunities = query === '' && selectedCategory === 'All'
    ? communities.slice(0, 4)
    : [];

  const otherCommunities = query === '' && selectedCategory === 'All'
    ? communities.slice(4)
    : communities;

  const renderFeaturedCard = ({ item }: { item: Community }) => {
    const iconUrl = item.iconUrl ? getAbsoluteUrl(item.iconUrl) : null;
    const isJoined = item.isMember;

    return (
      <TouchableOpacity
        style={styles.featuredCard}
        activeOpacity={0.9}
        onPress={() => navigation.navigate('CommunityFeed', { communityId: item.id, communityName: item.name })}
      >
        <LinearGradient
          colors={['#1e1b4b', '#312e81']}
          style={styles.featuredCardHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.featuredCardBody}>
          <View style={styles.featuredIconContainer}>
            {iconUrl ? (
              <FastImage source={{ uri: iconUrl }} style={styles.featuredIcon} />
            ) : (
              <View style={styles.featuredIconFallback}>
                <IconMC name="account-group" size={wp(5.5)} color="#fff" />
              </View>
            )}
          </View>

          <Text style={styles.featuredName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.featuredMeta}>
            {item.memberCount} members · {item.postCount} posts
          </Text>

          <TouchableOpacity
            style={[styles.featuredJoinBtn, isJoined && styles.featuredJoinedBtn]}
            onPress={() => handleJoinToggle(item)}
            disabled={joiningId === item.id}
          >
            {joiningId === item.id ? (
              <ActivityIndicator size="small" color={isJoined ? '#fff' : '#111'} />
            ) : (
              <Text style={[styles.featuredJoinBtnText, isJoined && styles.featuredJoinedBtnText]}>
                {isJoined ? 'Joined' : 'Join'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderCommunityRow = ({ item }: { item: Community }) => {
    const iconUrl = item.iconUrl ? getAbsoluteUrl(item.iconUrl) : null;
    const isJoined = item.isMember;

    return (
      <TouchableOpacity
        style={styles.row}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('CommunityFeed', { communityId: item.id, communityName: item.name })}
      >
        <View style={styles.avatar}>
          {iconUrl ? (
            <FastImage source={{ uri: iconUrl }} style={styles.rowIcon} />
          ) : (
            <View style={styles.rowIconFallback}>
              <IconMC name="account-group" size={wp(5.5)} color="#fff" />
            </View>
          )}
        </View>

        <View style={styles.rowBody}>
          <Text style={styles.communityName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.communityMeta}>
            {item.memberCount} members · {item.postCount} posts
          </Text>
          {item.description && (
            <Text style={styles.communityDesc} numberOfLines={1}>
              {item.description}
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={[styles.joinBtn, isJoined && styles.joinedBtn]}
          onPress={() => handleJoinToggle(item)}
          disabled={joiningId === item.id}
        >
          {joiningId === item.id ? (
            <ActivityIndicator size="small" color={isJoined ? '#fff' : '#111'} />
          ) : (
            <Text style={[styles.joinBtnText, isJoined && styles.joinedBtnText]}>
              {isJoined ? 'Joined' : 'Join'}
            </Text>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Sleek Minimal Header */}
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Explore</Text>
        <TouchableOpacity
          style={styles.createTriggerBtn}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <IconMC name="plus" size={wp(4.2)} color="#fff" />
          <Text style={styles.createTriggerText}>New Group</Text>
        </TouchableOpacity>
      </View>

      {/* Capsule Search Input */}
      <View style={styles.searchWrap}>
        <IconMC name="magnify" size={wp(4.5)} color="rgba(255,255,255,0.4)" />
        <TextInput
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (text.trim() !== '') {
              setSelectedCategory('All');
            }
          }}
          placeholder="Search groups & topics"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
          clearButtonMode="while-editing"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <IconMC name="close-circle" size={wp(4.5)} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        )}
      </View>

      {/* Topics horizontal scroll chips */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
        >
          {TOPIC_CATEGORIES.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <TouchableOpacity
                key={category}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => handleCategoryPress(category)}
                activeOpacity={0.8}
              >
                <Text style={[styles.categoryText, isSelected && styles.categoryTextActive]}>
                  {category}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.Accent} />
        </View>
      ) : communities.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="account-group-outline" size={wp(14)} color="#333" />
          <Text style={styles.emptyTitle}>No groups found</Text>
          <Text style={styles.emptyText}>Be the first to start a group for this topic.</Text>
          <TouchableOpacity
            style={styles.emptyCreateBtn}
            onPress={() => setModalVisible(true)}
          >
            <Text style={styles.emptyCreateBtnText}>Create Group</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={otherCommunities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            featuredCommunities.length > 0 ? (
              <View style={styles.featuredSection}>
                <Text style={styles.sectionHeading}>Featured Groups</Text>
                <FlatList
                  horizontal
                  data={featuredCommunities}
                  keyExtractor={(item) => `f-${item.id}`}
                  renderItem={renderFeaturedCard}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredListContent}
                  snapToInterval={wp(52) + wp(3.5)}
                  decelerationRate="fast"
                />
                <Text style={styles.sectionHeading}>All Groups</Text>
              </View>
            ) : null
          }
          renderItem={renderCommunityRow}
        />
      )}

      {/* Start Community Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Group</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <IconMC name="close" size={wp(5.5)} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Group Name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="e.g. Model Y Owners, DIY Brake Repair"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={styles.modalInput}
                maxLength={40}
              />

              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="What is this community about?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                style={[styles.modalInput, styles.modalInputMultiline]}
                multiline
                numberOfLines={3}
                maxLength={160}
              />

              <TouchableOpacity
                style={[styles.modalCreateBtn, !newName.trim() && styles.modalCreateBtnDisabled]}
                onPress={handleCreate}
                disabled={creating || !newName.trim()}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalCreateBtnText}>Create Group</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    flex: 1,
    fontSize: wp(4.8),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
    marginLeft: wp(3),
  },
  createTriggerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.8),
    borderRadius: 20,
    gap: wp(1.2),
  },
  createTriggerText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.1),
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    marginHorizontal: wp(4),
    marginTop: hp(1.5),
    marginBottom: hp(1.2),
    backgroundColor: '#161618',
    borderRadius: 22,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.1),
    borderWidth: 1,
    borderColor: '#242427',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    padding: 0,
  },
  categoriesContainer: {
    marginBottom: hp(1.5),
  },
  categoriesScrollContent: {
    paddingHorizontal: wp(4),
    gap: wp(2.2),
  },
  categoryChip: {
    paddingVertical: hp(0.7),
    paddingHorizontal: wp(4),
    borderRadius: 16,
    backgroundColor: '#161618',
  },
  categoryChipActive: {
    backgroundColor: '#6366f1',
  },
  categoryText: {
    color: '#aaa',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  categoryTextActive: {
    color: '#fff',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: wp(10),
    gap: hp(1),
  },
  emptyTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
    marginTop: hp(1),
  },
  emptyText: {
    color: '#666',
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.4),
    textAlign: 'center',
    marginBottom: hp(1.5),
  },
  emptyCreateBtn: {
    backgroundColor: '#6366f1',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1),
    borderRadius: 18,
  },
  emptyCreateBtnText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.3),
  },
  listContent: {
    paddingBottom: hp(4),
  },
  featuredSection: {
    marginBottom: hp(1.5),
  },
  sectionHeading: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.2),
    marginHorizontal: wp(4),
    marginBottom: hp(1.2),
    marginTop: hp(0.8),
  },
  featuredListContent: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(1.5),
    gap: wp(3.5),
  },
  featuredCard: {
    width: wp(52),
    backgroundColor: '#161618',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#242427',
  },
  featuredCardHeader: {
    height: hp(7.5),
  },
  featuredCardBody: {
    padding: wp(3),
    alignItems: 'center',
    position: 'relative',
    marginTop: -hp(3.5),
  },
  featuredIconContainer: {
    marginBottom: hp(0.8),
  },
  featuredIcon: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    borderWidth: 3,
    borderColor: '#161618',
    backgroundColor: '#222',
  },
  featuredIconFallback: {
    width: wp(14),
    height: wp(14),
    borderRadius: wp(7),
    borderWidth: 3,
    borderColor: '#161618',
    backgroundColor: '#2e2d30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredName: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.6),
    textAlign: 'center',
    marginBottom: hp(0.2),
  },
  featuredMeta: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.8),
    textAlign: 'center',
    marginBottom: hp(1.2),
  },
  featuredJoinBtn: {
    width: '100%',
    paddingVertical: hp(0.7),
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  featuredJoinedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  featuredJoinBtnText: {
    color: '#000',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },
  featuredJoinedBtnText: {
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.4),
    paddingHorizontal: wp(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    marginRight: wp(3),
  },
  rowIcon: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#222',
  },
  rowIconFallback: {
    width: wp(11),
    height: wp(11),
    borderRadius: wp(5.5),
    backgroundColor: '#161618',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#242427',
  },
  rowBody: {
    flex: 1,
    marginRight: wp(2),
  },
  communityName: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.7),
  },
  communityMeta: {
    color: '#666',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(2.9),
    marginTop: hp(0.1),
  },
  communityDesc: {
    color: '#aaa',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3),
    marginTop: hp(0.3),
  },
  joinBtn: {
    paddingHorizontal: wp(4.2),
    paddingVertical: hp(0.75),
    borderRadius: 14,
    backgroundColor: '#fff',
    minWidth: wp(18),
    alignItems: 'center',
  },
  joinedBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#444',
  },
  joinBtnText: {
    color: '#000',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3),
  },
  joinedBtnText: {
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: hp(2.2),
    paddingBottom: hp(4),
    paddingHorizontal: wp(5),
    borderWidth: 1,
    borderColor: '#242427',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2.5),
  },
  modalTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
  },
  modalForm: {
    gap: hp(1.5),
  },
  inputLabel: {
    color: '#aaa',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.2),
  },
  modalInput: {
    backgroundColor: '#000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242427',
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(1.2),
  },
  modalInputMultiline: {
    minHeight: hp(10),
    textAlignVertical: 'top',
  },
  modalCreateBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: hp(1.4),
    alignItems: 'center',
    marginTop: hp(1.5),
  },
  modalCreateBtnDisabled: {
    backgroundColor: '#333336',
  },
  modalCreateBtnText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.5),
  },
});
