import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
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

export default function MyProfile() {
  const navigation = useNavigation<ProfileNavProp>();

  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editData, setEditData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const dispatch = useDispatch();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: () => {
            logoutStorage();
            dispatch(logout());
            // React Navigation should automatically redirect to the unauthenticated stack
            // because Redux state `isAuthenticated` will flip to false.
          }
        },
      ]
    );
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await getProfile();
      mapProfileData(data);
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
      location: 'India',
      profilePic: data.profilePic,
      memberSince: data.createdAt
        ? new Date(data.createdAt).toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
        })
        : 'Unknown',
    };
    setProfile(formatted);
    setEditData(formatted);
  };

  const handleEdit = () => {
    if (profile) {
      setEditData({ ...profile });
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    if (!editData) return;

    try {
      setSaving(true);
      const updated = await updateProfile({
        fullName: editData.fullName,
        email: editData.email,
        profilePic: editData.profilePic,
      });

      mapProfileData(updated);
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error: any) {
      Alert.alert('Update Failed', error.message || 'Could not save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setEditData({ ...profile });
      setIsEditing(false);
    }
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    if (!editData) return;
    setEditData((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleImagePick = () => {
    Alert.alert(
      'Upload Profile Picture',
      'Choose an option',
      [
        {
          text: 'Camera',
          onPress: async () => {
            const result = await launchCamera({
              mediaType: 'photo',
              quality: 0.7,
            });
            processImageResult(result);
          },
        },
        {
          text: 'Gallery',
          onPress: async () => {
            const result = await launchImageLibrary({
              mediaType: 'photo',
              quality: 0.7,
            });
            processImageResult(result);
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
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
        <ActivityIndicator size="large" color="#FFBF00" />
        <Text style={{ color: '#888', marginTop: 15 }}>Loading profile...</Text>
      </SafeAreaView>
    );
  }

  if (!profile || !editData) return null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      {/* Modern Top Header Nav */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.topHeaderTitle}>Profile</Text>
        <TouchableOpacity onPress={isEditing ? handleCancel : () => navigation.navigate('Settings')}>
          {isEditing ? (
            <Text style={styles.cancelLinkText}>Cancel</Text>
          ) : (
            <Icon name="cog" size={wp(5.5)} color="#888" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Identity Card */}
        <View style={styles.identityContainer}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatar}>
              {(isEditing ? editData.profilePic : profile.profilePic) ? (
                <Image
                  source={{ uri: isEditing ? editData.profilePic : profile.profilePic }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Icon name="user" size={wp(10)} color="#FFBF00" />
                </View>
              )}
            </View>
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

          <Text style={styles.profileName}>{profile.fullName || 'New User'}</Text>
          <Text style={styles.profileMeta}>Member Since {profile.memberSince}</Text>
        </View>

        {/* Section Title & Main Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.cardHeaderLarge}>
            <View style={styles.titleRow}>
              <Text style={styles.cardInfoTitle}>Personal Details</Text>
              <View style={styles.titleAccent} />
            </View>

            {!isEditing ? (
              <TouchableOpacity style={styles.editPill} onPress={handleEdit}>
                <Icon name="pen" size={10} color="#000" />
                <Text style={styles.editPillText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.savePill, saving && { opacity: 0.6 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <Text style={styles.savePillText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          <VerticalInfoRow
            icon="user"
            label="Full Name"
            value={isEditing ? editData.fullName : profile.fullName}
            isEditing={isEditing}
            onChange={(v: string) => updateField('fullName', v)}
          />

          <VerticalInfoRow
            icon="envelope"
            label="Email Address"
            value={isEditing ? editData.email : profile.email}
            isEditing={isEditing}
            onChange={(v: string) => updateField('email', v)}
            keyboardType="email-address"
          />

          <VerticalInfoRow
            icon="phone"
            label="Contact Number"
            value={profile.phone}
            isEditing={false}
          />

          <VerticalInfoRow
            icon="map-marker-alt"
            label="Living in"
            value={profile.location}
            isEditing={false}
            hideBorder
          />
        </View>

        {/* Action List Section */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionTitleAlt}>Account Settings</Text>
          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(59,130,246,0.1)' }]}>
              <Icon name="shield-alt" size={14} color="#3b82f6" />
            </View>
            <Text style={styles.actionText}>Privacy & Security</Text>
            <Icon name="chevron-right" size={12} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionItem}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Icon name="bell" size={14} color="#10b981" />
            </View>
            <Text style={styles.actionText}>Notifications</Text>
            <Icon name="chevron-right" size={12} color="#444" />
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionItem, { borderBottomWidth: 0 }]}>
            <View style={[styles.actionIconWrap, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
              <Icon name="power-off" size={14} color="#ef4444" />
            </View>
            <Text style={[styles.actionText, { color: '#ef4444' }]}>Sign Out</Text>
          </TouchableOpacity>
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
  hideBorder = false,
}: any) {
  return (
    <View style={[styles.verticalRow, hideBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.vIconWrap}>
        <Icon name={icon} size={wp(3.5)} color="#aaa" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.vLabel}>{label}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(1.5),
  },
  backBtn: {
    padding: 5,
  },
  topHeaderTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cancelLinkText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp(4) },

  identityContainer: {
    alignItems: 'center',
    paddingVertical: hp(3),
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: hp(2.5),
  },
  avatarGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: wp(16),
    backgroundColor: '#FFBF00',
    opacity: 0.1,
    transform: [{ scale: 1.1 }],
  },
  avatar: {
    width: wp(32),
    height: wp(32),
    borderRadius: wp(16),
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#222',
  },
  avatarPlaceholder: {
    backgroundColor: '#1a1a1a',
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
    bottom: 5,
    right: 5,
    backgroundColor: '#FFBF00',
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#0a0a0a',
  },
  profileName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  profileMeta: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    fontWeight: '500',
  },

  infoCard: {
    backgroundColor: '#111',
    marginHorizontal: wp(5),
    marginTop: hp(2),
    padding: wp(5),
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  cardHeaderLarge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(4),
  },
  titleRow: {
    position: 'relative',
  },
  cardInfoTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  titleAccent: {
    position: 'absolute',
    bottom: -4,
    left: 0,
    width: wp(10),
    height: 2,
    backgroundColor: '#FFBF00',
  },
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFBF00',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    gap: 6,
  },
  editPillText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  savePill: {
    backgroundColor: '#FFBF00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  savePillText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },

  verticalRow: {
    flexDirection: 'row',
    paddingBottom: hp(2),
    marginBottom: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    alignItems: 'flex-start',
  },
  vIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: 12,
    backgroundColor: '#161616',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: wp(4),
  },
  vLabel: {
    color: '#666',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  vValue: {
    color: '#eee',
    fontSize: 16,
    fontWeight: '600',
  },
  vInput: {
    color: '#FFBF00',
    fontSize: 16,
    fontWeight: '800',
    padding: 0, // Clean look in the row
  },

  sectionTitleAlt: {
    color: '#555',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: hp(2.5),
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  actionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  actionText: {
    flex: 1,
    color: '#eee',
    fontSize: 16,
    fontWeight: '500',
  }
});