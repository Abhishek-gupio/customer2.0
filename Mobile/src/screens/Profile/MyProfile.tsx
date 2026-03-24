import React, { useState, useEffect, useRef } from 'react';
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
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
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
import { useNavigation, CommonActions } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useDispatch } from 'react-redux';
import { logoutStorage } from '../../services/authService';
import { logout } from '../../store/slices/authSlice';
import { getProfile, getProfileStats, updateProfile, uploadProfilePicture, type ProfileResponse, type ProfileStatsResponse } from '../../services/profileService';
import { getAbsoluteUrl } from '../../config';
import { googleMapsService } from '../../services/googleMapsService';
import BackButton from '../../components/BackButton';

// GPS-based location (same pattern as SOSButton)
let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}

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
  const [stats, setStats] = useState<ProfileStatsResponse>({ vehicles: 0, expenses: 0, documents: 0 });
  const [photoPreview, setPhotoPreview] = useState(false);
  const [profilePicModal, setProfilePicModal] = useState(false);
  const [avatarModal, setAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [infoModal, setInfoModal] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: () => {
          logoutStorage();
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Signin' }],
            })
          );
        },
      },
    ]);
  };

  const handleMenuPress = (route?: keyof RootStackParamList, onPress?: () => void) => {
    if (route) {
      navigation.navigate(route as never);
    } else if (onPress) {
      onPress();
    }
  };

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

  // Request location permission (Android + iOS)
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
        const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
        const fineHas = await PermissionsAndroid.check(fine);
        const coarseHas = await PermissionsAndroid.check(coarse);
        if (fineHas || coarseHas) return true;
        const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
        return results[fine] === PermissionsAndroid.RESULTS.GRANTED || results[coarse] === PermissionsAndroid.RESULTS.GRANTED;
      } catch {
        return false;
      }
    }
    if (Platform.OS === 'ios' && Geolocation?.requestAuthorization) {
      try {
        const status = await Geolocation.requestAuthorization('whenInUse');
        return status === 'granted' || status === 'authorized' || status === 'authorizedWhenInUse';
      } catch {
        return false;
      }
    }
    return true;
  };

  const getGpsPosition = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!Geolocation) return null;

    const permitted = await requestLocationPermission();
    if (!permitted) return null;

    const getPositionOnce = (options: any) =>
      new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        Geolocation.getCurrentPosition(
          (position: any) =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          () => resolve(null),
          options,
        );
      });

    const highAccuracy = await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60000,
      forceRequestLocation: true,
    });
    if (highAccuracy) return highAccuracy;

    return getPositionOnce({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000,
      forceRequestLocation: true,
    });
  };

  const fetchUserLocation = async () => {
    const applyLocation = (locationStr: string) => {
      setProfile((prev) => (prev ? { ...prev, location: locationStr } : prev));
      setEditData((prev) => (prev ? { ...prev, location: locationStr } : prev));
    };

    try {
      const gpsCoords = await getGpsPosition();
      const coords = gpsCoords ?? await googleMapsService.getCurrentLocation();
      const address = await googleMapsService.getAddress(
        coords.latitude,
        coords.longitude,
      );
      applyLocation(address);
    } catch (error) {
      console.log('Location detection failed:', error);
      applyLocation('Location not available');
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const [data, statsData] = await Promise.all([
        getProfile(),
        getProfileStats().catch(() => ({ vehicles: 0, expenses: 0, documents: 0 })),
      ]);
      mapProfileData(data);
      setStats(statsData);
      fetchUserLocation();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch profile');
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
          day: 'numeric',
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
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Could not save changes';
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join('\n');
      } else if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
      Alert.alert('Update Failed', errorMessage);
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
      Alert.alert('Error', err.message || 'Failed to set avatar');
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
              Alert.alert('Success', 'Profile picture removed!');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to remove picture');
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
      const asset = result.assets[0];
      const selectedImage = asset.uri;
      if (selectedImage) {
        if (isEditing && editData) {
          setEditData({ ...editData, profilePic: selectedImage });
        } else {
          try {
            setSaving(true);
            const formData = new FormData();
            formData.append('file', {
              uri: selectedImage,
              name: asset.fileName || 'profile.jpg',
              type: asset.type || 'image/jpeg',
            } as any);
            const updated = await uploadProfilePicture(formData);
            mapProfileData(updated);
            Alert.alert('Success', 'Profile picture updated!');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to update picture');
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

  const currentPic = isEditing ? editData?.profilePic : profile?.profilePic;
  const profilePicUri = currentPic ? getAbsoluteUrl(currentPic) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />


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
                      source={{ uri: profilePicUri }}
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
                  <Text style={[styles.bottomSheetTitle, { fontFamily: 'Outfit-Bold' }]}>Profile picture</Text>
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
                      <MaterialIcon name="photo-camera" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bottomSheetOption}
                    activeOpacity={0.7}
                    onPress={handleGalleryOption}
                  >
                    <View style={styles.bottomSheetIconWrap}>
                      <MaterialIcon name="photo-library" size={22} color="#FFFFFF" />
                    </View>
                    <Text style={styles.bottomSheetOptionText}>Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.bottomSheetOption}
                    activeOpacity={0.7}
                    onPress={handleAvatarOption}
                  >
                    <View style={styles.bottomSheetIconWrap}>
                      <MaterialCommunityIcon name="emoticon-outline" size={22} color="#FFFFFF" />
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
            <BackButton onPress={() => setAvatarModal(false)} />
            <Text style={[styles.avatarModalTitle, { fontFamily: 'Outfit-Bold' }]}>Choose Avatar</Text>
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

      {/* ── Advanced Profile Modal (Personal Info) ── */}
      <Modal
        visible={infoModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (isEditing) handleCancel();
          setInfoModal(false);
        }}
        statusBarTranslucent
      >
        <View style={styles.advancedModalOverlay}>
          <TouchableWithoutFeedback onPress={() => {
            if (!isEditing) setInfoModal(false);
          }}>
            <View style={styles.advancedModalBlur} />
          </TouchableWithoutFeedback>

          <Animated.View style={styles.advancedModalContent}>
            {/* Modal Pull Handle */}
            <View style={styles.modalHandle} />

            <View style={styles.advancedModalHeader}>
              <View>
                <Text style={styles.advancedModalTitle}>Account Details</Text>
                <Text style={styles.advancedModalSubtitle}>Personal information & settings</Text>
              </View>
              <View style={styles.headerActions}>
                {!isEditing ? (
                  <TouchableOpacity style={styles.editPill} onPress={handleEdit}>
                    <Icon name="pen" size={10} color="#FFBF00" />
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

            <ScrollView contentContainerStyle={styles.advancedModalScroll} showsVerticalScrollIndicator={false}>
              {/* Profile Image Preview logic within modal */}
              <View style={styles.modalIdentityRow}>
                <TouchableOpacity
                  activeOpacity={currentPic ? 0.8 : 1}
                  onPress={() => { if (currentPic) setPhotoPreview(true); }}
                >
                  <View style={styles.modalAvatar}>
                    {currentPic ? (
                      <Image source={{ uri: profilePicUri }} style={styles.avatarImage} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Icon name="user" size={wp(6)} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                <View style={styles.modalIdentityText}>
                  <Text style={styles.modalName}>{profile.fullName}</Text>
                  <Text style={styles.modalEmail}>{profile.email}</Text>
                </View>
              </View>

              <View style={styles.modalInfoList}>
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
                  icon="phone-alt"
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

              <TouchableOpacity
                style={styles.modalCloseBtnFull}
                activeOpacity={0.8}
                onPress={() => {
                  if (isEditing) handleCancel();
                  setInfoModal(false);
                }}
              >
                <Text style={styles.modalCloseText}>Done</Text>
              </TouchableOpacity>
            </ScrollView>
          </Animated.View>
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
          <View style={styles.headerLeft}>
            <BackButton onPress={() => navigation.goBack()} />
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
          {/* Settings icon removed as requested */}
        </View>

        {/* ── Identity: Improved Avatar + Premium Badge ── */}
        <View style={styles.premiumHeaderBackground}>
          <LinearGradient
            colors={['rgba(255, 215, 0, 0.08)', 'transparent']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
          />
          <View style={styles.identityContainer}>
            <View style={styles.avatarWrap}>
              <View style={styles.avatarGlow} />
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => setInfoModal(true)}
              >
                <View style={styles.avatar}>
                  {currentPic ? (
                    <Image
                      source={{ uri: profilePicUri }}
                      style={styles.avatarImage}
                    />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Icon name="user" size={wp(8)} color="#FFFFFF" />
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
                  <Icon name="camera" size={wp(3.2)} color="#000" />
                )}
              </TouchableOpacity>

            </View>

            <View style={styles.identityTextInfo}>
              <Text style={styles.profileName}>{profile.fullName?.toUpperCase() || 'USER'}</Text>
              <Text style={styles.memberSinceText}>Member since {profile.memberSince.split(' ').pop()}</Text>
            </View>
          </View>
        </View>


        {/* ── Quick Stats: Premium Glassmorphic Grid ── */}
        <View style={styles.statsContainer}>
          <Text style={styles.statsSectionTitle}>FLEET INSIGHTS</Text>
          <View style={styles.premiumStatsGrid}>
            <StatCard
              icon="car"
              label="Vehicles"
              value={String(stats.vehicles)}
              color="#FFD700"
            />
            <StatCard
              icon="receipt"
              label="Expenses"
              value={String(stats.expenses)}
              color="#00F2FF"
            />
            <StatCard
              icon="file-alt"
              label="Docs"
              value={String(stats.documents)}
              color="#FF4B2B"
            />
          </View>
        </View>

        {/* ── Settings & Preferences Section ── */}
        <View style={styles.integratedSettingsCard}>
          <Text style={styles.integratedSettingsTitle}>Settings & Preferences</Text>

          <View style={styles.integratedGroupCard}>
            <MenuRow
              icon="shield-alt"
              label="Emergency Contacts"
              onPress={() => handleMenuPress('SOS')}
              color="#FF4D4D"
              bgColor="rgba(255, 77, 77, 0.1)"
            />
            <MenuRow
              icon="bell"
              label="Notifications"
              onPress={() => { }}
            />
            <MenuRow
              icon="shield-alt"
              label="Privacy & Security"
              onPress={() => { }}
            />
            <MenuRow
              icon="ellipsis-h"
              label="App Settings"
              onPress={() => { }}
            />
            <MenuRow
              icon="question-circle"
              label="Help & Support"
              onPress={() => handleMenuPress('HelpSupport')}
            />
            <MenuRow
              icon="sign-out-alt"
              label="Logout"
              onPress={handleLogout}
              color="#F44336"
              isLast
            />
          </View>
        </View>

        <View style={{ height: hp(10) }} />
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
        <Icon name={icon} size={wp(3.8)} color="#aaa" />
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
  container: { flex: 1, backgroundColor: '#000000' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000000',
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
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontFamily: 'Outfit-Black',
    marginLeft: wp(3),
    letterSpacing: 1,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Identity Section ── */
  premiumHeaderBackground: {
    marginBottom: hp(3),
  },
  identityContainer: {
    alignItems: 'center',
    paddingVertical: hp(1),
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: hp(2),
  },
  avatarGlow: {
    position: 'absolute',
    top: -wp(1),
    left: -wp(1),
    right: -wp(1),
    bottom: -wp(1),
    borderRadius: wp(14),
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255, 215, 0, 0.3)',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  avatar: {
    width: wp(26),
    height: wp(26),
    borderRadius: wp(13),
    borderWidth: 3,
    borderColor: '#111',
    overflow: 'hidden',
    backgroundColor: '#1a1a1a',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#222',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFD700',
    borderWidth: 3,
    borderColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  premiumBadge: {
    position: 'absolute',
    top: -5,
    right: -10,
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#000',
  },
  premiumBadgeText: {
    color: '#000',
    fontFamily: 'Outfit-Black',
    fontSize: 7,
    letterSpacing: 0.5,
  },
  identityTextInfo: {
    alignItems: 'center',
  },
  profileName: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(6),
    letterSpacing: 1.5,
  },
  memberSinceText: {
    fontFamily: 'Outfit-Medium',
    color: 'rgba(255,255,255,0.4)',
    fontSize: wp(3),
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  /* ── Personal Info Card ── */
  infoCard: {
    backgroundColor: '#121212',
    marginHorizontal: wp(4),
    marginTop: hp(1),
    paddingTop: wp(6),
    paddingHorizontal: wp(5),
    paddingBottom: wp(2),
    borderRadius: 22,
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
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    fontSize: wp(4.8),
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFBF00',
    gap: 6,
  },
  editPillText: {
    fontFamily: 'Outfit-SemiBold',
    color: '#FFBF00',
    fontSize: 12,
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
    backgroundColor: '#FFBF00',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  savePillText: {
    fontFamily: 'Outfit-Bold',
    color: '#000',
    fontSize: 12,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(3),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#0A0A0A',
  },
  vContentWrap: {
    flex: 1,
  },
  vLabel: {
    fontFamily: 'Outfit-Medium',
    color: '#888',
    fontSize: wp(3.2),
    marginBottom: 4,
  },
  inputContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 15,
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  inputContainerActive: {
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
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
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    fontSize: wp(4),
    letterSpacing: -0.1,
  },
  vInput: {
    fontFamily: 'Outfit-Bold',
    color: '#FFFFFF',
    fontSize: wp(4),
    padding: 0,
    letterSpacing: -0.1,
  },

  /* ── Stats Container ── */
  statsContainer: {
    paddingHorizontal: wp(4),
    marginTop: hp(2),
    marginBottom: hp(3),
  },
  statsSectionTitle: {
    fontFamily: 'Outfit-Black',
    color: 'rgba(255,255,255,0.3)',
    fontSize: wp(3.2),
    marginBottom: hp(1.5),
    paddingLeft: wp(1),
    letterSpacing: 2,
  },
  premiumStatsGrid: {
    flexDirection: 'row',
    gap: wp(3),
  },
  glassStatCard: {
    flex: 1,
    backgroundColor: '#121212',
    padding: wp(4),
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
  },
  statIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontFamily: 'Outfit-Black',
    color: '#FFFFFF',
    fontSize: wp(5.5),
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: 'Outfit-Bold',
    color: 'rgba(255,255,255,0.4)',
    fontSize: wp(2.8),
    textTransform: 'uppercase',
  },

  /* ── Integrated Settings Styles ── */
  integratedSettingsCard: {
    paddingHorizontal: wp(4),
    marginTop: hp(1),
  },
  integratedSettingsTitle: {
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
    marginBottom: hp(1.2),
    paddingLeft: wp(1),
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  integratedGroupCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(2.2),
    paddingHorizontal: wp(4.5),
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  menuIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3.5),
  },
  menuLabel: {
    flex: 1,
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },

  /* ── Modals & Previews ── */
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
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-Medium',
  },
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
    fontFamily: 'Outfit-Bold',
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
    borderColor: '#FFBF00',
    backgroundColor: 'rgba(255,191,0,0.08)',
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
    backgroundColor: '#FFBF00',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarGridLabel: {
    color: '#888',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    marginTop: 8,
  },
  avatarGridLabelSelected: {
    color: '#FFBF00',
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
    backgroundColor: '#FFBF00',
    borderRadius: 14,
    paddingVertical: hp(1.8),
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarConfirmText: {
    color: '#000',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },

  /* ── Custom Alert Popup ── */
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
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
    fontFamily: 'Outfit-Bold',
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
    fontFamily: 'Outfit-Bold',
    color: '#FFBF00',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  /* ── Advanced Profile Modal Styles ── */
  advancedModalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  advancedModalBlur: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  advancedModalContent: {
    backgroundColor: '#0a0b0e',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    minHeight: hp(85),
    paddingTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHandle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  advancedModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    marginBottom: hp(2),
  },
  advancedModalTitle: {
    fontFamily: 'Outfit-Black',
    fontSize: wp(5.5),
    color: '#fff',
    letterSpacing: 0.5,
  },
  advancedModalSubtitle: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
    color: '#666',
    marginTop: 2,
  },
  advancedModalScroll: {
    paddingBottom: hp(10),
  },
  modalIdentityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(6),
    marginBottom: hp(4),
    marginTop: hp(1),
  },
  modalAvatar: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 2,
    borderColor: '#FFD700',
    overflow: 'hidden',
  },
  modalIdentityText: {
    marginLeft: wp(4),
  },
  modalName: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4.5),
    color: '#fff',
  },
  modalEmail: {
    fontFamily: 'Outfit-Medium',
    fontSize: wp(3.2),
    color: '#888',
  },
  modalInfoList: {
    paddingHorizontal: wp(6),
  },
  modalCloseBtnFull: {
    marginHorizontal: wp(6),
    marginTop: hp(4),
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalCloseText: {
    fontFamily: 'Outfit-Bold',
    fontSize: wp(4),
    color: '#fff',
  },
});

/* ── Menu Row Sub-component with Animation ── */
function MenuRow({ icon, label, onPress, color = "#aaa", bgColor = "#000", isLast = false }: any) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
    >
      <Animated.View style={[
        styles.menuRow,
        !isLast && styles.menuRowBorder,
        { transform: [{ scale: scaleAnim }] }
      ]}>
        <View style={[styles.menuIconWrap, { backgroundColor: bgColor }]}>
          <Icon name={icon} size={wp(4.2)} color={color} />
        </View>
        <Text style={[styles.menuLabel, label === 'Logout' && { color: '#F44336' }]}>{label}</Text>
        <Icon name="chevron-right" size={wp(3)} color="#333" />
      </Animated.View>
    </TouchableOpacity>
  );
}

/* ── Stat Card Sub-component ── */
function StatCard({ icon, label, value, color }: any) {
  return (
    <View style={styles.glassStatCard}>
      <View style={[styles.statIconBox, { backgroundColor: `${color}15` }]}>
        <Icon name={icon} size={14} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}
