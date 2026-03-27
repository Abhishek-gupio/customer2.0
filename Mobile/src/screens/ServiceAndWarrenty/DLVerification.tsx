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
import { useNavigation } from '../../lib/react-navigation-native';
import { api } from '../../services/api';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

export default function DLVerification() {
  const navigation = useNavigation();
  const [dlNumber, setDlNumber] = useState('');
  const [dob, setDob] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  useEffect(() => {
    fetchExistingDL();
  }, []);

  const fetchExistingDL = async () => {
    try {
      const resp: any = await api.get('/v1/documents/get-dl');
      if (resp.success && resp.data) {
        setVerificationResult(resp.data);
      }
    } catch (e) {
      console.error("Error fetching existing DL", e);
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleDelete = () => {
    Alert.alert(
      'Remove License',
      'Are you sure you want to remove this driving license record?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/v1/documents/delete-dl');
              setVerificationResult(null);
              setDlNumber('');
              setDob('');
            } catch (e) {
              Alert.alert('Error', 'Failed to delete license');
            }
          }
        }
      ]
    );
  };

  const handleVerify = async () => {
    if (!dlNumber || !dob) {
      Alert.alert('Missing Info', 'Please enter both DL Number and Date of Birth.');
      return;
    }

    setLoading(true);
    try {
      // Clean dlNumber from spaces
      const cleanDl = dlNumber.replace(/\s/g, '');
      const response: any = await api.post('/v1/documents/verify-dl', {
        dlNumber: cleanDl,
        dob,
      });
      
      if (response.success) {
        setVerificationResult(response.data);
      }
    } catch (error: any) {
      console.error('DL Verification Error:', error);
      Alert.alert('Verification Failed', error.message || 'Unable to verify DL. Please check the details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!verificationResult) return null;

    const data = verificationResult;
    // Map details carefully (sometimes keys might differ slightly)
    const details = data.details_of_driving_licence || data.details_of_driving_license || {};
    const validity = data.dl_validity || {};
    const badgeDetails = data.badge_details?.[0] || {};
    const vehicleClasses = badgeDetails.class_of_vehicle || data.class_of_vehicle || [];

    return (
      <ScrollView contentContainerStyle={styles.resultScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
             <Icon name="check" size={wp(8)} color="#000" />
          </View>
          <Text style={styles.verifiedTitle}>DL Verified Successfully</Text>
          <Text style={styles.verifiedSubtitle}>Current Status: <Text style={{ color: '#22c55e', fontFamily: 'Outfit-Bold' }}>{details.status || 'ACTIVE'}</Text></Text>
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.cardSectionTitle}>PERSONAL DETAILS</Text>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Full Name</Text>
             <Text style={styles.detailValue}>{details.name || 'N/A'}</Text>
          </View>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Date of Birth</Text>
             <Text style={styles.detailValue}>{data.dob || 'N/A'}</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardSectionTitle}>LICENSE DETAILS</Text>
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Driving License Number</Text>
             <Text style={styles.detailValue}>{data.dl_number || data.dl_no || 'N/A'}</Text>
          </View>
          <View style={styles.detailItemRow}>
             <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Date of Issue</Text>
                <Text style={styles.detailValue}>{details.date_of_issue || 'N/A'}</Text>
             </View>
             <View style={{ flex: 1 }}>
                <Text style={styles.detailLabel}>Original LA</Text>
                <Text style={styles.detailValue}>{details.ola_name || data.ola_name || 'N/A'}</Text>
             </View>
          </View>
          <View style={[styles.detailItem, { marginTop: hp(2) }]}>
             <Text style={styles.detailLabel}>Reference No</Text>
             <Text style={styles.detailValue}>{data.reference_no || details.last_transacted_at || 'N/A'}</Text>
          </View>
          
          <View style={styles.detailItem}>
             <Text style={styles.detailLabel}>Vehicle Classes</Text>
             <View style={styles.badgeRow}>
               {vehicleClasses.length > 0 ? vehicleClasses.map((cls: string) => (
                 <View key={cls} style={styles.badgePill}>
                   <Text style={styles.badgeText}>{cls}</Text>
                 </View>
               )) : <Text style={styles.detailValue}>N/A</Text>}
             </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.cardSectionTitle}>VALIDITY INFORMATION</Text>
          <View style={styles.validityRow}>
            <View style={styles.validityBox}>
               <Text style={styles.validityLabel}>Non-Transport</Text>
               <Text style={styles.validityDate}>{validity.non_transport?.from || 'N/A'} - {validity.non_transport?.to || 'N/A'}</Text>
            </View>
          </View>
          
          <View style={[styles.validityRow, { marginTop: hp(1.5) }]}>
            <View style={styles.validityBox}>
               <Text style={styles.validityLabel}>Transport</Text>
               <Text style={styles.validityDate}>{validity.transport?.from || 'N/A'} - {validity.transport?.to || validity.transport?.to || 'N/A'}</Text>
            </View>
          </View>

          <View style={styles.divider} />
          
          <Text style={styles.cardSectionTitle}>REGISTERED ADDRESS</Text>
          <Text style={styles.addressText}>{details.address || data.address || 'N/A'}</Text>
        </View>

        <TouchableOpacity 
          style={styles.doneBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  if (checkingExisting) {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.loaderCenter}>
                <ActivityIndicator size="large" color="#FFBF00" />
            </View>
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
          <Text style={styles.headerTitle}>DL Verification</Text>
          <View style={styles.headerActions}>
            {verificationResult ? (
                <>
                <TouchableOpacity onPress={() => setVerificationResult(null)} style={styles.actionIcon}>
                    <Icon name="plus" size={24} color="#FFBF00" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} style={[styles.actionIcon, { marginLeft: 15 }]}>
                    <Icon name="trash-2" size={22} color="#ff453a" />
                </TouchableOpacity>
                </>
            ) : null}
          </View>
        </View>

        {verificationResult ? renderResult() : (
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <MaterialIcon name="card-account-details-outline" size={wp(12)} color="#FFBF00" />
              </View>
            </View>

            <Text style={styles.title}>Verify Driving License</Text>
            <Text style={styles.subtitle}>
              Enter your Driving License details to fetch official records.
            </Text>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>DL Number</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="credit-card" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. MH01 20120123456"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={dlNumber}
                    onChangeText={(t) => setDlNumber(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date of Birth</Text>
                <View style={styles.inputWrapper}>
                  <Icon name="calendar" size={20} color="#666" style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="DD-MM-YYYY"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={dob}
                    onChangeText={setDob}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.verifyButton,
                  { opacity: dlNumber.length > 5 && !loading ? 1 : 0.6 }
                ]}
                disabled={dlNumber.length <= 5 || loading}
                onPress={handleVerify}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.verifyButtonText}>Verify Now</Text>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.infoCard}>
              <Icon name="info" size={18} color="#FFBF00" />
              <Text style={styles.infoText}>
                IDSPay official verification ensures data privacy and government-sourced accuracy.
              </Text>
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
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
    marginLeft: 10,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionIcon: {
      padding: 5,
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
  detailItemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
  badgeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 4,
  },
  badgePill: {
      backgroundColor: 'rgba(255, 191, 0, 0.1)',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: 'rgba(255, 191, 0, 0.2)',
  },
  badgeText: {
      color: '#FFBF00',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(3),
  },
  validityRow: {
      flexDirection: 'row',
      gap: 12,
  },
  validityBox: {
      flex: 1,
      backgroundColor: 'rgba(255,255,255,0.03)',
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.05)',
  },
  validityLabel: {
      color: 'rgba(255,255,255,0.4)',
      fontFamily: 'Outfit-Bold',
      fontSize: wp(2.8),
      marginBottom: 4,
  },
  validityDate: {
      color: '#fff',
      fontFamily: 'Outfit-Medium',
      fontSize: wp(3.2),
  },
  addressText: {
      color: '#fff',
      fontFamily: 'Outfit-Regular',
      fontSize: wp(3.5),
      lineHeight: 20,
      opacity: 0.8,
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
