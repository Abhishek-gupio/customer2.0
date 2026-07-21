import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import FastImage from 'react-native-fast-image';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { communityService, type Community } from '../../services/communityService';
import { getProfile, type ProfileResponse } from '../../services/profileService';
import { useCommunityStore } from '../../store/communityStore';
import { getAbsoluteUrl } from '../../config';
import { colors } from '../../theme';

export default function PostComposerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId: string | undefined = route.params?.communityId;
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [text, setText] = useState('');
  const [images, setImages] = useState<Array<{ uri: string; name: string; type: string }>>([]);
  const [posting, setPosting] = useState(false);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  
  // Community Selector state
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunity, setSelectedCommunity] = useState<{ id: string | null; name: string }>({
    id: null,
    name: 'Public Feed',
  });
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    // Load profile
    getProfile()
      .then(setProfile)
      .catch((err) => console.log('Profile fetch error in composer:', err));

    // Load available communities
    communityService
      .discover({ limit: 50 })
      .then((res) => {
        // Filter joined communities
        const joined = res.filter((c) => c.isMember);
        setCommunities(joined.length > 0 ? joined : res);

        // Preselect if communityId is passed
        if (communityId) {
          const pre = res.find((c) => c.id === communityId);
          if (pre) {
            setSelectedCommunity({ id: pre.id, name: pre.name });
          }
        }
      })
      .catch((err) => console.log('Discover fetch error in composer:', err));
  }, [communityId]);

  const pickImage = async () => {
    if (images.length >= 5) {
      Alert.alert('Limit Reached', 'You can upload up to 5 photos.');
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      selectionLimit: 5 - images.length,
    });
    const assets = result.assets;
    if (assets && assets.length > 0) {
      const selected = assets
        .filter((asset) => asset.uri)
        .map((asset) => ({
          uri: asset.uri!,
          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
          type: asset.type ?? 'image/jpeg',
        }));
      setImages((prev) => [...prev, ...selected].slice(0, 5));
    }
  };

  const handlePost = async () => {
    if (!text.trim() && images.length === 0) return;
    setPosting(true);
    try {
      const targetId = selectedCommunity.id ?? undefined;
      if (images.length > 0) {
        await communityService.createMediaPost(
          { communityId: targetId, type: 'IMAGE', text: text.trim() || undefined },
          images
        );
      } else {
        await communityService.createTextPost({
          communityId: targetId,
          type: 'TEXT',
          text: text.trim(),
        });
      }
      bumpVersion();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert("Couldn't post", err?.message ?? 'Please try again');
    } finally {
      setPosting(false);
    }
  };

  const isPostDisabled = !text.trim() && images.length === 0;
  const initials = profile?.fullName
    ? profile.fullName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .substring(0, 2)
        .toUpperCase()
    : 'VO';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <IconMC name="close" size={wp(6)} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerSpacer} />
          <TouchableOpacity
            style={[styles.postBtn, isPostDisabled && styles.postBtnDisabled]}
            onPress={handlePost}
            disabled={posting || isPostDisabled}
          >
            {posting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postBtnText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Community Selector Trigger */}
        <View style={styles.selectorRow}>
          <TouchableOpacity
            style={styles.selectorBubble}
            onPress={() => setShowSelector(true)}
          >
            <IconMC name="account-group" size={wp(4)} color={colors.Accent} />
            <Text style={styles.selectorText}>{selectedCommunity.name}</Text>
            <IconMC name="chevron-down" size={wp(3.5)} color="#666" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.inputSection}>
            <View style={styles.avatarCol}>
              {profile?.profilePic ? (
                <Image
                  source={{ uri: getAbsoluteUrl(profile.profilePic) }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: colors.Accent + '15' }]}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </View>
              )}
            </View>

            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="What's happening with your vehicle?"
              placeholderTextColor="rgba(255,255,255,0.3)"
              style={styles.input}
              multiline
              autoFocus
              maxLength={280}
            />
          </View>

          {images.length > 0 && (
            <View style={styles.imagesHorizontalContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imagesScrollContent}
              >
                {images.map((item, index) => (
                  <React.Fragment key={item.uri}>
                    <View style={styles.imageCardContainer}>
                      <Image
                        source={{ uri: item.uri }}
                        style={styles.imagePreviewThumbnail}
                        resizeMode="cover"
                      />
                      <TouchableOpacity
                        style={styles.removeImageBtn}
                        onPress={() => setImages((prev) => prev.filter((_, i) => i !== index))}
                        activeOpacity={0.8}
                      >
                        <IconMC name="close" size={wp(3.5)} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </React.Fragment>
                ))}
                {images.length < 5 && (
                  <TouchableOpacity
                    style={styles.addMoreCardBtn}
                    onPress={pickImage}
                    activeOpacity={0.8}
                  >
                    <IconMC name="camera-plus-outline" size={wp(5.5)} color="#666" />
                    <Text style={styles.addMoreText}>Add more</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>
          )}
        </ScrollView>

        {/* Bottom Toolbar */}
        <View style={styles.bottomToolbar}>
          <TouchableOpacity style={styles.toolbarActionBtn} onPress={pickImage} activeOpacity={0.8}>
            <IconMC name="image-outline" size={wp(6)} color={colors.Accent} />
            <Text style={styles.toolbarActionText}>Photo</Text>
          </TouchableOpacity>

          <View style={styles.charCountWrap}>
            <Text style={[styles.charCountText, text.length > 250 && styles.charCountWarning]}>
              {280 - text.length}
            </Text>
          </View>
        </View>

        {/* Modal Selector */}
        <Modal
          visible={showSelector}
          animationType="slide"
          transparent
          onRequestClose={() => setShowSelector(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Audience</Text>
                <TouchableOpacity onPress={() => setShowSelector(false)}>
                  <IconMC name="close" size={wp(5.5)} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalList}>
                <TouchableOpacity
                  style={[
                    styles.modalListItem,
                    selectedCommunity.id === null && styles.modalListItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCommunity({ id: null, name: 'Public Feed' });
                    setShowSelector(false);
                  }}
                >
                  <IconMC name="earth" size={wp(5)} color="#fff" />
                  <Text style={styles.modalListItemText}>Public Feed (Anyone can view)</Text>
                  {selectedCommunity.id === null && (
                    <IconMC name="check" size={wp(5)} color={colors.Accent} />
                  )}
                </TouchableOpacity>

                {communities.map((c) => {
                  const isActive = selectedCommunity.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.modalListItem, isActive && styles.modalListItemActive]}
                      onPress={() => {
                        setSelectedCommunity({ id: c.id, name: c.name });
                        setShowSelector(false);
                      }}
                    >
                      <IconMC name="account-group" size={wp(5)} color="#fff" />
                      <Text style={styles.modalListItemText}>{c.name}</Text>
                      {isActive && <IconMC name="check" size={wp(5)} color={colors.Accent} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  closeBtn: {
    padding: wp(1),
  },
  headerSpacer: {
    flex: 1,
  },
  postBtn: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(0.8),
    borderRadius: 18,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: wp(18),
  },
  postBtnDisabled: {
    backgroundColor: '#1e1b4b',
    opacity: 0.5,
  },
  postBtnText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },
  selectorRow: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#1a1a1a',
  },
  selectorBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#161618',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 14,
    gap: wp(1.2),
    borderWidth: 1,
    borderColor: '#242427',
  },
  selectorText: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.9),
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  inputSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarCol: {
    marginRight: wp(3),
    marginTop: hp(0.5),
  },
  avatarImage: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#222',
  },
  avatarFallback: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.4),
  },
  input: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4),
    lineHeight: wp(5.5),
    minHeight: hp(15),
    textAlignVertical: 'top',
    paddingTop: hp(0.5),
  },
  // Horizontal images layout
  imagesHorizontalContainer: {
    marginTop: hp(2),
    height: hp(16),
  },
  imagesScrollContent: {
    gap: wp(3),
    paddingRight: wp(4),
    alignItems: 'center',
  },
  imageCardContainer: {
    width: wp(28),
    height: hp(14),
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#242427',
  },
  imagePreviewThumbnail: {
    width: '100%',
    height: '100%',
  },
  removeImageBtn: {
    position: 'absolute',
    top: hp(0.6),
    right: wp(1.2),
    width: wp(6),
    height: wp(6),
    borderRadius: wp(3),
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  addMoreCardBtn: {
    width: wp(28),
    height: hp(14),
    borderRadius: 12,
    backgroundColor: '#161618',
    borderWidth: 1,
    borderColor: '#242427',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: hp(0.5),
  },
  addMoreText: {
    color: '#666',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(2.8),
  },
  bottomToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#1a1a1a',
    backgroundColor: '#000',
  },
  toolbarActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.5),
    paddingVertical: hp(0.5),
    paddingHorizontal: wp(2.5),
    borderRadius: 14,
  },
  toolbarActionText: {
    color: '#6366f1',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.1),
  },
  charCountWrap: {
    justifyContent: 'center',
  },
  charCountText: {
    color: '#666',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.1),
  },
  charCountWarning: {
    color: '#ef4444',
  },
  // Modal audience selection list
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: hp(2.2),
    paddingBottom: hp(4),
    paddingHorizontal: wp(5),
    maxHeight: hp(50),
    borderWidth: 1,
    borderColor: '#242427',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  modalTitle: {
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
  },
  modalList: {
    marginTop: hp(1),
  },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.6),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#242427',
    gap: wp(3),
  },
  modalListItemActive: {
    borderBottomColor: 'transparent',
  },
  modalListItemText: {
    flex: 1,
    color: '#fff',
    fontFamily: 'Outfit-Bold',
    fontSize: wp(3.5),
  },
});
