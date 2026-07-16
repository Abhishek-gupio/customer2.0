import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import IconMC from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import BackButton from '../../components/BackButton';
import { communityService } from '../../services/communityService';
import { useCommunityStore } from '../../store/communityStore';

export default function PostComposerScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const communityId: string | undefined = route.params?.communityId;
  const bumpVersion = useCommunityStore((s) => s.bumpVersion);

  const [text, setText] = useState('');
  const [image, setImage] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [posting, setPosting] = useState(false);

  const pickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    const asset = result.assets?.[0];
    if (asset?.uri) {
      setImage({ uri: asset.uri, name: asset.fileName ?? 'photo.jpg', type: asset.type ?? 'image/jpeg' });
    }
  };

  const handlePost = async () => {
    if (!text.trim() && !image) return;
    setPosting(true);
    try {
      if (image) {
        await communityService.createMediaPost({ communityId, type: 'IMAGE', text: text.trim() || undefined }, [image]);
      } else {
        await communityService.createTextPost({ communityId, type: 'TEXT', text: text.trim() });
      }
      bumpVersion();
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Couldn\'t post', err?.message ?? 'Please try again');
    } finally {
      setPosting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
          style={[styles.postBtn, (!text.trim() && !image) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={posting || (!text.trim() && !image)}
        >
          {posting ? <ActivityIndicator size="small" color="#111" /> : <Text style={styles.postBtnText}>Post</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.body}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What's happening with your vehicle?"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.input}
          multiline
          autoFocus
        />

        {image && (
          <View style={styles.imagePreviewWrap}>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} resizeMode="cover" />
            <TouchableOpacity style={styles.removeImageBtn} onPress={() => setImage(null)}>
              <IconMC name="close" size={wp(4)} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.mediaBtn} onPress={pickImage}>
          <IconMC name="image-outline" size={wp(5.5)} color="#FFBF00" />
          <Text style={styles.mediaBtnText}>Add photo</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: wp(5), paddingVertical: hp(2) },
  headerTitle: { flex: 1, fontSize: wp(4.8), fontFamily: 'Outfit-Bold', color: '#fff', marginLeft: wp(3) },
  postBtn: { paddingHorizontal: wp(5), paddingVertical: hp(1), borderRadius: 12, backgroundColor: '#FFBF00' },
  postBtnDisabled: { backgroundColor: '#333' },
  postBtnText: { color: '#111', fontFamily: 'Outfit-Bold', fontSize: wp(3.5) },
  body: { paddingHorizontal: wp(5), flex: 1 },
  input: {
    color: '#fff',
    fontFamily: 'Outfit-Regular',
    fontSize: wp(4),
    minHeight: hp(16),
    textAlignVertical: 'top',
  },
  imagePreviewWrap: { marginTop: hp(1), position: 'relative' },
  imagePreview: { width: '100%', height: hp(24), borderRadius: 14 },
  removeImageBtn: {
    position: 'absolute',
    top: hp(1),
    right: wp(2),
    width: wp(8),
    height: wp(8),
    borderRadius: wp(4),
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaBtn: { flexDirection: 'row', alignItems: 'center', gap: wp(2), marginTop: hp(2) },
  mediaBtnText: { color: '#FFBF00', fontFamily: 'Outfit-Bold', fontSize: wp(3.6) },
});
