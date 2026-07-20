import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { communityService, type Community } from '../../services/communityService';
import { useCommunityStore } from '../../store/communityStore';

export default function CommunitiesDiscoverScreen() {
  const navigation = useNavigation<any>();
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [query, setQuery] = useState('');
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    communityService
      .discover({ q: query || undefined, limit: 30 })
      .then(setCommunities)
      .finally(() => setLoading(false));
  }, [query]);

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
      await communityService.createCommunity({ name: newName.trim(), type: 'TOPIC' });
      setNewName('');
      bumpVersion();
      load();
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Discover Communities</Text>
      </View>

      <View style={styles.searchWrap}>
        <IconMC name="magnify" size={wp(4.5)} color="rgba(255,255,255,0.4)" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search communities"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
        />
      </View>

      <View style={styles.createRow}>
        <TextInput
          value={newName}
          onChangeText={setNewName}
          placeholder="Start a new community…"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.createInput}
        />
        <TouchableOpacity style={styles.createBtn} onPress={handleCreate} disabled={creating || !newName.trim()}>
          {creating ? <ActivityIndicator size="small" color="#111" /> : <IconMC name="plus" size={wp(5)} color="#111" />}
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#FFBF00" />
        </View>
      ) : communities.length === 0 ? (
        <View style={styles.centerState}>
          <IconMC name="account-group-outline" size={wp(12)} color="#444" />
          <Text style={styles.emptyTitle}>No communities yet</Text>
          <Text style={styles.emptyText}>Start one above to get the first post going.</Text>
        </View>
      ) : (
        <FlatList
          data={communities}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('CommunityFeed', { communityId: item.id, communityName: item.name })}
            >
              <View style={styles.avatar}>
                <IconMC name="account-group" size={wp(6)} color="#FFBF00" />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.communityName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.communityMeta}>{item.memberCount} members · {item.postCount} posts</Text>
              </View>
              <TouchableOpacity
                style={[styles.joinBtn, item.isMember && styles.joinedBtn]}
                onPress={() => handleJoinToggle(item)}
                disabled={joiningId === item.id}
              >
                {joiningId === item.id ? (
                  <ActivityIndicator size="small" color={item.isMember ? '#fff' : '#111'} />
                ) : (
                  <Text style={[styles.joinBtnText, item.isMember && styles.joinedBtnText]}>
                    {item.isMember ? 'Joined' : 'Join'}
                  </Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { flex: 1, fontSize: wp(4.8), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    marginHorizontal: wp(5),
    marginBottom: hp(1.2),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  searchInput: { flex: 1, color: '#fff', fontFamily: 'Outfit-Regular', fontSize: wp(3.5), padding: 0 },
  createRow: { flexDirection: 'row', gap: wp(2.5), marginHorizontal: wp(5), marginBottom: hp(1.5) },
  createInput: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(3.5),
    backgroundColor: '#141414',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
  },
  createBtn: {
    width: wp(11),
    borderRadius: 14,
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: wp(10), gap: hp(1) },
  emptyTitle: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(4.5), marginTop: hp(1) },
  emptyText: { color: '#888', fontFamily: 'Outfit-Medium', fontSize: wp(3.4), textAlign: 'center' },
  listContent: { paddingHorizontal: wp(5), paddingBottom: hp(4) },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.6),
    borderBottomWidth: 1,
    borderBottomColor: '#181818',
  },
  avatar: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  rowBody: { flex: 1 },
  communityName: { color: '#fff', fontFamily: 'Outfit-Bold', fontSize: wp(3.8) },
  communityMeta: { color: '#666', fontFamily: 'Outfit-Regular', fontSize: wp(2.9), marginTop: hp(0.2) },
  joinBtn: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.9),
    borderRadius: 12,
    backgroundColor: '#FFBF00',
    minWidth: wp(18),
    alignItems: 'center',
  },
  joinedBtn: { backgroundColor: '#222' },
  joinBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(3.1) },
  joinedBtnText: { color: '#fff' },
});
