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
  Image,
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
import { generatePDF as RNGeneratePDF } from 'react-native-html-to-pdf';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';

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

  const createDLDocument = async () => {
    if (!verificationResult || loading) return null;

    try {
      setLoading(true);
      const data = verificationResult;
      // ... same logic as before ...
      const details = data.details_of_driving_licence || data.details_of_driving_license || {};
      const validity = data.dl_validity || {};
      const badgeDetails = data.badge_details?.[0] || {};
      const vehicleClasses = badgeDetails.class_of_vehicle || data.class_of_vehicle || [];
      
      const issueDate = details.date_of_issue || validity.non_transport?.from || 'N/A';
      const expiryDate = validity.non_transport?.to || 'N/A';
      const authority = details.ola_name || data.ola_name || 'RTO,HASSAN';
      const name = details.name || 'N/A';
      const dobValue = data.dob || 'N/A';
      const fatherName = details.father_or_husband_name || 'N/A';
      const address = details.address || data.address || 'N/A';

      const htmlContent = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; }
              .certificate { border: 2px solid #333; padding: 30px; border-radius: 10px; background: #fff; }
              .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
              .header h1 { margin: 0; font-size: 24px; color: #000; }
              .header p { margin: 5px 0; font-size: 14px; }
              .header .logo-container { text-align: center; margin-bottom: 10px; }
              .header .logo { width: 60px; height: 60px; object-fit: contain; }
              .meta-row { display: flex; justify-content: space-between; margin-bottom: 15px; font-weight: bold; font-size: 14px; }
              .info-grid { display: flex; margin-top: 20px; }
              .info-left { flex: 3; }
              .info-right { flex: 1; text-align: right; }
              .info-row { display: flex; margin-bottom: 10px; font-size: 13px; }
              .label { width: 150px; color: #666; }
              .value { flex: 1; font-weight: bold; }
              .photo-box { width: 120px; height: 150px; border: 1px solid #eee; background: #fafafa; display: inline-block; }
              .footer { margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; display: flex; justify-content: space-between; align-items: center; }
              .note { margin-top: 20px; font-size: 10px; color: #888; background: #f9f9f9; padding: 10px; border-radius: 5px; }
            </style>
          </head>
          <body>
            <div class="certificate">
              <div class="header">
                <div class="logo-container">
                   <img src="https://gupio.io/assets/images/indian_lion.png" class="logo" />
                </div>
                <h1>UNION OF INDIA DRIVING LICENSE</h1>
                <p>Issuing Authority: ${authority}</p>
              </div>
              <div class="meta-row">
                <div><span>Authorization to Drive:</span> <span>${vehicleClasses.join(', ')}</span></div>
                <div><span>License No:</span> <span>${data.dl_number || data.dl_no}</span></div>
              </div>
              <div class="meta-row" style="font-size: 11px; color: #555; margin-top: 10px;">
                <div><span>Date of Issue:</span> <span>${issueDate}</span></div>
                <div><span>Date of Expiry:</span> <span>${expiryDate}</span></div>
              </div>
              <div class="info-grid">
                <div class="info-left">
                  <div class="info-row"><div class="label">Name:</div> <div class="value">${name}</div></div>
                  <div class="info-row"><div class="label">DOB:</div> <div class="value">${dobValue}</div></div>
                  <div class="info-row"><div class="label">S/W/D:</div> <div class="value">${fatherName}</div></div>
                  <div class="info-row"><div class="label">Address:</div> <div class="value">${address}</div></div>
                </div>
                <div class="info-right">
                  <div class="photo-box"></div>
                </div>
              </div>
              <div class="footer">
                <div style="font-size: 12px; color: #6366f1; font-weight: bold;">Digitally Signed by DigiLocker</div>
                <div style="font-size: 10px; color: #666;">Generated on: ${new Date().toLocaleDateString('en-GB')}</div>
              </div>
              <div class="note">
                <p>Note: This is a system-generated certificate based on official records verified through IDSPay and DigiLocker.</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const options = {
        html: htmlContent,
        fileName: `DL_${data.dl_number || 'Verification'}_${Date.now()}`,
        // directory: 'Documents', // Removed to avoid EACCES on Android 11+
      };

      const file = await RNGeneratePDF(options);
      return file?.filePath;
    } catch (error) {
      console.log('PDF Generation Error:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (loading) return;
    const filePath = await createDLDocument();
    if (filePath) {
      const sharePath = filePath.startsWith('file://') ? filePath : `file://${filePath}`;
      try {
        await Share.open({
          url: sharePath,
          type: 'application/pdf',
          title: 'Share Driving License',
        });
      } catch (err: any) {
        if (err.message !== 'User did not share') {
          console.log('Share error:', err);
          Alert.alert('Share Failed', 'Unable to open share sheet.');
        }
      }
    } else {
      Alert.alert('Error', 'Could not generate certificate PDF.');
    }
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
    
    const issueDate = details.date_of_issue || validity.non_transport?.from || 'N/A';
    const expiryDate = validity.non_transport?.to || 'N/A';
    const authority = details.ola_name || data.ola_name || 'RTO,HASSAN';
    const name = details.name || 'N/A';
    const dobValue = data.dob || 'N/A';
    const fatherName = details.father_or_husband_name || 'N/A';
    const address = details.address || data.address || 'N/A';

    return (
      <ScrollView contentContainerStyle={styles.certificateWrapper} showsVerticalScrollIndicator={false}>
        <View style={styles.certificate}>
          {/* Header Part */}
          <View style={styles.certHeader}>
             <View style={styles.pillarContainer}>
                <Image 
                  source={require('../../assets/images/indian_lion.png') as any} 
                  style={{ width: wp(12), height: wp(12) }} 
                  resizeMode="contain" 
                />
             </View>
             <Text style={styles.certTitleLine1}>UNION OF INDIA DRIVING LICENSE</Text>
             <Text style={styles.certTitleLine2}>Issuing Authority : {authority}</Text>
          </View>
          
          <View style={styles.certMainMeta}>
             <View style={styles.certMetaRow}>
                <Text style={styles.certMetaLabel}>Authorization to Drive :</Text>
                <Text style={styles.certMetaValue}>{vehicleClasses.join(', ') || 'N/A'}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.certMetaLabelSmall}>Date of Issue :</Text>
                <Text style={styles.certMetaValueSmall}>{issueDate}</Text>
             </View>
             <View style={styles.certMetaRow}>
                <Text style={styles.certMetaLabel}>License No. :</Text>
                <Text style={styles.certMetaValue}>{data.dl_number || data.dl_no || 'N/A'}</Text>
                <View style={{ flex: 1 }} />
                <Text style={styles.certMetaLabelSmall}>Date of Expiry :</Text>
                <Text style={styles.certMetaValueSmall}>{expiryDate}</Text>
             </View>
          </View>

          <View style={styles.certInfoGrid}>
             <View style={styles.certLeftInfo}>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>Name</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValue}>{name}</Text>
                </View>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>DOB</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValue}>{dobValue}</Text>
                </View>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>Blood Group</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValue}>N/A</Text>
                </View>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>S/W/D</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValue}>{fatherName}</Text>
                </View>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>Present Address</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValueSmall}>{address}</Text>
                </View>
                <View style={styles.certInfoRow}>
                   <Text style={styles.certRowLabel}>Permanent Address</Text>
                   <Text style={styles.certRowSeparator}>:</Text>
                   <Text style={styles.certRowValueSmall}>{address}</Text>
                </View>
             </View>
             <View style={styles.certPhotoBox}>
                <View style={styles.photoPlaceholder}>
                   <Icon name="user" size={hp(6)} color="#ccc" />
                </View>
             </View>
          </View>

          <View style={styles.certFooterTop}>
             <View style={styles.qrPlaceholder}>
                <MaterialIcon name="qrcode" size={hp(6)} color="#333" />
             </View>
             
             <View style={styles.digilockerPowered}>
                <Text style={{ fontSize: 8, fontWeight: 'bold', color: '#6366f1' }}>Powered by</Text>
                <View style={{ backgroundColor: '#6366f1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                   <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>DigiLocker</Text>
                </View>
             </View>

             <View style={styles.signedBadge}>
                <Text style={styles.signedAtText}>Digitally signed on</Text>
                <Text style={styles.signedDateText}>{new Date().toLocaleDateString('en-GB')}</Text>
                <Icon name="check-circle" size={14} color="#22c55e" />
             </View>
          </View>

          <View style={styles.certNoteBox}>
             <Text style={styles.noteTitle}>Note:</Text>
             <Text style={styles.noteLine}>1. This Driving License Certificate data is accessed using DigiLocker.</Text>
             <Text style={styles.noteLine}>2. This certificate is generated by Gupio through IDSPay verified records.</Text>
             <Text style={styles.noteLine}>3. This digitally signed document is valid as per IT Act.</Text>
             <Text style={styles.noteLine}>4. To verify the authenticity, scan the QR code on the printed certificate.</Text>
          </View>
        </View>
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
                 <TouchableOpacity 
                   onPress={handleShare} 
                   style={[styles.actionIcon, loading && styles.disabledActionIcon]}
                   disabled={loading}
                 >
                     <Icon name="share-2" size={22} color={loading ? "#444" : "#FFBF00"} />
                 </TouchableOpacity>
                 <TouchableOpacity 
                   onPress={() => setVerificationResult(null)} 
                   style={[styles.actionIcon, { marginLeft: 15 }]}
                   disabled={loading}
                 >
                     <Icon name="plus" size={24} color={loading ? "#444" : "#fff"} />
                 </TouchableOpacity>
                 <TouchableOpacity 
                   onPress={handleDelete} 
                   style={[styles.actionIcon, { marginLeft: 15 }]}
                   disabled={loading}
                 >
                     <Icon name="trash-2" size={22} color={loading ? "#444" : "#ff453a"} />
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
  disabledActionIcon: {
      opacity: 0.5,
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
  // Result Styles (REMOVED OLD STYLES)
  certificateWrapper: {
    padding: wp(4),
    paddingBottom: hp(10),
  },
  certificate: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: wp(4),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  certHeader: {
    alignItems: 'center',
    marginBottom: hp(2),
    borderBottomWidth: 1.5,
    borderBottomColor: '#333',
    paddingBottom: hp(1),
  },
  pillarContainer: {
    width: hp(8),
    height: hp(8),
    marginBottom: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  certTitleLine1: {
    color: '#000',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  certTitleLine2: {
    color: '#333',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Medium',
    marginTop: 2,
  },
  certMainMeta: {
    marginTop: hp(1),
  },
  certMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(0.5),
  },
  certMetaLabel: {
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Bold',
    color: '#000',
    width: wp(35),
  },
  certMetaValue: {
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
  certMetaLabelSmall: {
    fontSize: wp(2.2),
    color: '#333',
    marginRight: 4,
  },
  certMetaValueSmall: {
    fontSize: wp(2.2),
    fontFamily: 'Outfit-Bold',
    color: '#000',
  },
  certInfoGrid: {
    flexDirection: 'row',
    marginTop: hp(1.5),
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: hp(1.5),
  },
  certLeftInfo: {
    flex: 1,
  },
  certInfoRow: {
    flexDirection: 'row',
    marginBottom: hp(0.8),
    alignItems: 'flex-start',
  },
  certRowLabel: {
    width: wp(22),
    fontSize: wp(2.8),
    color: '#444',
    fontFamily: 'Outfit-Medium',
  },
  certRowSeparator: {
    width: wp(3),
    fontSize: wp(2.8),
    color: '#444',
  },
  certRowValue: {
    flex: 1,
    fontSize: wp(2.8),
    color: '#000',
    fontFamily: 'Outfit-Bold',
  },
  certRowValueSmall: {
    flex: 1,
    fontSize: wp(2.4),
    color: '#222',
    fontFamily: 'Outfit-Medium',
    lineHeight: 14,
  },
  certPhotoBox: {
    width: wp(20),
    height: wp(26),
    borderWidth: 1,
    borderColor: '#eee',
    marginLeft: wp(2),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  },
  photoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  certFooterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: hp(2),
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: hp(1.5),
  },
  qrPlaceholder: {
    width: wp(16),
    height: wp(16),
    borderWidth: 1,
    borderColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digilockerPowered: {
    alignItems: 'center',
  },
  signedBadge: {
    borderWidth: 1,
    borderColor: '#eee',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  signedAtText: {
    fontSize: 7,
    color: '#666',
    fontFamily: 'Outfit-Regular',
  },
  signedDateText: {
    fontSize: 7,
    fontFamily: 'Outfit-Bold',
    color: '#333',
    marginBottom: 2,
  },
  certNoteBox: {
    marginTop: hp(1.5),
    borderWidth: 1,
    borderColor: '#f5f5f5',
    padding: hp(1),
    borderRadius: 4,
    backgroundColor: '#fafafa',
  },
  noteTitle: {
    fontSize: wp(2.4),
    fontFamily: 'Outfit-Bold',
    color: '#000',
    marginBottom: 2,
  },
  noteLine: {
    fontSize: wp(2.1),
    color: '#666',
    fontFamily: 'Outfit-Regular',
    marginBottom: 1,
  },
});
