import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Dimensions,
  PermissionsAndroid,
  Platform,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { State } from 'react-native-gesture-handler';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useNavigation, CommonActions, useFocusEffect } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { logoutStorage } from '../../services/authService';
import { getProfileStats, updateProfile, uploadProfilePicture, type ProfileResponse, type ProfileStatsResponse } from '../../services/profileService';
import { getAbsoluteUrl } from '../../config';
import { googleMapsService } from '../../services/googleMapsService';
import { getQueuedActionSummary } from '../../services/offlineMutationQueue';
import StatusModal from '../../components/common/Modals/StatusModal';
import ConfirmModal from '../../components/common/Modals/ConfirmModal';
import { useProfileStore } from '../../store/profileStore';
import { ProfileOverviewContent } from './components/ProfileOverviewContent';
import { ProfileInfoModal } from './components/ProfileInfoModal';
import { ProfileMediaModals } from './components/ProfileMediaModals';

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

type ProfileStatsCardItem = {
  icon: string;
  label: string;
  value: string;
  color: string;
};

type ProfileMenuItem = {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
  bgColor?: string;
  borderColor?: string;
  isLast?: boolean;
  badgeCount?: number;
};

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
  const resolvedLocationRef = useRef<string>('Detecting...');
  const locationRequestInFlightRef = useRef(false);
  const setCachedProfile = useProfileStore((state) => state.setProfile);
  const loadCachedProfile = useProfileStore((state) => state.loadProfile);

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
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'default' as 'default' | 'delete' | 'logout',
    onConfirm: () => { },
  });
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });

  const showStatus = useCallback((title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  }, []);
  const queuedSummary = getQueuedActionSummary();
  const queuedTotal = queuedSummary.documentUploads + queuedSummary.expenseCreates;

  const handleLogout = useCallback(() => {
    setConfirmModal({
      visible: true,
      title: 'Logout',
      message: 'Are you sure you want to logout? You will need to sign in again to access your garage.',
      type: 'logout',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        logoutStorage();
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Signin' }],
          })
        );
      }
    });
  }, [navigation]);

  const handleMenuPress = useCallback((route?: keyof RootStackParamList, onPress?: () => void) => {
    if (route) {
      navigation.navigate(route as never);
    } else if (onPress) {
      onPress();
    }
  }, [navigation]);

  // Animation handling for pinch-to-zoom
  const zoomScale = React.useRef(new Animated.Value(1)).current;

  const onPinchEvent = useMemo(
    () => Animated.event([{ nativeEvent: { scale: zoomScale } }], { useNativeDriver: true }),
    [zoomScale],
  );

  const onPinchStateChange = useCallback((event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      Animated.spring(zoomScale, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 1,
      }).start();
    }
  }, [zoomScale]);


  const validate = useCallback(() => {
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
  }, [editData]);

  // Request location permission (Android + iOS)
  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
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
  }, []);

  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera access to capture your profile picture',
          buttonPositive: 'OK',
          buttonNegative: 'Cancel',
        },
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const requestStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const permission = Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

      const granted = await PermissionsAndroid.request(permission, {
        title: 'Photo Library Permission',
        message: 'App needs access to your photo library to select a profile picture',
        buttonPositive: 'OK',
        buttonNegative: 'Cancel',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }, []);

  const getGpsPosition = useCallback(async (): Promise<{ latitude: number; longitude: number } | null> => {
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
  }, [requestLocationPermission]);

  const applyResolvedLocation = useCallback((locationStr: string) => {
    resolvedLocationRef.current = locationStr;
    setProfile((prev) => (prev ? { ...prev, location: locationStr } : prev));
    setEditData((prev) => (prev ? { ...prev, location: locationStr } : prev));
  }, []);

  const fetchUserLocation = useCallback(async () => {
    if (locationRequestInFlightRef.current) return;
    locationRequestInFlightRef.current = true;
    try {
      const gpsCoords = await getGpsPosition();
      const coords = gpsCoords ?? await googleMapsService.getCurrentLocation();
      const address = await googleMapsService.getAddress(
        coords.latitude,
        coords.longitude,
      );
      applyResolvedLocation(address);
    } catch (error) {
      console.log('Location detection failed:', error);
      applyResolvedLocation('Location not available');
    } finally {
      locationRequestInFlightRef.current = false;
    }
  }, [applyResolvedLocation, getGpsPosition]);

  const mapProfileData = useCallback((data: ProfileResponse) => {
    setCachedProfile(data);
    const location = resolvedLocationRef.current;
    const formatted: ProfileData = {
      fullName: data.fullName ?? '',
      email: data.email ?? '',
      phone: data.phoneNumber ?? '',
      location,
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
  }, [setCachedProfile]);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const [data, statsData] = await Promise.all([
        loadCachedProfile(),
        getProfileStats().catch(() => ({ vehicles: 0, expenses: 0, documents: 0 })),
      ]);
      if (!data) throw new Error('Failed to fetch profile');
      mapProfileData(data);
      setStats(statsData);
    } catch (error: any) {
      showStatus('Error', error.message || 'Failed to fetch profile', 'error');
    } finally {
      setLoading(false);
    }
  }, [loadCachedProfile, mapProfileData, showStatus]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
      if (resolvedLocationRef.current === 'Detecting...') {
        fetchUserLocation();
      }
    }, [fetchProfile, fetchUserLocation]),
  );

  const handleEdit = useCallback(() => {
    if (profile) {
      setEditData({ ...profile });
      setErrors({});
      setIsEditing(true);
    }
  }, [profile]);

  const handleSave = useCallback(async () => {
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
      showStatus('Profile Updated', 'Your changes have been saved successfully.');
    } catch (error: any) {
      let errorMessage = error.response?.data?.message || error.message || 'Could not save changes';
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.join('\n');
      } else if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
      showStatus('Update Failed', errorMessage, 'error');
    } finally {
      setSaving(false);
    }
  }, [editData, mapProfileData, showStatus, validate]);

  const handleCancel = useCallback(() => {
    if (profile) {
      setEditData({ ...profile });
      setErrors({});
      setIsEditing(false);
    }
  }, [profile]);

  const updateField = useCallback((field: keyof ProfileData, value: string) => {
    if (!editData) return;
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, [editData]);

  const handleFullNameChange = useCallback((value: string) => {
    updateField('fullName', value);
  }, [updateField]);

  const handleEmailChange = useCallback((value: string) => {
    updateField('email', value);
  }, [updateField]);

  const handlePhoneChange = useCallback((value: string) => {
    updateField('phone', value);
  }, [updateField]);

  const processImageResult = useCallback(async (result: any) => {
    if (result.didCancel) return;

    if (result.errorCode) {
      showStatus('Error', result.errorMessage || 'An error occurred while picking the image', 'error');
      return;
    }

    if (result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      const selectedImage = asset.uri;
      if (selectedImage) {
        if (isEditing && editData) {
          setEditData({ ...editData, profilePic: selectedImage });
        } else {
          if (saving) return; // prevent duplicate upload if already in progress
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
            showStatus('Picture Updated', 'Your profile photo has been updated.');
          } catch (err: any) {
            const isNetworkError =
              err?.message?.toLowerCase().includes('network') ||
              err?.code === 'ECONNREFUSED' ||
              err?.code === 'ERR_NETWORK';
            showStatus(
              'Upload Failed',
              isNetworkError
                ? 'Could not upload photo. Please check your internet connection and try again.'
                : err.message || 'Failed to update picture',
              'error'
            );
          } finally {
            setSaving(false);
          }
        }
      }
    }
  }, [editData, isEditing, mapProfileData, saving, showStatus]);

  const handleImagePick = useCallback(() => {
    setProfilePicModal(true);
  }, []);

  const currentPic = isEditing ? editData?.profilePic : profile?.profilePic;
  const profilePicUri = currentPic ? getAbsoluteUrl(currentPic) : undefined;

  const handleCameraOption = useCallback(async () => {
    setProfilePicModal(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera access is required to take a photo.');
      return;
    }
    const result = await launchCamera({
      mediaType: 'photo',
      quality: 0.7,
    });
    await processImageResult(result);
  }, [processImageResult, requestCameraPermission]);

  const handleGalleryOption = useCallback(async () => {
    setProfilePicModal(false);
    const hasPermission = await requestStoragePermission();
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Storage access is required to pick a photo.');
      return;
    }
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.7,
    });
    await processImageResult(result);
  }, [processImageResult, requestStoragePermission]);

  const handleAvatarOption = useCallback(() => {
    setProfilePicModal(false);
    setSelectedAvatar(currentPic || null);
    setTimeout(() => setAvatarModal(true), 300);
  }, [currentPic]);

  const handleAvatarSelect = useCallback(async (avatarUrl: string) => {
    try {
      setSaving(true);
      setAvatarModal(false);
      const updated = await updateProfile({ profilePic: avatarUrl });
      mapProfileData(updated);
      showStatus('Avatar Set', 'Your new avatar has been applied.');
    } catch (err: any) {
      showStatus('Error', err.message || 'Failed to set avatar', 'error');
    } finally {
      setSaving(false);
    }
  }, [mapProfileData, showStatus]);

  const handleDeleteProfilePic = useCallback(async () => {
    setProfilePicModal(false);
    if (!currentPic) return;
    setConfirmModal({
      visible: true,
      title: 'Remove Picture',
      message: 'Are you sure you want to remove your profile picture?',
      type: 'delete',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          setSaving(true);
          const updated = await updateProfile({ profilePic: '' });
          mapProfileData(updated);
          showStatus('Removed', 'Profile picture removed successfully.');
        } catch (err: any) {
          showStatus('Error', err.message || 'Failed to remove picture', 'error');
        } finally {
          setSaving(false);
        }
      }
    });
  }, [currentPic, mapProfileData, showStatus]);

  const handleBackPress = useCallback(() => navigation.goBack(), [navigation]);
  const openInfoModal = useCallback(() => setInfoModal(true), []);
  const closeInfoModal = useCallback(() => {
    if (isEditing) handleCancel();
    setInfoModal(false);
  }, [handleCancel, isEditing]);
  const openPhotoPreview = useCallback(() => {
    if (currentPic) setPhotoPreview(true);
  }, [currentPic]);
  const closePhotoPreview = useCallback(() => setPhotoPreview(false), []);
  const closeProfilePicModal = useCallback(() => setProfilePicModal(false), []);
  const closeAvatarModal = useCallback(() => setAvatarModal(false), []);
  const selectAvatar = useCallback((avatarUrl: string) => setSelectedAvatar(avatarUrl), []);
  const confirmAvatarSelection = useCallback(() => {
    if (selectedAvatar) {
      handleAvatarSelect(selectedAvatar);
    }
  }, [handleAvatarSelect, selectedAvatar]);
  const openSOS = useCallback(() => handleMenuPress('SOS'), [handleMenuPress]);
  const openHelpSupport = useCallback(() => handleMenuPress('HelpSupport'), [handleMenuPress]);
  const openSyncQueue = useCallback(() => handleMenuPress('SyncQueue'), [handleMenuPress]);
  const openTerms = useCallback(() => navigation.navigate('TermsConditions'), [navigation]);
  const openPrivacy = useCallback(() => navigation.navigate('PrivacyPolicy'), [navigation]);

  const statsCards = useMemo<ProfileStatsCardItem[]>(() => ([
    { icon: 'car', label: 'Vehicles', value: String(stats.vehicles), color: '#FFD700' },
    { icon: 'receipt', label: 'Expenses', value: String(stats.expenses), color: '#00F2FF' },
    { icon: 'file-alt', label: 'Docs', value: String(stats.documents), color: '#FF4B2B' },
  ]), [stats.documents, stats.expenses, stats.vehicles]);

  const settingsItems = useMemo<ProfileMenuItem[]>(() => ([
    {
      icon: 'user-circle',
      label: 'My Account',
      onPress: openInfoModal,
      color: '#00F2FF',
      bgColor: 'rgba(0, 242, 255, 0.1)',
    },
    {
      icon: 'shield-alt',
      label: 'Emergency Contacts',
      onPress: openSOS,
      color: '#FF4D4D',
      bgColor: 'rgba(255, 77, 77, 0.1)',
      borderColor: '#FF4D4D',
    },
    {
      icon: 'file-alt',
      label: 'Terms & Conditions',
      onPress: openTerms,
      color: '#FFFFFF',
      bgColor: 'rgba(255, 255, 255, 0.1)',
      borderColor: '#FFFFFF',
    },
    {
      icon: 'user-shield',
      label: 'Privacy Policy',
      onPress: openPrivacy,
      color: '#7B61FF',
      bgColor: 'rgba(123, 97, 255, 0.1)',
      borderColor: '#7B61FF',
    },
    {
      icon: 'question-circle',
      label: 'Help & Support',
      onPress: openHelpSupport,
      color: '#FFBF00',
      bgColor: 'rgba(255, 191, 0, 0.1)',
      borderColor: '#FFBF00',
    },
    {
      icon: 'sync-alt',
      label: 'Sync Queue',
      onPress: openSyncQueue,
      color: '#4ADE80',
      bgColor: 'rgba(74, 222, 128, 0.1)',
      borderColor: '#4ADE80',
      badgeCount: queuedTotal,
    },
    {
      icon: 'sign-out-alt',
      label: 'Logout',
      onPress: handleLogout,
      color: '#F44336',
      isLast: true,
    },
  ]), [handleLogout, openHelpSupport, openInfoModal, openPrivacy, openSOS, openSyncQueue, openTerms, queuedTotal]);

  if (!profile || !editData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.topBar}>
          <View style={styles.headerLeft}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
              <Icon name="arrow-left" size={wp(4.8)} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Profile</Text>
          </View>
        </View>
        <View style={styles.fallbackState}>
          {loading ? (
            <>
              <ActivityIndicator size="small" color="#e5e5e5" />
              <Text style={styles.fallbackText}>Loading your profile...</Text>
            </>
          ) : (
            <Text style={styles.fallbackText}>Unable to load your profile right now.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      {loading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#e5e5e5" />
          <Text style={styles.loadingBannerText}>Refreshing profile...</Text>
        </View>
      ) : null}






      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ProfileOverviewContent
          styles={styles}
          profile={profile}
          currentPic={currentPic}
          profilePicUri={profilePicUri}
          saving={saving}
          statsItems={statsCards}
          settingsItems={settingsItems}
          onBack={handleBackPress}
          onOpenInfoModal={openInfoModal}
          onImagePick={handleImagePick}
        />
      </ScrollView>

      <ProfileInfoModal
        styles={styles}
        visible={infoModal}
        isEditing={isEditing}
        saving={saving}
        currentPic={currentPic}
        profilePicUri={profilePicUri}
        profile={profile}
        editData={editData}
        errors={errors}
        onRequestClose={closeInfoModal}
        onEdit={handleEdit}
        onSave={handleSave}
        onOpenPhotoPreview={openPhotoPreview}
        onFullNameChange={handleFullNameChange}
        onEmailChange={handleEmailChange}
        onPhoneChange={handlePhoneChange}
      />

      <ProfileMediaModals
        styles={styles}
        photoPreview={photoPreview}
        profilePicModal={profilePicModal}
        avatarModal={avatarModal}
        currentPic={currentPic}
        profilePicUri={profilePicUri}
        selectedAvatar={selectedAvatar}
        avatarItems={AVATAR_LIST}
        saving={saving}
        zoomScale={zoomScale}
        onPinchEvent={onPinchEvent}
        onPinchStateChange={onPinchStateChange}
        onClosePhotoPreview={closePhotoPreview}
        onCloseProfilePicModal={closeProfilePicModal}
        onCloseAvatarModal={closeAvatarModal}
        onCameraOption={handleCameraOption}
        onGalleryOption={handleGalleryOption}
        onAvatarOption={handleAvatarOption}
        onDeleteProfilePic={handleDeleteProfilePic}
        onSelectAvatar={selectAvatar}
        onConfirmAvatar={confirmAvatarSelection}
      />
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />

      {/* ── Confirmation Modal (Logout/Delete) ── */}
      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        confirmText={confirmModal.type === 'logout' ? 'Logout' : 'Remove'}
      />
    </SafeAreaView>
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.82)',
    zIndex: 20,
  },
  loadingBannerText: {
    color: '#b8b8b8',
    fontSize: wp(3.4),
    fontFamily: 'Outfit-Medium',
    marginTop: hp(1.4),
    textAlign: 'center',
  },
  fallbackState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: wp(10),
  },
  fallbackText: {
    color: '#8a8a8a',
    fontSize: wp(3.6),
    textAlign: 'center',
    fontFamily: 'Outfit-Medium',
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
  inputContainerFixed: {
    minHeight: 44,
    justifyContent: 'flex-start',
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
  menuBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 8,
    backgroundColor: '#FFBF00',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  menuBadgeText: {
    color: '#000',
    fontFamily: 'Outfit-Black',
    fontSize: 11,
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
    flex: 1,
    paddingTop: hp(2),
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
    paddingVertical: hp(2),
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
    color: '#fff',
    fontSize: wp(4),
  },

  // Premium Modal Styles
  premiumModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  premiumModalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  premiumModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  premiumModalTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  premiumCloseBtn: {
    padding: 4,
  },
  premiumOptions: {
    gap: 12,
    marginBottom: 24,
  },
  premiumOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 18,
    borderRadius: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  premiumOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  premiumOptionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  premiumCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  premiumCancelText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#888',
  },

  confirmConfirmText: {
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
});

