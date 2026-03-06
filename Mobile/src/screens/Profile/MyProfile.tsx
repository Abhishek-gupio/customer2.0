import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  FlatList,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinchGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useDispatch } from 'react-redux';
import { logoutStorage } from '../../services/authService';
import { logout } from '../../store/slices/authSlice';
import { getProfile, updateProfile, type ProfileResponse } from '../../services/profileService';

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList, 'MyProfile'>;

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
  profilePic?: string;
}

// Predefined avatar list using DiceBear API
const AVATAR_LIST = [
  { id: '1', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Felix&backgroundColor=b6e3f4&scale=90', label: 'Felix' },
  { id: '2', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Aneka&backgroundColor=c0aede&scale=90', label: 'Aneka' },
  { id: '3', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Mia&backgroundColor=d1d4f9&scale=90', label: 'Mia' },
  { id: '4', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Leo&backgroundColor=ffd5dc&scale=90', label: 'Leo' },
  { id: '5', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Zoe&backgroundColor=ffdfbf&scale=90', label: 'Zoe' },
  { id: '6', url: 'https://api.dicebear.com/9.x/avataaars/png?seed=Max&backgroundColor=b6e3f4&scale=90', label: 'Max' },
  { id: '7', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Happy&backgroundColor=b6e3f4&scale=80', label: 'Happy' },
  { id: '8', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Cool&backgroundColor=c0aede&scale=80', label: 'Cool' },
  { id: '9', url: 'https://api.dicebear.com/9.x/fun-emoji/png?seed=Smile&backgroundColor=d1d4f9&scale=80', label: 'Smile' },
  { id: '10', url: 'https://api.dicebear.com/9.x/bottts/png?seed=Robot1&backgroundColor=b6e3f4&scale=80', label: 'Robot 1' },
  { id: '11', url: 'https://api.dicebear.com/9.x/bottts/png?seed=Robot2&backgroundColor=c0aede&scale=80', label: 'Robot 2' },
  { id: '12', url: 'https://api.dicebear.com/9.x/bottts/png?seed=Robot3&backgroundColor=ffdfbf&scale=80', label: 'Robot 3' },
  { id: '13', url: 'https://api.dicebear.com/9.x/lorelei/png?seed=Luna&backgroundColor=b6e3f4&scale=90', label: 'Luna' },
  { id: '14', url: 'https://api.dicebear.com/9.x/lorelei/png?seed=Star&backgroundColor=c0aede&scale=90', label: 'Star' },
  { id: '15', url: 'https://api.dicebear.com/9.x/lorelei/png?seed=Sky&backgroundColor=ffd5dc&scale=90', label: 'Sky' },
  { id: '16', url: 'https://api.dicebear.com/9.x/notionists/png?seed=Alex&backgroundColor=b6e3f4&scale=90', label: 'Alex' },
  { id: '17', url: 'https://api.dicebear.com/9.x/notionists/png?seed=Sam&backgroundColor=d1d4f9&scale=90', label: 'Sam' },
  { id: '18', url: 'https://api.dicebear.com/9.x/notionists/png?seed=Jamie&backgroundColor=ffdfbf&scale=90', label: 'Jamie' },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const AVATAR_GRID_COLS = 3;
const AVATAR_ITEM_SIZE = (SCREEN_WIDTH - wp(12) - (AVATAR_GRID_COLS - 1) * 12) / AVATAR_GRID_COLS;

export default function MyProfile() {
  const navigation = useNavigation<ProfileNavProp>();

  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editData, setEditData] = useState<ProfileData | null>(null);
  const [errors, setErrors] = useState<{ fullName?: string; email?: string; phone?: string; }>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(false);
  const [profilePicModal, setProfilePicModal] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ visible: boolean; title: string; message: string; type: 'success' | 'error' }>({
    visible: false,
    title: '',
    message: '',
    type: 'success',
  });
  const dispatch = useDispatch();

  // Animation handling for pinch-to-zoom
  const zoomScale = React.useRef(new Animated.Value(1)).current;

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: zoomScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(zoomScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 1,
      }).start();
    }
  };

  const showPopup = (title: string, message: string, type: 'success' | 'error' = 'success') => {
    setPopup({ visible: true, title, message, type });
  };

  const validate = () => {
    let isValid = true;
    const newErrors: { fullName?: string; email?: string; phone?: string; } = {};

    if (!editData?.fullName || editData.fullName.trim() === '') {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    } else if (editData.fullName.length > 200) {
      newErrors.fullName = 'Full name must be less than 200 characters';
      isValid = false;
    } else if (/^\d+$/.test(editData.fullName.trim())) {
      newErrors.fullName = 'Full name cannot contain only numbers';
      isValid = false;
    }

    if (editData?.email && editData.email.trim() !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(editData.email)) {
        newErrors.email = 'Please enter a valid email address';
        isValid = false;
      }
    }

    if (editData?.phone && editData.phone.trim() !== '') {
      const phoneStr = editData.phone.trim();
      if (phoneStr.length !== 10) {
        newErrors.phone = 'Phone number must be exactly 10 digits';
        isValid = false;
      } else if (!/^\d{10}$/.test(phoneStr)) {
        newErrors.phone = 'Please enter a valid 10-digit phone number';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Auto-detect user location based on IP address
  const fetchUserLocation = async () => {
    try {
      let geo: any = null;

      // Provider 1: ipapi (Good mobile IP resolution)
      try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data?.city && data?.region) {
          geo = data;
        }
      } catch (err) {
        console.log('ipapi error:', err);
      }

      // Provider 2: ipinfo (Very reliable fallback)
      if (!geo) {
        try {
          const res = await fetch('https://ipinfo.io/json');
          const data = await res.json();
          if (data?.city && data?.region) {
            geo = data;
          }
        } catch (err) {
          console.log('ipinfo error:', err);
        }
      }

      // Provider 3: geojs (Original fallback)
      if (!geo) {
        try {
          const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
          const data = await res.json();
          if (data?.city && data?.region) {
            geo = data;
          }
        } catch (err) {
          console.log('geojs error:', err);
        }
      }

      if (geo?.city && geo?.region) {
        const locationStr = `${geo.city}, ${geo.region}`;
        setProfile((prev) => (prev ? { ...prev, location: locationStr } : prev));
        setEditData((prev) => (prev ? { ...prev, location: locationStr } : prev));
        return;
      }
      throw new Error('Incomplete location data from IP services');
    } catch (error) {
      console.log('Location detection failed:', error);
      const fallback = 'Location not available';
      setProfile((prev) => (prev ? { ...prev, location: fallback } : prev));
      setEditData((prev) => (prev ? { ...prev, location: fallback } : prev));
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      mapProfileData(data);
      // Wait for profile data mapping to finish, then fetch location
      fetchUserLocation();
    } catch (error: any) {
      showPopup('Error', error.message || 'Failed to fetch profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const mapProfileData = (data: ProfileResponse) => {
    const formatted: ProfileData = {
      fullName: data.fullName ?? '',
      email: data.email ?? '',
      phone: data.phoneNumber ?? '',
      location: 'Detecting...',
      profilePic: data.profilePic || undefined,
      memberSince: data.createdAt
        ? new Date(data.createdAt).toLocaleDateString('default', {
          year: 'numeric',
          month: 'long',
        })
        : 'January 2024',
    };
    setProfile(formatted);
    setEditData(formatted);
  };

  const handleEdit = () => {
    if (profile) {
      setEditData({ ...profile });
      setErrors({});
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editData) return;
    if (!validate()) return;

    try {
      setSaving(true);
      const payload: { fullName?: string; email?: string; profilePic?: string; phoneNumber?: string } = {};
      if (editData.fullName != null) payload.fullName = editData.fullName;
      if (editData.email != null && editData.email !== '') payload.email = editData.email;
      else if (editData.email === '') payload.email = '';
      if (editData.profilePic != null && editData.profilePic !== '') payload.profilePic = editData.profilePic;
      if (editData.phone != null && editData.phone !== '') payload.phoneNumber = editData.phone;

      const updated = await updateProfile(payload);

      mapProfileData(updated);
      setIsEditing(false);
      showPopup('Success', 'Profile updated successfully', 'success');
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Could not save changes';
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join('\n');
      } else if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
      showPopup('Update Failed', errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditData({ ...profile });
      setErrors({});
      setIsEditing(false);
    }
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    if (!editData) return;
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleImagePick = () => {
    setProfilePicModal(true);
  };

  const handleCameraOption = async () => {
    setProfilePicModal(false);
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.7,
    });
    processImageResult(result);
  };

  const handleGalleryOption = async () => {
    setProfilePicModal(false);
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    processImageResult(result);
  };

  const handleAvatarOption = () => {
    setProfilePicModal(false);
    setSelectedAvatar(currentPic || null);
    setTimeout(() => setAvatarModal(true), 300);
  };

  const handleAvatarSelect = async (avatarUrl: string) => {
    try {
      setSaving(true);
      setAvatarModal(false);
      const updated = await updateProfile({ profilePic: avatarUrl });
      mapProfileData(updated);
      mapProfileData(updated);
    } catch (err: any) {
      showPopup('Error', err.message || 'Failed to set avatar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProfilePic = async () => {
    setProfilePicModal(false);
    if (!currentPic) return;
    Alert.alert(
      'Remove Profile Picture',
      'Are you sure you want to remove your profile picture?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              const updated = await updateProfile({ profilePic: '' });
              mapProfileData(updated);
              mapProfileData(updated);
              showPopup('Success', 'Profile picture removed!', 'success');
            } catch (err: any) {
              showPopup('Error', err.message || 'Failed to remove picture', 'error');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const processImageResult = async (result: any) => {
    if (result.assets && result.assets.length > 0) {
      const selectedImage = result.assets[0].uri;
      if (selectedImage) {
        if (isEditing && editData) {
          setEditData({ ...editData, profilePic: selectedImage });
        } else {
          try {
            setSaving(true);
            const updated = await updateProfile({ profilePic: selectedImage });
            mapProfileData(updated);
            showPopup('Success', 'Profile picture updated!', 'success');
          } catch (err: any) {
            showPopup('Error', err.message || 'Failed to update picture', 'error');
          } finally {
            setSaving(false);
          }
        }
      }
    }
  };

  if (loading && !profile) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#e5e5e5" />
      </SafeAreaView>
    );
  }

  if (!profile || !editData) return null;

  const currentPic = isEditing ? editData?.profilePic : profile.profilePic;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#111" />

      {/* ── Custom Minimal Alert Popup Modal ── */}
      <Modal
        visible={popup.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPopup(prev => ({ ...prev, visible: false }))}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setPopup(prev => ({ ...prev, visible: false }))}>
          <View style={styles.popupOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.popupCard}>
                <View style={styles.popupHeader}>
                  <Icon
                    name={popup.type === 'success' ? 'check-circle' : 'exclamation-triangle'}
                    size={20}
                    color={popup.type === 'success' ? '#25D366' : '#ff4444'}
                  />
                  <Text style={styles.popupTitle}>{popup.title}</Text>
                </View>

                <Text style={styles.popupMessage}>{popup.message}</Text>

                <TouchableOpacity
                  style={styles.popupBtnMinimal}
                  activeOpacity={0.7}
                  onPress={() => setPopup(prev => ({ ...prev, visible: false }))}
                >
                  <Text style={styles.popupBtnTextMinimal}>Okay</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Full-screen Photo Preview Modal ── */}
      <Modal
        visible={photoPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoPreview(false)}
        statusBarTranslucent
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <TouchableWithoutFeedback onPress={() => setPhotoPreview(false)}>
            <View style={styles.previewOverlay}>
              <TouchableWithoutFeedback>
                <View style={styles.previewContent}>
                  <PinchGestureHandler
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                  >
                    <Animated.Image
                      source={{ uri: currentPic }}
                      style={[
                        styles.previewImage,
                        { transform: [{ scale: zoomScale }] }
                      ]}
                      resizeMode="contain"
                    />
                  </PinchGestureHandler>
                </View>
              </TouchableWithoutFeedback>
              <TouchableOpacity
                style={styles.previewCloseBtn}
                onPress={() => setPhotoPreview(false)}
                activeOpacity={0.8}
              >
                <Icon name="times" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </GestureHandlerRootView>
      </Modal>

      {/* ── Profile Picture Bottom Sheet Modal ── */}
      <Modal
        visible={profilePicModal}
        transparent
        animationType="slide"
        onRequestClose={() => setProfilePicModal(false)}
        statusBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setProfilePicModal(false)}>
          <View style={styles.bottomSheetOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.bottomSheet}>
                {/* Header */}
                <View style={styles.bottomSheetHeader}>
                  <TouchableOpacity
                    onPress={() => setProfilePicModal(false)}
                    activeOpacity={0.7}
                    style={styles.bottomSheetHeaderBtn}
                  >
                    <MaterialIcon name="close" size={24} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.bottomSheetTitle}>Profile picture</Text>
                  <TouchableOpacity
                    onPress={handleDeleteProfilePic}
                    activeOpacity={0.7}
                    style={styles.bottomSheetHeaderBtn}
                  >
                    <MaterialIcon name="delete-outline" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* Options */}
                <View style={styles.bottomSheetOptions}>
                  <TouchableOpacity
                    style={styles.bottomSheetOption}
                    activeOpacity={0.7}
                    onPress={handleCameraOption}
                  >
                    <View style={styles.bottomSheetIconWrap}>
                      <MaterialIcon name="photo-camera" size={22} color="#aaa" />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bottomSheetOption}
                    activeOpacity={0.7}
                    onPress={handleGalleryOption}
                  >
                    <View style={styles.bottomSheetIconWrap}>
                      <MaterialIcon name="photo-library" size={22} color="#aaa" />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bottomSheetOption}
                    activeOpacity={0.7}
                    onPress={handleAvatarOption}
                  >
                    <View style={styles.bottomSheetIconWrap}>
                      <MaterialCommunityIcon name="emoticon-outline" size={22} color="#aaa" />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>Avatar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ── Avatar Selection Modal ── */}
      <Modal
        visible={avatarModal}
        animationType="slide"
        onRequestClose={() => setAvatarModal(false)}
        statusBarTranslucent
      >
        <View style={styles.avatarModalContainer}>
          {/* Avatar Modal Header */}
          <View style={styles.avatarModalHeader}>
            <TouchableOpacity
              onPress={() => setAvatarModal(false)}
              activeOpacity={0.7}
              style={styles.avatarModalBackBtn}
            >
              <Icon name="arrow-left" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.avatarModalTitle}>Choose Avatar</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Avatar Grid */}
          <FlatList
            data={AVATAR_LIST}
            numColumns={AVATAR_GRID_COLS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.avatarGrid}
            columnWrapperStyle={styles.avatarRow}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = selectedAvatar === item.url;
              return (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedAvatar(item.url)}
                  style={[
                    styles.avatarGridItem,
                    isSelected && styles.avatarGridItemSelected,
                  ]}
                >
                  <Image
                    source={{ uri: item.url }}
                    style={styles.avatarGridImage}
                    resizeMode="cover"
                  />
                  {isSelected && (
                    <View style={styles.avatarSelectedBadge}>
                      <MaterialIcon name="check" size={16} color="#fff" />
                    </View>
                  )}
                  <Text style={[
                    styles.avatarGridLabel,
                    isSelected && styles.avatarGridLabelSelected,
                  ]}>{item.label}</Text>
                </TouchableOpacity>
              );
            }}
          />

          {/* Confirm Button */}
          {selectedAvatar && (
            <View style={styles.avatarConfirmWrap}>
              <TouchableOpacity
                style={styles.avatarConfirmBtn}
                activeOpacity={0.85}
                onPress={() => handleAvatarSelect(selectedAvatar)}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.avatarConfirmText}>Set as Profile Picture</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Header Bar: back arrow + settings gear ── */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
            <Icon name="arrow-left" size={wp(5)} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('Settings' as any)}>
            <Icon name="cog" size={wp(5)} color="#888" />
          </TouchableOpacity>
        </View>

        {/* ── Identity: avatar + name ── */}
        <View style={styles.identityContainer}>
          <View style={styles.avatarWrap}>
            {/* Tapping the avatar opens photo preview (only if photo exists) */}
            <TouchableOpacity
              activeOpacity={currentPic ? 0.8 : 1}
              onPress={() => { if (currentPic) setPhotoPreview(true); }}
            >
              <View style={styles.avatar}>
                {currentPic ? (
                  <Image
                    source={{ uri: currentPic }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Icon name="user" size={wp(8)} color="#e5e5e5" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraBtn}
              activeOpacity={0.9}
              onPress={handleImagePick}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Icon name="camera" size={wp(3)} color="#000" />
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.identityTextInfo}>
            <Text style={styles.profileName}>{profile.fullName || 'New User'}</Text>
          </View>
        </View>

        {/* Personal Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderLarge}>
            <Text style={styles.cardInfoTitle}>Personal Information</Text>

            <View style={styles.headerActions}>
              {!isEditing ? (
                <TouchableOpacity style={styles.editPill} onPress={handleEdit}>
                  <Icon name="pen" size={10} color="#FFC107" />
                  <Text style={styles.editPillText}>Edit</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                    <Icon name="times" size={12} color="#ff4444" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.savePill, saving && { opacity: 0.6 }]}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <>
                        <Icon name="save" size={12} color="#000" />
                        <Text style={styles.savePillText}>Save</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>

          <VerticalInfoRow
            icon="user"
            label="Full Name"
            value={isEditing ? editData.fullName : profile.fullName}
            isEditing={isEditing}
            onChange={(v: string) => updateField('fullName', v)}
            error={errors.fullName}
          />

          <VerticalInfoRow
            icon="envelope"
            label="Email Address"
            value={isEditing ? editData.email : profile.email}
            isEditing={isEditing}
            onChange={(v: string) => updateField('email', v)}
            keyboardType="email-address"
            error={errors.email}
          />

          <VerticalInfoRow
            icon="phone"
            label="Phone Number"
            value={isEditing ? editData.phone : profile.phone}
            isEditing={isEditing}
            onChange={(v: string) => updateField('phone', v)}
            keyboardType="phone-pad"
            error={errors.phone}
          />

          <VerticalInfoRow
            icon="map-marker-alt"
            label="Location"
            value={profile.location}
            isEditing={false}
          />

          <VerticalInfoRow
            icon="calendar-alt"
            label="Member Since"
            value={profile.memberSince}
            isEditing={false}
          />
        </View>

        {/* Quick Stats Grid */}
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>2</Text>
              <Text style={styles.statLabel}>Vehicles</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>47</Text>
              <Text style={styles.statLabel}>Expenses</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>12</Text>
              <Text style={styles.statLabel}>Documents</Text>
            </View>
          </View>
        </View>

        <View style={{ height: hp(5) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function VerticalInfoRow({
  icon,
  label,
  value,
  isEditing,
  onChange,
  keyboardType = 'default',
  error,
}: any) {
  return (
    <View style={styles.verticalRow}>
      <View style={styles.vIconWrap}>
        <Icon name={icon} size={wp(3.5)} color="#aaa" />
      </View>
      <View style={styles.vContentWrap}>
        <Text style={styles.vLabel}>{label}</Text>
        <View style={[
          styles.inputContainer,
          isEditing ? styles.inputContainerActive : undefined,
          (isEditing && error) ? styles.inputContainerError : undefined
        ]}>
          {isEditing && onChange ? (
            <TextInput
              value={value}
              onChangeText={onChange}
              keyboardType={keyboardType}
              autoCorrect={false}
              placeholder={`Enter ${label}`}
              placeholderTextColor="#444"
              style={styles.vInput}
            />
          ) : (
            <Text style={styles.vValue}>{value || 'Not provided'}</Text>
          )}
        </View>
        {isEditing && error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0b0e' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0b0e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp(4) },

  /* ── Top Header Bar ── */
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Identity Row ── */
  identityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(0.5),
    paddingBottom: hp(2.5),
  },
  avatarWrap: {
    position: 'relative',
    marginRight: wp(4),
  },
  avatar: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#333',
  },
  avatarPlaceholder: {
    backgroundColor: '#222',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: -5,
    backgroundColor: '#e5e5e5',
    width: wp(7),
    height: wp(7),
    borderRadius: wp(3.5),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#0a0b0e',
  },
  identityTextInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  profileMeta: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontWeight: '400',
  },
  settingsBtn: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },

  infoCard: {
    backgroundColor: '#151518',
    marginHorizontal: wp(4),
    marginTop: hp(1),
    paddingTop: wp(6),
    paddingHorizontal: wp(5),
    paddingBottom: wp(2),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeaderLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: hp(3),
  },
  cardInfoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFC107',
    gap: 6,
  },
  editPillText: {
    color: '#FFC107',
    fontSize: 12,
    fontWeight: '600',
  },
  cancelBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.2)',
    backgroundColor: 'rgba(255,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e5e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  savePillText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },

  verticalRow: {
    flexDirection: 'row',
    marginBottom: hp(2.5),
    alignItems: 'center',
  },
  vIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: 20,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  vContentWrap: {
    flex: 1,
  },
  vLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  inputContainer: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  inputContainerActive: {
    borderColor: '#e5e5e5',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  inputContainerError: {
    borderColor: '#ff4444',
    backgroundColor: 'rgba(255,68,68,0.05)',
  },
  errorText: {
    color: '#ff4444',
    fontSize: 11,
    marginTop: 4,
    marginLeft: 4,
  },
  vValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  vInput: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    padding: 0,
  },

  statsCard: {
    backgroundColor: '#111216',
    marginHorizontal: wp(4),
    marginTop: hp(2),
    paddingTop: wp(5),
    paddingHorizontal: wp(5),
    paddingBottom: wp(6),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  statsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: hp(2.5),
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: wp(2),
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  statLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },

  /* ── Photo Preview Modal ── */
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    width: '90%',
    aspectRatio: 1,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ── Profile Picture Bottom Sheet ── */
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1f2125',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: hp(4),
  },
  bottomSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  bottomSheetHeaderBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  bottomSheetOptions: {
    flexDirection: 'row',
    paddingHorizontal: wp(6),
    paddingTop: hp(3),
    gap: wp(10),
  },
  bottomSheetOption: {
    alignItems: 'center',
    gap: 10,
  },
  bottomSheetIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSheetOptionText: {
    color: '#d1d1d1',
    fontSize: 13,
    fontWeight: '500',
  },

  /* ── Avatar Selection Modal ── */
  avatarModalContainer: {
    flex: 1,
    backgroundColor: '#0a0b0e',
  },
  avatarModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingTop: hp(5),
    paddingBottom: hp(2),
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatarModalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarModalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  avatarGrid: {
    paddingHorizontal: wp(6),
    paddingTop: hp(3),
    paddingBottom: hp(12),
  },
  avatarRow: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarGridItem: {
    width: AVATAR_ITEM_SIZE,
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1a1b1f',
  },
  avatarGridItemSelected: {
    borderColor: '#25D366',
    backgroundColor: 'rgba(37,211,102,0.08)',
  },
  avatarGridImage: {
    width: AVATAR_ITEM_SIZE - 24,
    height: AVATAR_ITEM_SIZE - 24,
    borderRadius: (AVATAR_ITEM_SIZE - 24) / 2,
    backgroundColor: '#2a2b30',
  },
  avatarSelectedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGridLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 8,
  },
  avatarGridLabelSelected: {
    color: '#25D366',
  },
  avatarConfirmWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: wp(6),
    paddingBottom: hp(4),
    paddingTop: hp(2),
    backgroundColor: '#0a0b0e',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  avatarConfirmBtn: {
    backgroundColor: '#25D366',
    borderRadius: 14,
    paddingVertical: hp(1.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarConfirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },

  /* ── Custom Alert Popup ── */
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)', // Softer background
    justifyContent: 'center',
    alignItems: 'center',
    padding: wp(8),
  },
  popupCard: {
    backgroundColor: '#1c1d21',
    width: '100%',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  popupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  popupTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  popupMessage: {
    color: '#a0a0a0',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  popupBtnMinimal: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  popupBtnTextMinimal: {
    color: '#FFC107',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});