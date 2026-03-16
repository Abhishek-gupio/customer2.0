import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Alert,
  PermissionsAndroid,
  TouchableWithoutFeedback,
  Share as RNShare,
} from 'react-native';
import { generatePDF as convertToPDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  FileText,
  ArrowRight,
  Plus,
  Camera,
  Image as ImageIcon,
  FileUp,
  X,
  Download,
  Share2,
  Trash2,
} from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes } from '@react-native-documents/picker';
import BackButton from '../../components/BackButton';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import type { RootState } from '../../store';
import { fetchDocuments, addDocumentFromResponse, toDocItem, removeDocumentAsync } from '../../store/slices/documentsSlice';
import { COLORS, INDPlate } from '../../components/Vehicles/VehicleUI';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { uploadDocument } from '../../services/documentService';

const { width } = Dimensions.get('window');
const CarImage = require('../../assets/images/car_vehicle_demo.png');
const BikeImage = require('../../assets/images/bike.png');

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const dispatch = useAppDispatch();
  const { documents, loading } = useAppSelector((state: RootState) => state.documents);
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    dispatch(fetchDocuments());
    loadPrimaryVehicle();
  }, [dispatch]);

  const loadPrimaryVehicle = async () => {
    try {
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
      setPrimaryVehicle(primary || null);
    } catch {
      setPrimaryVehicle(null);
    }
  };

  const requestAndroidPermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const camera = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'App needs camera access to capture documents',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        },
      );
      const storage = Platform.Version >= 33
        ? await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: 'Photo Library Permission',
            message: 'App needs photo library access to select documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        )
        : await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs storage access to select documents',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
      return (
        camera === PermissionsAndroid.RESULTS.GRANTED &&
        storage === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  };

  const handlePickDocument = async (type: string) => {
    try {
      const res = await pickDocument({
        type: [docTypes.pdf, docTypes.images],
        allowMultiSelection: false,
      });
      if (res?.[0]) {
        performUpload(type, res[0].uri, res[0].name || `file_${Date.now()}`, res[0].type || 'application/octet-stream');
      }
    } catch (e: any) {
      if (e?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Alert.alert('Error', 'Could not pick file');
      }
    }
  };

  const handlePickImage = async (type: string) => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Camera and photo library access are required.');
        return;
      }
    }
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        performUpload(type, asset.uri!, asset.fileName || `photo_${Date.now()}.jpg`, asset.type || 'image/jpeg');
      }
    } catch {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const handleTakePhoto = async (type: string) => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
    }
    try {
      const res = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        performUpload(type, asset.uri!, asset.fileName || `camera_${Date.now()}.jpg`, asset.type || 'image/jpeg');
      }
    } catch {
      Alert.alert('Error', 'Could not take photo');
    }
  };

  const performUpload = async (type: string, uri: string, name: string, mime: string) => {
    setIsUploading(true);
    try {
      const result = await uploadDocument({
        type: type,
        fileUri: uri,
        fileName: name,
        mimeType: mime,
        documentNumber: primaryVehicle?.registrationNumber,
      });

      dispatch(addDocumentFromResponse(toDocItem(result)));
      Alert.alert('Success', `${type} uploaded successfully`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Something went wrong');
    } finally {
      setIsUploading(false);
    }
  };

  const createPDFFromImage = async (doc: any) => {
    try {
      const options = {
        html: `
          <html>
            <body style="margin:0;padding:0;background-color:white;display:flex;justify-content:center;align-items:center;width:100%;height:100%;">
              <img src="${doc.imageUri}" style="max-width:100%;max-height:100%;object-fit:contain;" />
            </body>
          </html>
        `,
        fileName: `${doc.type.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
        directory: 'Documents',
      };
      const file = await convertToPDF(options);
      return file.filePath;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error('Failed to generate PDF');
    }
  };

  const handleShareDoc = async (doc: any) => {
    if (!doc?.imageUri) return;
    try {
      setIsUploading(true); // Reuse as a general "processing" state or add a new one
      const pdfPath = await createPDFFromImage(doc);
      setIsUploading(false);
      
      await RNShareCustom.open({
        url: `file://${pdfPath}`,
        type: 'application/pdf',
        title: `Share ${doc.type}`,
        message: `Sending ${doc.type} for vehicle ${primaryVehicle?.registrationNumber}`,
      });
    } catch (error: any) {
      setIsUploading(false);
      if (error?.message !== 'User did not share') {
        Alert.alert('Error', 'Could not share document as PDF');
      }
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    if (!doc?.imageUri) return;
    try {
      setIsUploading(true);

      // Check permissions for Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'App needs access to your storage to download the PDF',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED && Platform.Version < 33) {
           // For Android 13+ (API 33), WRITE_EXTERNAL_STORAGE is not used for media/docs
           // But let's log and proceed or handle based on version if needed.
        }
      }

      const tempPdfPath = await createPDFFromImage(doc);
      
      const fileName = tempPdfPath.split('/').pop();
      let finalPath = tempPdfPath;

      if (Platform.OS === 'android') {
        const downloadDir = RNFS.DownloadDirectoryPath;
        finalPath = `${downloadDir}/${fileName}`;
        
        // Use copy instead of move to avoid permission issues with different volumes/mounts
        await RNFS.copyFile(tempPdfPath, finalPath);
        // Delete the temp file from library cache
        await RNFS.unlink(tempPdfPath);
      } else if (Platform.OS === 'ios') {
        // iOS handled differently usually via UIDocumentPicker or just internal docs.
      }

      setIsUploading(false);
      Alert.alert('Success', `Document downloaded successfully! You can find it in your Downloads folder as ${fileName}`);
    } catch (error: any) {
      setIsUploading(false);
      console.error('Download Error:', error);
      Alert.alert('Error', error.message || 'Could not download document as PDF');
    }
  };

  const getDocByType = (type: string) => {
    return documents.find(d => d.type === type);
  };

  const requiredDocTypes = ['RC', 'Insurance', 'PUC', 'DL'];
  const uploadedDocsCount = documents.filter(d => requiredDocTypes.includes(d.type)).length;
  const MAX_DOCS = 4;
  const totalDocs = Math.min(uploadedDocsCount, MAX_DOCS);
  const progressPercent = Math.round((totalDocs / MAX_DOCS) * 100);

  const handleDeleteDoc = async (id: string, type: string) => {
    Alert.alert(
      'Delete Document',
      `Are you sure you want to delete your ${type}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await dispatch(removeDocumentAsync(id)).unwrap();
              Alert.alert('Success', `${type} deleted successfully`);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete');
            }
          }
        }
      ]
    );
  };

  const DocumentSlot = ({ label, type }: { label: string; type: string }) => {
    const doc = getDocByType(type);
    return (
      <View style={styles.slotContainer}>
        <TouchableOpacity
          style={styles.slotBox}
          onPress={() => {
            if (doc) {
              setViewingDoc(doc);
              setShowViewerModal(true);
            } else {
              setSelectedDocType(type);
              setShowSourceModal(true);
            }
          }}
        >
          {doc ? (
            <View style={styles.imageWrapper}>
              <Image 
                source={{ uri: doc.imageUri }} 
                style={styles.slotImage} 
                resizeMode="cover"
                onError={(e) => console.log('Image Load Error:', e.nativeEvent.error)}
              />
            </View>
          ) : (
            <Plus size={24} color="#333" />
          )}
        </TouchableOpacity>
        <Text style={styles.slotLabel}>{label}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>glovebox</Text>
          {totalDocs > 0 ? (
            <View style={styles.progressHeaderRow}>
               <Text style={styles.progressTextLeft}>{totalDocs} out of {MAX_DOCS} documents stored</Text>
               <Text style={styles.progressTextRight}>{progressPercent}% COMPLETE</Text>
            </View>
          ) : (
            <Text style={styles.headerSubtitle}>one place for all your vehicle documents</Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>
      
      {totalDocs > 0 && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.trustBadge}>
          <ShieldCheck size={14} color="#00C853" />
          <Text style={styles.trustText}>100% safe and secure</Text>
        </View>

        {/* DigiLocker Banner */}
        <View style={styles.digiBanner}>
          <View style={styles.digiTopRow}>
            <View style={styles.digiTextSection}>
              {totalDocs > 0 ? (
                 <Text style={styles.digiTitle}>add your official driving license to your glovebox</Text>
              ) : (
                 <Text style={styles.digiTitle}>accepted as official documents by traffic police everywhere</Text>
              )}
            </View>
            <View style={styles.digiGraphic}>
              <View style={styles.graphicRect}>
                <FileText size={32} color="#DDD" />
                <View style={styles.alertCircle}>
                  <Text style={styles.alertText}>!</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.dotRow}>
            <View style={[styles.dot, styles.dotActive]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <TouchableOpacity style={styles.digiBtn}>
            <View style={styles.digiBtnContent}>
              <View style={styles.digiLogoPlaceholder}>
                <FileText size={16} color="#FFF" />
              </View>
              <Text style={styles.digiBtnText}>Link to Digilocker</Text>
            </View>
            <ArrowRight size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Your Vehicle Documents */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>YOUR VEHICLE DOCUMENTS</Text>
        </View>

        {primaryVehicle && (
          <View style={styles.vehicleSummaryCard}>
            <View style={styles.vehicleIconCircle}>
              <Image
                source={(primaryVehicle.vehicleType === 'BIKE' ? BikeImage : CarImage) as any}
                style={styles.vehicleThumb}
                resizeMode="contain"
              />
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>{primaryVehicle.model?.toUpperCase() || 'SXL'}</Text>
              <View style={styles.plateWrap}>
                <INDPlate number={primaryVehicle.registrationNumber} />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('VehicleDetails', { vehicleId: primaryVehicle.id })}
              style={styles.viewDetailsBtn}
            >
              <Text style={styles.viewDetailsText}>View details</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.gloveboxGrid}>
          <DocumentSlot label="reg certificate" type="RC" />
          <DocumentSlot label="insurance policy" type="Insurance" />
          <DocumentSlot label="puc certificate" type="PUC" />
        </View>

        {/* Your Personal Documents */}
        <View style={[styles.sectionHeaderRow, { marginTop: 40 }]}>
          <Text style={styles.sectionTitle}>YOUR PERSONAL DOCUMENTS</Text>
        </View>

        <View style={styles.personalGrid}>
          <View style={[styles.slotContainer, { width: '100%', alignItems: 'flex-start' }]}>
            <TouchableOpacity
              style={[styles.slotBox, { width: '30%', aspectRatio: 1.2 }]}
              onPress={() => {
                const doc = getDocByType('DL');
                if (doc) {
                   setViewingDoc(doc);
                   setShowViewerModal(true);
                } else {
                   setSelectedDocType('DL');
                   setShowSourceModal(true);
                }
              }}
            >
              {getDocByType('DL') ? (
                <View style={styles.imageWrapper}>
                  <Image 
                    source={{ uri: getDocByType('DL')?.imageUri }} 
                    style={styles.slotImage} 
                    resizeMode="cover"
                    onError={(e) => console.log('DL Image Load Error:', e.nativeEvent.error)}
                  />
                </View>
              ) : (
                <Plus size={24} color="#333" />
              )}
            </TouchableOpacity>
            <Text style={styles.slotLabel}>driving license</Text>
          </View>
        </View>

        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn}>
            <FileText size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Download All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, styles.actionBtnOutline]}>
            <ArrowRight size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share Documents</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {isUploading || loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#FFC107" />
          {isUploading && <Text style={styles.loaderText}>Uploading document...</Text>}
        </View>
      ) : null}

      {/* Source Selection Modal */}
      <Modal
        visible={showSourceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowSourceModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowSourceModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose Source</Text>
                  <TouchableOpacity onPress={() => setShowSourceModal(false)}>
                    <X size={24} color="#666" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalOptions}>
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); handleTakePhoto(selectedDocType); }}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                      <Camera size={22} color="#FFC107" />
                    </View>
                    <Text style={styles.modalOptionText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); handlePickImage(selectedDocType); }}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                      <ImageIcon size={22} color="#2196F3" />
                    </View>
                    <Text style={styles.modalOptionText}>From Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); handlePickDocument(selectedDocType); }}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                      <FileUp size={22} color="#4CAF50" />
                    </View>
                    <Text style={styles.modalOptionText}>Choose File (PDF)</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSourceModal(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Document Viewer Modal (v14) */}
      <Modal
        visible={showViewerModal}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setShowViewerModal(false)}
      >
        <SafeAreaView style={styles.viewerContainer}>
          <View style={styles.viewerHeader}>
            <View style={styles.viewerHeaderLeft}>
              <Text style={styles.viewerTitle}>{viewingDoc?.type || 'Document'}</Text>
              <Text style={styles.viewerSubtitle}>{primaryVehicle?.registrationNumber}</Text>
            </View>
            <View style={styles.viewerHeaderRight}>
              <TouchableOpacity
                style={styles.viewerHeaderIcon}
                onPress={() => {
                  if (viewingDoc) {
                    handleDeleteDoc(viewingDoc.id, viewingDoc.type);
                    setShowViewerModal(false);
                  }
                }}
              >
                <Trash2 size={22} color="#FF453A" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.viewerHeaderIcon, { marginLeft: 16 }]} 
                onPress={() => setShowViewerModal(false)}
              >
                <X size={24} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView 
            contentContainerStyle={styles.viewerContent} 
            centerContent={true}
            showsVerticalScrollIndicator={false}
          >
            {viewingDoc?.imageUri ? (
              <Image
                source={{ uri: viewingDoc.imageUri }}
                style={styles.fullImage}
                resizeMode="contain"
                onError={(e) => console.log('Viewer Image Load Error:', e.nativeEvent.error)}
              />
            ) : (
              <View style={styles.viewerPlaceholder}>
                <FileText size={64} color="#333" />
                <Text style={styles.placeholderText}>Preview not available</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.viewerFooter}>
            <TouchableOpacity style={styles.viewerActionBtn} onPress={() => handleShareDoc(viewingDoc)}>
              <Share2 size={20} color="#FFF" />
              <Text style={styles.viewerActionText}>Share as PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewerActionBtn, styles.viewerActionBtnOutline]} onPress={() => handleDownloadDoc(viewingDoc)}>
              <Download size={20} color="#FFF" />
              <Text style={styles.viewerActionText}>Download PDF</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'android' ? 24 : 12,
    paddingBottom: 24,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerTitleContainer: { marginLeft: 16, justifyContent: 'center' },
  headerRightAction: { padding: 4 },
  headerTitle: { fontSize: 28, fontFamily: 'Outfit-Bold', color: '#FFF', fontWeight: '800', lineHeight: 32, letterSpacing: -0.5, textTransform: 'lowercase' },
  headerSubtitle: { fontSize: 11, fontFamily: 'Outfit-Regular', color: '#666', marginTop: 1, textTransform: 'lowercase' },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 0 },

  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  trustText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#00C853', fontWeight: '600' },

  // DigiLocker Banner
  digiBanner: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, marginTop: 32 },
  digiTopRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  digiTextSection: { flex: 1, paddingRight: 12 },
  digiTitle: { fontSize: 18, fontFamily: 'Outfit-Bold', color: '#000', lineHeight: 24, fontWeight: '700' },
  digiGraphic: { width: 80, alignItems: 'flex-end' },
  graphicRect: { width: 68, height: 64, backgroundColor: '#F0F0F0', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EEE' },
  alertCircle: { position: 'absolute', bottom: -5, right: -5, width: 22, height: 22, borderRadius: 11, backgroundColor: '#6200EA', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFF' },
  alertText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },

  dotRow: { flexDirection: 'row', gap: 6, marginBottom: 28 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  dotActive: { width: 14, backgroundColor: '#AAA' },

  digiBtn: { backgroundColor: '#000', borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 18 },
  digiBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  digiLogoPlaceholder: { width: 24, height: 24, borderRadius: 6, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  digiBtnText: { color: '#FFF', fontSize: 15, fontFamily: 'Outfit-Bold', fontWeight: '600' },

  // Sections
  sectionHeaderRow: { marginTop: 44, marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 1, fontWeight: '700' },

  vehicleSummaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0F0F',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    marginBottom: 32
  },
  vehicleIconCircle: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  vehicleThumb: { width: 40, height: 40 },
  vehicleInfo: { flex: 1, marginLeft: 16 },
  vehicleName: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', marginBottom: 2, fontWeight: '700' },
  plateWrap: { alignSelf: 'flex-start', transform: [{ scale: 0.65 }], marginLeft: -24, marginTop: -4 },
  viewDetailsBtn: { paddingVertical: 4 },
  viewDetailsText: { color: '#FFF', fontSize: 12, fontFamily: 'Outfit-Medium', borderBottomWidth: 1, borderBottomColor: '#FFF' },

  gloveboxGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  personalGrid: { flexDirection: 'row', gap: 12 },

  slotContainer: { width: (width - 72) / 3, gap: 12 },
  slotBox: { width: '100%', aspectRatio: 1, backgroundColor: '#0A0A0A', borderRadius: 14, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  slotLabel: { fontSize: 11, fontFamily: 'Outfit-Medium', color: '#8E8E93', textTransform: 'lowercase', textAlign: 'center' },

  quickActions: { marginTop: 40, gap: 12 },
  actionBtn: {
    backgroundColor: '#000',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: '#222'
  },
  actionBtnOutline: { backgroundColor: 'transparent', borderColor: '#333' },
  actionBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', fontWeight: '700' },

  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  loaderText: { color: '#FFF', marginTop: 16, fontFamily: 'Outfit-Medium', fontSize: 14 },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  modalOptions: {
    gap: 12,
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 18,
    borderRadius: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  modalCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#888',
  },

  // Viewer (v14)
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A'
  },
  viewerHeaderLeft: { flex: 1 },
  viewerHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  viewerTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Bold', textTransform: 'lowercase' },
  viewerSubtitle: { color: '#8E8E93', fontSize: 12, fontFamily: 'Outfit-Medium', marginTop: 2, textTransform: 'uppercase' },
  viewerHeaderIcon: { padding: 4 },
  viewerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  fullImage: { width: '100%', height: '100%' },
  viewerPlaceholder: { alignItems: 'center' },
  placeholderText: { color: '#444', marginTop: 16, fontFamily: 'Outfit-Medium' },
  viewerFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A'
  },
  viewerActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#333'
  },
  viewerActionBtnOutline: {
    backgroundColor: 'transparent',
    borderColor: '#333'
  },
  viewerActionText: { color: '#FFF', fontSize: 15, fontFamily: 'Outfit-Bold' },
  
  // Progress Bar
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    width: width - 92, // Account for padding and back button
  },
  progressTextLeft: {
    fontSize: 11, fontFamily: 'Outfit-Regular', color: '#8E8E93', textTransform: 'lowercase'
  },
  progressTextRight: {
    fontSize: 10, fontFamily: 'Outfit-Bold', color: '#FF9800', letterSpacing: 1
  },
  progressBarContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 2
  },

  // New Styles
  imageWrapper: { width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden' },
  slotImage: { width: '100%', height: '100%', backgroundColor: '#1A1A1A' },
});
