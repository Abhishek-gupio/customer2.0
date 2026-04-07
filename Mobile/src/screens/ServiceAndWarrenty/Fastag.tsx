import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import StatusModal from '../../components/common/Modals/StatusModal';
import ConfirmModal from '../../components/common/Modals/ConfirmModal';
import { useNavigation } from '../../lib/react-navigation-native';
import { api } from '../../services/api';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function Fastag() {
  const navigation = useNavigation();
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });
  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };

  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'default' as 'default' | 'logout' | 'delete',
    confirmText: 'Confirm',
    onConfirm: () => { }
  });

  useEffect(() => {
    fetchExistingFastag();
  }, []);

  const fetchExistingFastag = async () => {
    try {
      const resp: any = await api.get('/v1/documents/get-fastag');
      if (resp && resp.success && resp.data) {
        setVerificationResult(resp.data);
      }
    } catch (err: any) {
      // Supress console error during initial fetch if data doesn't exist yet
      if (__DEV__ && !err.message?.includes('404')) {
         console.log("Existing Fastag not found or error:", err.message || err);
      }
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleBack = () => navigation.goBack();

  const handleDelete = async () => {
    setConfirmModal({
      visible: true,
      title: 'Delete Verification',
      message: 'Are you sure you want to delete this verified Fastag profile?',
      type: 'delete',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await api.delete('/v1/documents/delete-fastag');
          setVerificationResult(null);
          setAccountNumber('');
          setIfscCode('');
          showStatus('Deleted', 'Fastag profile removed successfully');
        } catch (error) {
          showStatus('Error', 'Failed to delete Fastag profile', 'error');
        }
      }
    });
  };

  const handleVerify = async () => {
    if (!accountNumber || !ifscCode) {
      showStatus('Missing Info', 'Please enter both Account Number and IFSC Code', 'error');
      return;
    }

    setLoading(true);
    try {
      const response: any = await api.post('/v1/documents/verify-fastag', {
        creditorAccountId: accountNumber,
        ifscCode: ifscCode.toUpperCase(),
      });

      if (response.success) {
        setVerificationResult(response.data);
        showStatus('Success', 'Account verified successfully');
      } else {
        showStatus('Verification Failed', response.message || 'Unable to verify account', 'error');
      }
    } catch (error: any) {
      showStatus('Verification Failed', error.message || 'System error during verification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!verificationResult) return null;

    const root = verificationResult.data?.beneValidationResp || verificationResult;
    const data = root.resourceData || {};
    const meta = root.metaData || {};

    return (
      <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
             <Icon name="check" size={wp(8)} color="#000" />
          </View>
          <Text style={styles.verifiedTitle}>Fastag Account Verified</Text>
          <Text style={styles.verifiedSubtitle}>
            Status: <Text style={{ color: '#22c55e', fontFamily: 'Outfit-Bold' }}>{meta.status || 'SUCCESS'}</Text>
          </Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.cardSectionTitle}>BENEFICIARY DETAILS</Text>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Beneficiary Name</Text>
             <Text style={styles.detailValue}>{data.creditorName || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Account Number</Text>
             <Text style={styles.detailValue}>{data.creditorAccountId || accountNumber}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardSectionTitle}>TRANSACTION LOGS</Text>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Transaction ID</Text>
             <Text style={styles.detailValue}>{data.transactionId || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Reference Number</Text>
             <Text style={styles.detailValue}>{data.transactionReferenceNumber || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Time</Text>
             <Text style={styles.detailValue}>{data.transactionTime || meta.time || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.verifiedBadge}>
            <MaterialIcon name="shield-check" size={20} color="#FFBF00" />
            <Text style={styles.badgeText}>Verified via IDSPay Pennyless V2</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.doneBtn}
          onPress={() => setVerificationResult(null)}
        >
          <Text style={styles.doneBtnText}>Verify Another</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  if (checkingExisting) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner visible={true} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Icon name="arrow-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Fastag Services</Text>
          
          <View style={styles.headerRight}>
            {verificationResult && (
              <>
                <TouchableOpacity onPress={() => setVerificationResult(null)} style={styles.headerIconBtn}>
                  <Icon name="plus-circle" size={22} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={styles.headerIconBtn}>
                  <Icon name="trash-2" size={20} color="#ff4444" />
                </TouchableOpacity>
              </>
            )}
            {!verificationResult && (
              <View style={{ width: 40 }} />
            )}
          </View>
        </View>

        {verificationResult ? renderResult() : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <MaterialIcon name="bank-check" size={wp(12)} color="#FFBF00" />
              </View>
            </View>

            <Text style={styles.title}>Bank Account Verification</Text>
            <Text style={styles.subtitle}>
              Verify your linked bank account for seamless Fastag payments.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Account Number</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="credit-card" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter Bank Account Number"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>IFSC Code</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="hash" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Bank IFSC Code (e.g. SBIN0001234)"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={ifscCode}
                    onChangeText={setIfscCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  { opacity: accountNumber.length > 5 && ifscCode.length === 11 && !loading ? 1 : 0.6 }
                ]}
                disabled={accountNumber.length <= 5 || ifscCode.length !== 11 || loading}
                onPress={handleVerify}
              >
                <Text style={styles.verifyButtonText}>Verify Account</Text>
              </TouchableOpacity>
            </View>
            <LoadingSpinner visible={loading} />

            <View style={styles.infoCard}>
              <Icon name="shield" size={18} color="#FFBF00" />
              <Text style={styles.infoText}>
                Secure pennyless verification ensures no money is deducted from your account.
              </Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type}
        confirmText={confirmModal.confirmText}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontFamily: 'Outfit-Bold',
  },
  headerRight: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: wp(8),
    paddingTop: hp(4),
    paddingBottom: hp(4),
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: hp(3),
  },
  iconCircle: {
    width: wp(24),
    height: wp(24),
    borderRadius: wp(12),
    backgroundColor: 'rgba(255, 191, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 191, 0, 0.2)',
  },
  title: {
    color: '#fff',
    fontSize: wp(6),
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    marginBottom: hp(1),
  },
  subtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: wp(3.8),
    fontFamily: 'Outfit-Regular',
    textAlign: 'center',
    marginBottom: hp(5),
  },
  form: {
    gap: hp(3),
  },
  inputGroup: {
    gap: hp(1),
  },
  inputLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Medium',
    marginLeft: wp(1),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: wp(4),
    height: hp(7),
  },
  inputIcon: {
    marginRight: wp(3),
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Medium',
  },
  verifyButton: {
    backgroundColor: '#FFBF00',
    height: hp(7.5),
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(4),
  },
  verifyButtonText: {
    color: '#000',
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 191, 0, 0.05)',
    padding: wp(4),
    borderRadius: 16,
    marginTop: hp(6),
    gap: wp(3),
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    color: 'rgba(255, 191, 0, 0.8)',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
    lineHeight: 18,
  },
  // Result Styles
  resultScroll: {
    paddingHorizontal: wp(6),
    paddingBottom: hp(4),
  },
  successHeader: {
    alignItems: 'center',
    paddingVertical: hp(3),
  },
  checkCircle: {
      width: wp(16),
      height: wp(16),
      borderRadius: wp(8),
      backgroundColor: '#FFBF00',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: hp(2),
  },
  verifiedTitle: {
      color: '#fff',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(5.5),
      marginBottom: 4,
  },
  verifiedSubtitle: {
      color: 'rgba(255,255,255,0.5)',
      fontFamily: 'Outfit-Regular',
      fontSize: wp(3.8),
  },
  resultCard: {
      backgroundColor: '#111',
      borderRadius: 24,
      padding: wp(6),
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
  },
  cardSectionTitle: {
      color: 'rgba(255, 191, 0, 0.8)',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(3.2),
      textTransform: 'uppercase',
      letterSpacing: 1.5,
      marginBottom: hp(2),
  },
  detailItem: {
      marginBottom: hp(2),
  },
  detailLabel: {
      color: 'rgba(255,255,255,0.4)',
      fontFamily: 'Outfit-Regular',
      fontSize: wp(3.2),
      marginBottom: 2,
  },
  detailValue: {
      color: '#fff',
      fontFamily: 'Outfit-Medium',
      fontSize: wp(4),
  },
  divider: {
      height: 1,
      backgroundColor: 'rgba(255,255,255,0.05)',
      marginVertical: hp(2),
  },
  verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255, 191, 0, 0.05)',
      padding: 12,
      borderRadius: 12,
  },
  badgeText: {
      color: '#FFBF00',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(3),
  },
  doneBtn: {
      backgroundColor: '#fff',
      height: hp(7),
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: hp(4),
  },
  doneBtnText: {
      color: '#000',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(4),
  },
});
