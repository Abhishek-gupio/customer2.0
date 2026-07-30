import React, { useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import BackButton from '../../components/BackButton';

export interface VehicleUser {
  id: number;
  name: string;
  role: 'Owner' | 'Editor' | 'Viewer' | 'Driver';
  phone: string;
  email?: string;
  invitedAt?: string;
  status?: 'active' | 'pending';
}

export interface Vehicle {
  vehicleNumber: string;
  model: string;
  brand?: string;
}

interface ShareScreenProps {
  visible: boolean;
  onClose: () => void;
  vehicle: Vehicle;
  currentUserId?: number;
  accessList: VehicleUser[];
  onInvite: (phone: string, role: 'Editor' | 'Viewer' | 'Driver') => Promise<void>;
  onRevoke: (userId: number) => Promise<void>;
  isLoading?: boolean;
}

const ShareScreen: React.FC<ShareScreenProps> = ({
  visible,
  onClose,
  vehicle,
  accessList,
  onInvite,
  onRevoke,
  isLoading = false,
}) => {
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteRole, setInviteRole] = useState<'Editor' | 'Viewer' | 'Driver'>('Viewer');
  const [isInviting, setIsInviting] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<number | null>(null);
  const isBusy = isLoading || isInviting || revokingUserId !== null;

  const handleInvite = async () => {
    if (invitePhone.length < 10) {
      Alert.alert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }

    setIsInviting(true);
    try {
      await onInvite(invitePhone, inviteRole);
      setInvitePhone('');
      setInviteRole('Viewer');
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleWhatsAppShare = async () => {
    const message = `${vehicle.brand ? vehicle.brand + ' ' : ''}${vehicle.model} (${vehicle.vehicleNumber}) is being shared with you on Gupio.\n\nDownload the app and sign up with your phone number.\nLink: https://gupio.app/download`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Error', 'Unable to open WhatsApp right now.');
    }
  };

  const handleRevoke = (userId: number, userName: string) => {
    if (isBusy) return;

    Alert.alert(
      'Revoke Access',
      `Are you sure you want to revoke ${userName}'s access?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setRevokingUserId(userId);
            try {
              await onRevoke(userId);
            } finally {
              setRevokingUserId((current) => (current === userId ? null : current));
            }
          },
        },
      ],
    );
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Owner':
        return '#5F9EA0';
      case 'Editor':
        return '#10b981';
      case 'Viewer':
        return '#3b82f6';
      case 'Driver':
        return '#f97316';
      default:
        return '#888';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Owner':
        return 'crown';
      case 'Editor':
        return 'edit';
      case 'Viewer':
        return 'eye';
      case 'Driver':
        return 'steering-wheel';
      default:
        return 'user';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <BackButton onPress={onClose} />
          <View style={styles.header}>
            <View style={[styles.headerCenter, { marginLeft: 0 }]}>
              <Text style={styles.headerTitle}>Share Vehicle</Text>
              <Text style={styles.headerSubtitle}>
                {vehicle.vehicleNumber} - {vehicle.model}
              </Text>
            </View>
            <View style={styles.headerRight} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContainer}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>People with Access</Text>
                <View style={styles.sectionLine} />
              </View>

              <View style={styles.usersContainer}>
                {accessList.map(user => (
                  <View key={user.id} style={styles.userCard}>
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: `${getRoleColor(user.role)}15` },
                      ]}
                    >
                      <FontAwesome5
                        name={getRoleIcon(user.role) as any}
                        size={18}
                        color={getRoleColor(user.role)}
                      />
                    </View>
                    <View style={styles.userInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <View
                          style={[
                            styles.roleBadge,
                            { backgroundColor: `${getRoleColor(user.role)}15` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.roleBadgeText,
                              { color: getRoleColor(user.role) },
                            ]}
                          >
                            {user.role}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.userPhone}>{user.phone}</Text>
                      {user.status === 'pending' && (
                        <View style={styles.pendingBadge}>
                          <FontAwesome5
                            name="clock"
                            size={10}
                            color="#5f9ea0"
                          />
                          <Text style={styles.pendingText}>Pending</Text>
                        </View>
                      )}
                    </View>
                    {user.role !== 'Owner' && (
                      <TouchableOpacity
                        onPress={() => handleRevoke(user.id, user.name)}
                        style={styles.revokeBtn}
                        disabled={isBusy}
                        activeOpacity={0.7}
                      >
                        {revokingUserId === user.id ? (
                          <ActivityIndicator size="small" color="#ef4444" />
                        ) : (
                          <FontAwesome5 name="trash" size={14} color="#ef4444" />
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                ))}

                {accessList.length === 0 && (
                  <View style={styles.emptyState}>
                    <FontAwesome5 name="user-plus" size={40} color="#222" />
                    <Text style={styles.emptyTitle}>No shared access</Text>
                    <Text style={styles.emptySubtext}>
                      Invite people to access this vehicle
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionLine} />
                <Text style={styles.sectionLabel}>Invite New</Text>
                <View style={styles.sectionLine} />
              </View>

              <View style={styles.inviteCard}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>Phone Number</Text>
                  <View style={styles.inputContainer}>
                    <Text style={styles.countryCode}>+91</Text>
                    <TextInput
                      style={styles.phoneInput}
                      value={invitePhone}
                      onChangeText={setInvitePhone}
                      placeholder="Enter phone number"
                      placeholderTextColor="#3a3a3a"
                      keyboardType="phone-pad"
                      maxLength={10}
                      editable={!isBusy}
                    />
                    <FontAwesome5 name="phone" size={14} color="#444" />
                  </View>
                </View>

                <View style={styles.roleWrapper}>
                  <Text style={styles.inputLabel}>Select Role</Text>
                  <View style={styles.roleContainer}>
                    <TouchableOpacity
                      onPress={() => setInviteRole('Viewer')}
                      style={[
                        styles.roleBtn,
                        inviteRole === 'Viewer' && styles.roleBtnActive,
                      ]}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.roleIconBg,
                          inviteRole === 'Viewer' && {
                            backgroundColor: '#3b82f6',
                          },
                        ]}
                      >
                        <FontAwesome5
                          name="eye"
                          size={16}
                          color={inviteRole === 'Viewer' ? '#fff' : '#555'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleText,
                          inviteRole === 'Viewer' && styles.roleTextActive,
                        ]}
                      >
                        Viewer
                      </Text>
                      <Text style={styles.roleDesc}>View reports only</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setInviteRole('Editor')}
                      style={[
                        styles.roleBtn,
                        inviteRole === 'Editor' && styles.roleBtnActive,
                      ]}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.roleIconBg,
                          inviteRole === 'Editor' && {
                            backgroundColor: '#10b981',
                          },
                        ]}
                      >
                        <FontAwesome5
                          name="edit"
                          size={16}
                          color={inviteRole === 'Editor' ? '#fff' : '#555'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleText,
                          inviteRole === 'Editor' && styles.roleTextActive,
                        ]}
                      >
                        Editor
                      </Text>
                      <Text style={styles.roleDesc}>Full access</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setInviteRole('Driver')}
                      style={[
                        styles.roleBtn,
                        inviteRole === 'Driver' && styles.roleBtnActive,
                      ]}
                      disabled={isBusy}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.roleIconBg,
                          inviteRole === 'Driver' && {
                            backgroundColor: '#f97316',
                          },
                        ]}
                      >
                        <FontAwesome5
                          name="steering-wheel"
                          size={16}
                          color={inviteRole === 'Driver' ? '#fff' : '#555'}
                        />
                      </View>
                      <Text
                        style={[
                          styles.roleText,
                          inviteRole === 'Driver' && styles.roleTextActive,
                        ]}
                      >
                        Driver
                      </Text>
                      <Text style={styles.roleDesc}>Drive & log trips</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={handleInvite}
                  disabled={isBusy || invitePhone.length < 10}
                  style={[
                    styles.shareBtn,
                    (isBusy || invitePhone.length < 10) &&
                      styles.shareBtnDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {isInviting ? (
                    <FontAwesome5 name="circle-notch" size={16} color="#000" />
                  ) : (
                    <FontAwesome5 name="paper-plane" size={16} color="#000" />
                  )}
                  <Text style={styles.shareBtnText}>
                    {isInviting ? 'Sending...' : 'Send Invitation'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <FontAwesome5 name="info" size={14} color="#5F9EA0" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.infoText}>
                  The invited person will receive an SMS with a download link.
                  You can also share this vehicle via WhatsApp.
                </Text>
                <TouchableOpacity
                  style={styles.whatsappBtn}
                  activeOpacity={0.8}
                  onPress={handleWhatsAppShare}
                >
                  <FontAwesome5 name="whatsapp" size={14} color="#fff" />
                  <Text style={styles.whatsappText}>Share via WhatsApp</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalContent: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingTop: hp(2),
    paddingBottom: hp(2),
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: {
    flex: 1,
    marginLeft: wp(3),
  },
  headerRight: {
    width: 44,
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#666',
    fontSize: wp(3.2),
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContainer: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(5),
  },
  section: {
    marginTop: hp(3),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: wp(3),
  },
  usersContainer: {
    gap: hp(1.5),
  },
  userCard: {
    backgroundColor: '#121212',
    borderRadius: 20,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: wp(3),
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  userName: {
    color: '#fff',
    fontSize: wp(4.2),
    fontWeight: '600',
  },
  roleBadge: {
    paddingHorizontal: wp(2),
    paddingVertical: 2,
    borderRadius: 8,
  },
  roleBadgeText: {
    fontSize: wp(2.2),
    fontWeight: 'bold',
  },
  userPhone: {
    color: '#666',
    fontSize: wp(3.2),
    marginTop: 4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  pendingText: {
    color: '#5f9ea0',
    fontSize: wp(2.5),
    fontWeight: '600',
  },
  revokeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(239,68,68,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: hp(5),
    backgroundColor: '#121212',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emptyTitle: {
    color: '#444',
    fontSize: wp(4),
    fontWeight: '600',
    marginTop: hp(1.5),
  },
  emptySubtext: {
    color: '#333',
    fontSize: wp(3),
    marginTop: 4,
  },
  inviteCard: {
    backgroundColor: '#121212',
    borderRadius: 28,
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputWrapper: {
    marginBottom: hp(2.5),
  },
  inputLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: hp(1),
    marginLeft: wp(1),
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  countryCode: {
    color: '#5F9EA0',
    fontSize: wp(4.5),
    fontWeight: 'bold',
    marginRight: wp(2),
  },
  phoneInput: {
    flex: 1,
    color: '#fff',
    fontSize: wp(4),
    padding: 0,
  },
  roleWrapper: {
    marginBottom: hp(2.5),
  },
  roleContainer: {
    flexDirection: 'row',
    gap: wp(3),
  },
  roleBtn: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 18,
    padding: wp(4),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  roleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  roleIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  roleText: {
    color: '#555',
    fontSize: wp(4),
    fontWeight: 'bold',
    marginTop: hp(0.5),
  },
  roleTextActive: {
    color: '#fff',
  },
  roleDesc: {
    color: '#444',
    fontSize: wp(2.5),
    marginTop: 4,
  },
  shareBtn: {
    backgroundColor: '#5F9EA0',
    borderRadius: 18,
    paddingVertical: hp(2.2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    marginTop: hp(1),
    shadowColor: '#5F9EA0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  shareBtnDisabled: {
    backgroundColor: '#333',
    shadowOpacity: 0,
  },
  shareBtnText: {
    color: '#000',
    fontSize: wp(4.5),
    fontWeight: 'bold',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(3),
    marginTop: hp(3),
    padding: wp(4),
    backgroundColor: 'rgba(95, 158, 160,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(95, 158, 160,0.2)',
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(95, 158, 160,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    color: '#666',
    fontSize: wp(3),
    flex: 1,
    lineHeight: wp(4.5),
  },
  whatsappBtn: {
    marginTop: hp(1.5),
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.8),
    borderRadius: 999,
    backgroundColor: '#25D366',
  },
  whatsappText: {
    color: '#fff',
    fontSize: wp(3.2),
    fontWeight: '600',
  },
});

export default ShareScreen;
