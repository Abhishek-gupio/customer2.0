import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';

type ProfileNavProp = NativeStackNavigationProp<RootStackParamList, 'MyProfile'>;

interface ProfileData {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  memberSince: string;
}

const INITIAL_PROFILE: ProfileData = {
  fullName: 'Rajesh Kumar',
  email: 'rajesh.kumar@email.com',
  phone: '+91 98765 43210',
  location: 'Mumbai, Maharashtra',
  memberSince: 'January 2024',
};

export default function MyProfile() {
  const navigation = useNavigation<ProfileNavProp>();
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfileData>(INITIAL_PROFILE);
  const [editData, setEditData] = useState<ProfileData>(INITIAL_PROFILE);

  const handleEdit = () => {
    setEditData({ ...profile });
    setIsEditing(true);
  };

  const handleSave = () => {
    setProfile({ ...editData });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData({ ...profile });
    setIsEditing(false);
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    setEditData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Profile Header ─── */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Icon name="user-alt" size={wp(10)} color="#888" />
            </View>
            <TouchableOpacity style={styles.cameraBtn} activeOpacity={0.85}>
              <Icon name="camera" size={wp(3)} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.profileHeaderInfo}>
            <Text style={styles.profileName}>{profile.fullName}</Text>
            <Text style={styles.profileSub}>Member since {profile.memberSince}</Text>
          </View>
          <TouchableOpacity
            style={styles.settingsBtn}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('Settings')}
          >
            <Icon name="cog" size={wp(5)} color="#888" />
          </TouchableOpacity>
        </View>

        {/* ─── Personal Information Card ─── */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            {!isEditing ? (
              <TouchableOpacity style={styles.editBtn} onPress={handleEdit} activeOpacity={0.85}>
                <Icon name="pen" size={wp(3)} color="#fff" style={{ marginRight: wp(1.5) }} />
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.editActions}>
                <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel} activeOpacity={0.85}>
                  <Icon name="times-circle" size={wp(5.5)} color="#F44336" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
                  <Icon name="save" size={wp(3.5)} color="#000" style={{ marginRight: wp(1.5) }} />
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Full Name */}
          <InfoRow
            icon="user-alt"
            label="Full Name"
            value={isEditing ? editData.fullName : profile.fullName}
            isEditing={isEditing}
            onChangeText={(v) => updateField('fullName', v)}
          />

          {/* Email */}
          <InfoRow
            icon="envelope"
            label="Email Address"
            value={isEditing ? editData.email : profile.email}
            isEditing={isEditing}
            onChangeText={(v) => updateField('email', v)}
            keyboardType="email-address"
          />

          {/* Phone */}
          <InfoRow
            icon="phone-alt"
            label="Phone Number"
            value={isEditing ? editData.phone : profile.phone}
            isEditing={isEditing}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
          />

          {/* Location */}
          <InfoRow
            icon="map-marker-alt"
            label="Location"
            value={isEditing ? editData.location : profile.location}
            isEditing={isEditing}
            onChangeText={(v) => updateField('location', v)}
          />

          {/* Member Since */}
          <InfoRow
            icon="calendar-alt"
            label="Member Since"
            value={profile.memberSince}
            isEditing={false}
          />
        </View>

        {/* ─── Quick Stats ─── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Stats</Text>
          <View style={styles.statsRow}>
            <StatItem value="2" label="Vehicles" />
            <StatItem value="47" label="Expenses" />
            <StatItem value="12" label="Documents" />
          </View>
        </View>

        <View style={{ height: hp(4) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Info Row Component ── */
function InfoRow({
  icon,
  label,
  value,
  isEditing,
  onChangeText,
  keyboardType,
}: {
  icon: string;
  label: string;
  value: string;
  isEditing: boolean;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIconWrap}>
        <Icon name={icon} size={wp(4.5)} color="#888" />
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        {isEditing && onChangeText ? (
          <TextInput
            style={styles.infoInput}
            value={value}
            onChangeText={onChangeText}
            placeholderTextColor="#666"
            keyboardType={keyboardType ?? 'default'}
          />
        ) : (
          <Text style={styles.infoValue}>{value}</Text>
        )}
      </View>
    </View>
  );
}

/* ── Stat Item ── */
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statItem}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/* ════════════════════ Styles ════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: hp(4) },

  /* Profile Header */
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(2.5),
  },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: wp(20),
    height: wp(20),
    borderRadius: wp(10),
    backgroundColor: '#1a1a1a',
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    left: wp(12),
    width: wp(7),
    height: wp(7),
    borderRadius: wp(3.5),
    backgroundColor: '#333',
    borderWidth: 1.5,
    borderColor: '#555',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHeaderInfo: {
    flex: 1,
    marginLeft: wp(4),
  },
  profileName: {
    fontSize: wp(5.5),
    fontWeight: '700',
    color: '#fff',
  },
  profileSub: {
    fontSize: wp(3.2),
    color: '#888',
    marginTop: hp(0.3),
  },
  settingsBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Card */
  card: {
    backgroundColor: '#111',
    borderRadius: wp(4),
    marginHorizontal: wp(4),
    marginBottom: hp(2),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  cardTitle: {
    fontSize: wp(4.5),
    fontWeight: '700',
    color: '#fff',
  },

  /* Edit / Save / Cancel */
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
    borderRadius: wp(5),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.7),
  },
  editBtnText: {
    fontSize: wp(3.5),
    fontWeight: '600',
    color: '#fff',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
  },
  cancelBtn: {
    padding: wp(1),
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFBF00',
    borderRadius: wp(5),
    paddingHorizontal: wp(3.5),
    paddingVertical: hp(0.7),
  },
  saveBtnText: {
    fontSize: wp(3.5),
    fontWeight: '700',
    color: '#000',
  },

  /* Info Row */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: hp(2.5),
  },
  infoIconWrap: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
    marginTop: hp(0.3),
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: wp(3.2),
    color: '#888',
    marginBottom: hp(0.4),
  },
  infoValue: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: '#fff',
  },
  infoInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(2.5),
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    fontSize: wp(4),
    color: '#fff',
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: hp(1.5),
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: wp(6),
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: wp(3.2),
    color: '#888',
    marginTop: hp(0.3),
  },
});
