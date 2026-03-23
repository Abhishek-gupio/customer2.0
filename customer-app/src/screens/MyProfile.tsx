import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  Platform,
  TouchableOpacity,
  useWindowDimensions,
  StatusBar,
  PixelRatio,
  useColorScheme,
  PermissionsAndroid,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { useNavigation } from '@react-navigation/native';
import WaveLayout from '../components/CommonUI';
import ReusableModal from '../components/ReusableModal';
import { getProfile, updateProfilePicture } from '../services/authApi';

const sidearrow = require('../assets/CaretLeft.png');
const STORAGE_KEY = '@user_profile_v1';

type ProfileType = {
  name: string;
  email: string;
  phone: string;
  imageUri: string | null;
};

const systemFont = Platform.select({
  ios: 'SF Pro Text',
  android: 'System',
}) as string;

const MyProfile: React.FC = () => {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();

  const [editMode, setEditMode] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [imageLoading, setImageLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileType>({
    name: 'Dr.Yadhagiri',
    email: 'Mr.Yadhagiri@gmail.com',
    phone: '+91 8074849052',
    imageUri: null,
  });
  
  /* Modal states for replacing Alert messages */
  const [showImagePickerModal, setShowImagePickerModal] = useState(false);
  const [showPermissionDeniedModal, setShowPermissionDeniedModal] = useState(false);
  const [showCameraErrorModal, setShowCameraErrorModal] = useState(false);
  const [showGalleryErrorModal, setShowGalleryErrorModal] = useState(false);
  const [showSaveSuccessModal, setShowSaveSuccessModal] = useState(false);
  const [showSaveErrorModal, setShowSaveErrorModal] = useState(false);

  const hit = { top: 8, bottom: 8, left: 8, right: 8 };

  const bottomMargin = useMemo(() => {
    // iOS logic untouched
    if (Platform.OS === 'ios') {
      if (height <= 667) return hp('4%'); // iPhone SE / 6 / 7 / 8
      if (height <= 812) return hp('-1%'); // iPhone X / 11 Pro / 12 Mini
      if (height <= 926) return hp('-1%'); // iPhone 11/12/13/14 Pro Max
      return hp('-1%');
    }

    // ANDROID logic (optimized)
    if (Platform.OS === 'android') {
      if (height <= 720) return hp('3.7%');
      if (height <= 880) return hp('0.3%');
      if (height <= 1000) return hp('0.5%');
      return hp('0.4%');
    }

    return hp('-1%');
  }, [height]);

  // compute a header top margin that is device-height-aware
  const headerTopMargin = useMemo(() => {
    if (height <= 720) {
      return hp('8%');
    }
    if (height <= 880) {
      return hp('10%');
    }
    if (height <= 1000) {
      return hp('11%');
    }
    return hp('11.2%');
  }, [height]);

  /* ---------- Responsive dynamic sizes with iOS-safe caps ---------- */
  const dynamic = useMemo(() => {
    // prefer percentage-based but clamp with sensible min/max for very small/large screens
    const basePct = 0.42;
    const raw = width * basePct;
    const maxProfile = Math.min(hp('30%'), 260);
    const minProfile = Math.max(hp('18%'), 100);
    const PROFILE_SIZE = Math.round(
      Math.max(minProfile, Math.min(raw, maxProfile)),
    );

    return {
      PROFILE_SIZE,
      HEADER_FONT_SIZE: Math.max(14, Math.round(hp('2%'))),
      NAME_FONT_SIZE: Math.max(16, Math.round(hp('2.8%'))),
      ARROW_ICON_W: Math.round(wp('6%')),
      ARROW_ICON_H: Math.round(hp('3%')),
      ICON_BTN_SIZE: Math.min(Math.round(wp('5%')), 56),
      PROFILE_TOP_MARGIN: Platform.OS === 'ios' ? hp('8%') : headerTopMargin, // we will add insets.top in layout
      NAME_TOP_MARGIN: hp('2%'),
    };
  }, [width, height]);

  /* ---------- Load / persist profile ---------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const json = await AsyncStorage.getItem(STORAGE_KEY);
        if (json && mounted) {
          const saved = JSON.parse(json) as Partial<ProfileType>;
          setProfile(p => ({
            ...p,
            name: saved.name ?? p.name,
            email: saved.email ?? p.email,
            phone: saved.phone ?? p.phone,
            imageUri: (saved.imageUri ?? null) as string | null,
          }));
        }

        try {
          const remote = await getProfile();
          if (!mounted) return;
          setProfile(p => ({
            ...p,
            name: remote.fullName || p.name,
            email: remote.email || p.email,
            phone: remote.phoneNumber || p.phone,
            imageUri: (remote.image ?? null) as string | null,
          }));

          await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
              name: remote.fullName || profile.name,
              email: remote.email || profile.email,
              phone: remote.phoneNumber || profile.phone,
              imageUri: remote.image ?? null,
            }),
          );
        } catch (e) {
          console.warn('[MyProfile] fetch failed', e);
        }
      } catch (e) {
        console.warn('[MyProfile] load local failed', e);
      } finally {
        if (mounted) setLoadingProfile(false);
      }
    })();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBackPress = () => navigation.goBack();

  const showImagePickerOptions = () => {
    setShowImagePickerModal(true);
  };

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs access to your camera to take profile pictures.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Camera permission error:', err);
        return false;
      }
    }
    // iOS permissions are handled automatically by react-native-image-picker
    return true;
  };

  const openCamera = async () => {
    try {
      // Request camera permission first
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        setShowPermissionDeniedModal(true);
        return;
      }

      const res = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        saveToPhotos: false,
      });
      if (res.didCancel) return;
      const asset = res.assets && res.assets[0];
      if (asset) {
        const uri = asset.uri ?? null;
        setProfile(p => ({ ...p, imageUri: uri }));
        setEditMode(true);
      }
    } catch (e) {
      console.warn('camera error', e);
      setShowCameraErrorModal(true);
    }
  };

  const openGallery = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 1,
      });
      if (res.didCancel) return;
      const asset = res.assets && res.assets[0];
      if (asset) {
        const uri = asset.uri ?? null;
        setProfile(p => ({ ...p, imageUri: uri }));
        setEditMode(true);
      }
    } catch (e) {
      console.warn('image pick error', e);
      setShowGalleryErrorModal(true);
    }
  };

  const pickImage = () => {
    showImagePickerOptions();
  };

  const saveProfile = async () => {
    try {
      setImageLoading(true);
      if (profile.imageUri && !/^https?:\/\//.test(profile.imageUri)) {
        const updated = await updateProfilePicture(profile.imageUri);
        setProfile(p => ({ ...p, imageUri: updated.image ?? p.imageUri }));
      }

      const fresh = await getProfile();
      setProfile(p => ({
        ...p,
        name: fresh.fullName || p.name,
        email: fresh.email || p.email,
        phone: fresh.phoneNumber || p.phone,
        imageUri: (fresh.image ?? null) as string | null,
      }));

      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          name: fresh.fullName || profile.name,
          email: fresh.email || profile.email,
          phone: fresh.phoneNumber || profile.phone,
          imageUri: fresh.image ?? null,
        }),
      );

      setEditMode(false);
      setShowSaveSuccessModal(true);
    } catch (e) {
      console.warn('[MyProfile] Save failed:', e);
      setShowSaveErrorModal(true);
    } finally {
      setImageLoading(false);
    }
  };

  const cancelEdit = async () => {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) {
        const saved = JSON.parse(json) as Partial<ProfileType>;
        setProfile(p => ({
          ...p,
          imageUri: (saved.imageUri ?? null) as string | null,
        }));
      } else {
        setProfile(p => ({ ...p, imageUri: null }));
      }
    } catch (e) {
      console.warn('cancel reload failed', e);
    } finally {
      setEditMode(false);
    }
  };

  const getImageSource = () => {
    if (profile.imageUri && profile.imageUri.trim() !== '') {
      let url = profile.imageUri;
      if (url.startsWith('/')) url = `https://your-api-domain.com${url}`;
      try {
        // @ts-ignore
        new URL(url);
        return { uri: url };
      } catch (e) {
        console.warn('[MyProfile] Invalid image URL', e);
        return null;
      }
    }
    return null;
  };

  /* ---------- dynamic style blocks (use insets for iOS safe area) ---------- */
  const dynStyles = {
    profileContainer: {
      width: dynamic.PROFILE_SIZE,
      height: dynamic.PROFILE_SIZE,
      borderRadius: dynamic.PROFILE_SIZE / 2,
      overflow: 'hidden' as const,
      justifyContent: 'center' as const,
      alignItems: 'center' as const,
      marginTop: dynamic.PROFILE_TOP_MARGIN,
      alignSelf: 'center' as const,
      backgroundColor: '#000000',
    },
    profileImage: {
      width: dynamic.PROFILE_SIZE,
      height: dynamic.PROFILE_SIZE,
      borderRadius: dynamic.PROFILE_SIZE / 2,
      resizeMode: 'cover' as const,
      // ensure crisp image scaling on iOS
      transform: [{ scale: PixelRatio.get() >= 3 ? 1 : 1 }],
    },
    iconBtnDynamic: {
      width: dynamic.ICON_BTN_SIZE,
      height: dynamic.ICON_BTN_SIZE,
      borderRadius: dynamic.ICON_BTN_SIZE / 2,
    },
  };

  const isDarkMode = useColorScheme(); // keep status bar sync; if you use theme, map accordingly

  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <View style={styles.container}>
        <WaveLayout
          topContainerStyle={{ ...styles.topContentContainer, paddingTop: 0 }}
          bottomContainerStyle={styles.bottomContentContainer}
          waveSectionStyle={styles.waveSectionStyle}
          topContent={
            <>
              <View style={[styles.topBar]}>
                {/* topBar now respects safe area inset */}
                <TouchableOpacity
                  style={styles.arrowContainer}
                  onPress={handleBackPress}
                  hitSlop={hit}
                  accessibilityRole="button"
                  accessibilityLabel="Go back"
                >
                  <Image
                    source={sidearrow}
                    style={[
                      styles.arrowIcon,
                      {
                        width: dynamic.ARROW_ICON_W,
                        height: dynamic.ARROW_ICON_H,
                      },
                    ]}
                    resizeMode="contain"
                  />
                </TouchableOpacity>

                <View style={styles.myProfileHeaderContainer}>
                  <Text
                    style={[
                      styles.myProfileHeader,
                      { fontSize: dynamic.HEADER_FONT_SIZE },
                    ]}
                  >
                    My Profile
                  </Text>
                </View>

                {editMode && (
                  <View style={styles.iconActions}>
                    <TouchableOpacity
                      onPress={saveProfile}
                      style={[
                        styles.iconBtn,
                        styles.saveIconBtn,
                        dynStyles.iconBtnDynamic,
                      ]}
                      accessibilityLabel="Save profile"
                      hitSlop={hit}
                    >
                      <Text style={styles.iconText}>✓</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={cancelEdit}
                      style={[
                        styles.iconBtn,
                        styles.cancelIconBtn,
                        dynStyles.iconBtnDynamic,
                      ]}
                      accessibilityLabel="Cancel edit"
                      hitSlop={hit}
                    >
                      <Text style={styles.iconText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={dynStyles.profileContainer}>
                <TouchableOpacity
                  activeOpacity={editMode ? 0.7 : 1}
                  onPress={() => editMode && pickImage()}
                  style={styles.imageTouchable}
                >
                  {(() => {
                    const imageSource = getImageSource();
                    if (imageSource) {
                      return (
                        <Image
                          source={imageSource}
                          style={dynStyles.profileImage}
                          onLoadStart={() => setImageLoading(true)}
                          onLoadEnd={() => setImageLoading(false)}
                          onError={e => {
                            console.warn(
                              '[MyProfile] Image load error:',
                              e.nativeEvent?.error || e,
                            );
                            setImageLoading(false);
                          }}
                        />
                      );
                    }
                    return (
                      <View
                        style={{
                          width: dynamic.PROFILE_SIZE,
                          height: dynamic.PROFILE_SIZE,
                          borderRadius: dynamic.PROFILE_SIZE / 2,
                          backgroundColor: '#000000',
                        }}
                      />
                    );
                  })()}

                  {imageLoading && (
                    <View
                      style={[
                        styles.loadingOverlay,
                        { borderRadius: dynamic.PROFILE_SIZE / 2 },
                      ]}
                    >
                      <Text style={styles.loadingText}>Loading...</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </>
          }
          bottomContent={
            <>
              {!loadingProfile && (
                <Text
                  style={[
                    styles.nameText,
                    {
                      fontSize: dynamic.NAME_FONT_SIZE,
                      marginTop: bottomMargin,
                    },
                  ]}
                >
                  {profile.name}
                </Text>
              )}

              {!editMode && !loadingProfile && (
                <TouchableOpacity
                  onPress={pickImage}
                  style={styles.editProfileTextContainer}
                  accessibilityLabel="Edit profile"
                >
                  <Text style={styles.editProfileText}>Change profile picture</Text>
                </TouchableOpacity>
              )}

              {!loadingProfile && (
                <View style={styles.card}>
                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Email Account</Text>
                      <Text style={styles.value}>{profile.email}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.row}>
                    <View style={styles.col}>
                      <Text style={styles.label}>Phone</Text>
                      <Text style={styles.value}>{profile.phone}</Text>
                    </View>
                  </View>
                </View>
              )}
            </>
          }
        />
      </View>

      {/* Image Picker Modal */}
      <ReusableModal
        visible={showImagePickerModal}
        onClose={() => setShowImagePickerModal(false)}
        title="Select Profile Picture"
        subtitle="Choose an option"
        vectorIcon={{
          name: 'camera-alt',
          size: wp(15),
          color: '#1F1B4E',
          library: 'MaterialIcons',
        }}
        primaryButton={{
          text: 'Camera',
          onPress: () => {
            setShowImagePickerModal(false);
            openCamera();
          },
        }}
        secondaryButton={{
          text: 'Gallery',
          onPress: () => {
            setShowImagePickerModal(false);
            openGallery();
          },
        }}
        verticalButtons={true}
      />

      {/* Permission Denied Modal */}
      <ReusableModal
        visible={showPermissionDeniedModal}
        onClose={() => setShowPermissionDeniedModal(false)}
        title="Permission Denied"
        subtitle="Camera permission is required to take photos. Please enable it in app settings."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowPermissionDeniedModal(false)}
      />

      {/* Camera Error Modal */}
      <ReusableModal
        visible={showCameraErrorModal}
        onClose={() => setShowCameraErrorModal(false)}
        title="Error"
        subtitle="Could not open camera. Please check camera permissions."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowCameraErrorModal(false)}
      />

      {/* Gallery Error Modal */}
      <ReusableModal
        visible={showGalleryErrorModal}
        onClose={() => setShowGalleryErrorModal(false)}
        title="Error"
        subtitle="Could not pick image"
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowGalleryErrorModal(false)}
      />

      {/* Save Success Modal */}
      <ReusableModal
        visible={showSaveSuccessModal}
        onClose={() => setShowSaveSuccessModal(false)}
        title="Saved"
        subtitle="Profile picture updated successfully!"
        iconType="success"
        buttonText="OK"
        onButtonPress={() => setShowSaveSuccessModal(false)}
      />

      {/* Save Error Modal */}
      <ReusableModal
        visible={showSaveErrorModal}
        onClose={() => setShowSaveErrorModal(false)}
        title="Error"
        subtitle="Could not save profile picture. Please try again."
        iconType="question"
        buttonText="OK"
        onButtonPress={() => setShowSaveErrorModal(false)}
      />
    </>
  );
};

export default MyProfile;

/* ---------- Styles (static) ---------- */
const styles = StyleSheet.create({
  container: { flex: 1 },

  topContentContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  bottomContentContainer: {
    width: '100%',
    alignItems: 'center',
  },

  waveSectionStyle: {
    minHeight: hp('35%'),
  },

  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 0,
    zIndex: 20,
  },

  arrowContainer: {
    width: wp('10%'),
    aspectRatio: 1,
    justifyContent: 'center',
  },

  arrowIcon: {
    resizeMode: 'contain',
    tintColor: '#FFFFFF',
  },

  myProfileHeaderContainer: {
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginLeft: wp('1%'),
  },

  myProfileHeader: {
    color: '#FFF',
    textAlign: 'center',
    fontFamily: systemFont,
    fontWeight: '700',
  },

  iconActions: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp('2%'),
    shadowColor: '#000',
    shadowOpacity: Platform.OS === 'ios' ? 0.12 : 0.22,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  saveIconBtn: { backgroundColor: '#1abc9c' },
  cancelIconBtn: { backgroundColor: '#e74c3c' },
  iconText: {
    color: '#fff',
    fontSize: hp('2%'),
    fontWeight: '700',
    lineHeight: hp('2.4%'),
  },

  imageTouchable: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  cameraOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: wp('3%'),
    paddingVertical: hp('0.6%'),
    borderRadius: wp('3%'),
    // zIndex: 1000,
    elevation: 10,
  },
  cameraText: {
    color: '#fff',
    fontSize: hp('1.6%'),
  },

  nameText: {
    fontWeight: '600',
    color: '#000',
    // alignSelf : 'flex-start'
    // textAlign: 'center',
  },
  editProfileTextContainer: {
    marginTop: hp('1%'),
    paddingVertical: hp('0.3%'),
  },
  editProfileText: {
    // color: '#000000',
    color: 'darkblue',
    fontWeight: '600',
    fontSize: hp('1.8%'),
  },

  card: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: wp('3%'),
    paddingVertical: hp('2.2%'),
    marginTop: hp('2.5%'),
    marginHorizontal: '5%',

    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 8,
  },
  row: {
    width: '100%',
    paddingHorizontal: wp('3.5%'),
    paddingVertical: hp('0.9%'),
  },
  col: { flexDirection: 'column' },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#ccc',
    width: '92%',
    alignSelf: 'center',
    marginTop: hp('1%'),
    marginBottom: hp('1%'),
  },
  label: {
    fontSize: hp('1.5%'),
    color: '#888',
    marginBottom: hp('0.5%'),
  },
  value: {
    fontSize: hp('2%'),
    color: '#222',
    fontWeight: '500',
  },

  input: {
    width: '85%',
    height: hp('6%'),
    borderRadius: wp('2%'),
    backgroundColor: '#fff',
    paddingHorizontal: wp('3%'),
    borderWidth: 1,
    borderColor: '#e6e6e6',
    fontSize: hp('1.9%'),
    color: '#222',
    marginBottom: hp('1%'),
    textAlign: 'center',
    marginTop: Platform.OS === 'ios' ? hp('0.6%') : 0,
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(44, 38, 114, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: hp('1.6%'),
    fontWeight: '600',
  },
});

