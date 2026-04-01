import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  ActionSheetIOS,
  PermissionsAndroid,
  InteractionManager,
  Image,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes } from '@react-native-documents/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import StatusModal from '../../components/common/Modals/StatusModal';

import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { addDocumentFromResponse, toDocItem } from '../../store/slices/documentsSlice';
import { uploadDocument, checkImageQuality } from '../../services/documentService';
import BackButton from '../../components/BackButton';
import LoaderButton from '../../components/Button';

type UploadDocNavProp = NativeStackNavigationProp<RootStackParamList, 'UploadDocument'>;

const DOC_TYPES = ['RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];

interface FileInfo {
  uri: string;
  name: string;
  type: string;
}

export default function UploadDocument() {
  const navigation = useNavigation<UploadDocNavProp>();
  const dispatch = useAppDispatch();
  const [docType, setDocType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [primaryVehicle, setPrimaryVehicle] = useState<any>(null);
  const [qualityCheckLoading, setQualityCheckLoading] = useState(false);
  const [showQualityModal, setShowQualityModal] = useState(false);
  const [qualityHints, setQualityHints] = useState<string[]>([]);
  const [pendingImageAsset, setPendingImageAsset] = useState<{ uri: string; fileName?: string; type?: string } | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const isBusy = uploading || qualityCheckLoading;
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });
  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };

  useEffect(() => {
    fetchPrimaryVehicle();
  }, []);

  const fetchPrimaryVehicle = async () => {
    try {
      const { vehicleService } = require('../../services/vehicleService') as { vehicleService: any };
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find((v: any) => v.isPrimary) || vehicles[0];
      if (primary) {
        setPrimaryVehicle(primary);
        setVehicle(primary.registrationNumber);
      }
    } catch (err) {
      console.error('Failed to fetch primary vehicle:', err);
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
      const storage =
        Platform.Version >= 33
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

  const handleTapToUpload = () => {
    if (isBusy) return;
    setShowSourceModal(true);
  };

  const handlePickDocument = async () => {
    if (isBusy) return;
    try {
      const res = await pickDocument({
        type: [docTypes.pdf, docTypes.images],
        allowMultiSelection: false,
      });
      if (res?.[0]) {
        setPreviewError(false);
        const r = res[0];
        const isImageType = (r.type || '').startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(r.name || '');
        setFileInfo({
          uri: r.uri,
          name: r.name || `file_${Date.now()}`,
          type: r.type || (isImageType ? 'image/jpeg' : 'application/octet-stream'),
        });
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        showStatus('Error', 'Could not pick file', 'error');
      }
    }
  };

  const setFileFromImageAsset = (asset: { uri: string; fileName?: string; type?: string }, source: 'gallery' | 'camera') => {
    setPreviewError(false);
    setFileInfo({
      uri: asset.uri,
      name: asset.fileName || (source === 'camera' ? `camera_${Date.now()}.jpg` : `photo_${Date.now()}.jpg`),
      type: asset.type || 'image/jpeg',
    });
  };

  const runQualityCheckAndSetFile = async (asset: { uri: string; fileName?: string; type?: string }) => {
    setQualityCheckLoading(true);
    setPendingImageAsset(null);
    setQualityHints([]);
    try {
      const result = await checkImageQuality(asset.uri, asset.fileName, asset.type || 'image/jpeg');
      if (result.ok) {
        setFileFromImageAsset(asset, 'gallery');
      } else {
        setQualityHints(result.hints);
        setPendingImageAsset(asset);
        setShowQualityModal(true);
      }
    } catch {
      setFileFromImageAsset(asset, 'gallery');
    } finally {
      setQualityCheckLoading(false);
    }
  };

  const handlePickImage = async () => {
    if (isBusy) return;
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        showStatus('Permission needed', 'Camera and photo library access are required.', 'error');
        return;
      }
    }
    try {
      setShowSourceModal(false);
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        await runQualityCheckAndSetFile({
          uri: asset.uri!,
          fileName: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch {
      showStatus('Error', 'Could not pick image', 'error');
    }
  };

  const handleTakePhoto = async () => {
    if (isBusy) return;
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        showStatus('Permission needed', 'Camera access is required.', 'error');
        return;
      }
    }
    try {
      setShowSourceModal(false);
      const res = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        await runQualityCheckAndSetFile({
          uri: asset.uri!,
          fileName: asset.fileName || `camera_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch {
      showStatus('Error', 'Could not take photo', 'error');
    }
  };

  const handleUpload = async () => {
    if (isBusy) return;
    if (!docType) {
      showStatus('Required', 'Please select document type', 'error');
      return;
    }
    if (!fileInfo) {
      showStatus('Required', 'Please add a document (tap to upload)', 'error');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadDocument({
        type: docType,
        fileUri: fileInfo.uri,
        fileName: fileInfo.name,
        mimeType: fileInfo.type,
        documentNumber: vehicle.trim() || undefined,
      });

      dispatch(addDocumentFromResponse(toDocItem(result)));
      showStatus('Success', 'Document uploaded successfully');
      setTimeout(() => navigation.goBack(), 1500);
    } catch (err: any) {
      showStatus('Upload Failed', err.message || 'Something went wrong', 'error');
    } finally {
      setUploading(false);
    }
  };

  const isImage = fileInfo?.type?.startsWith('image/');

  // Normalize URI for Image preview (Android may need file:// for absolute paths)
  const previewUri =
    fileInfo?.uri && isImage
      ? fileInfo.uri.startsWith('file://') || fileInfo.uri.startsWith('content://') || fileInfo.uri.startsWith('http')
        ? fileInfo.uri
        : Platform.OS === 'android' && fileInfo.uri.startsWith('/')
        ? `file://${fileInfo.uri}`
        : fileInfo.uri
      : '';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle}>Upload Document</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Document Type */}
        <Text style={styles.label}>
          Document Type <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.selectInput}
          disabled={isBusy}
          onPress={() => setShowTypeDropdown(!showTypeDropdown)}
        >
          <Text style={docType ? styles.selectText : styles.selectPlaceholder}>
            {docType || 'Select document type'}
          </Text>
          <Icon
            name={showTypeDropdown ? 'chevron-up' : 'chevron-down'}
            size={wp(3.5)}
            color="#888"
          />
        </TouchableOpacity>
        {showTypeDropdown && (
          <View style={styles.dropdown}>
            {DOC_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                activeOpacity={0.85}
                style={[
                  styles.dropdownItem,
                  docType === type && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setDocType(type);
                  setShowTypeDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    docType === type && styles.dropdownItemTextActive,
                  ]}
                >
                  {type}
                </Text>
                {docType === type && (
                  <Icon name="check" size={wp(3.5)} color="#FFBF00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Linked Vehicle (Automatic) */}
        {primaryVehicle && (
          <View style={styles.autoLinkBox}>
            <View style={styles.autoLinkHeader}>
              <Icon name="link" size={wp(3.5)} color="#FFBF00" />
              <Text style={styles.autoLinkLabel}>Automatically Linked to</Text>
            </View>
            <View style={styles.autoLinkContent}>
              <View style={styles.vehicleIcon}>
                <Icon name="car" size={wp(4)} color="#fff" />
              </View>
              <View>
                <Text style={styles.vehicleNumber}>{primaryVehicle.registrationNumber}</Text>
                <Text style={styles.vehicleModel}>{primaryVehicle.make} {primaryVehicle.model}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Tap to Upload / Preview */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.uploadArea, isBusy && styles.uploadAreaDisabled]}
          onPress={handleTapToUpload}
          disabled={isBusy}
        >
          {fileInfo && isImage ? (
            previewError ? (
              <View style={styles.previewFallback}>
                <Icon name="file-image" size={wp(12)} color="#FFBF00" />
                <Text style={styles.previewFallbackText}>Image selected</Text>
                <Text style={styles.uploadSub}>Preview unavailable • Tap to change</Text>
              </View>
            ) : (
              <Image
                key={fileInfo.uri}
                source={{ uri: previewUri || fileInfo.uri }}
                style={styles.previewImage}
                resizeMode="cover"
                onError={() => setPreviewError(true)}
                onLoad={() => setPreviewError(false)}
              />
            )
          ) : fileInfo ? (
            <View style={styles.filePreview}>
              <Icon name="file-pdf" size={wp(10)} color="#FFBF00" />
              <Text style={styles.fileName} numberOfLines={2}>
                {fileInfo.name}
              </Text>
              <Text style={styles.uploadSub}>Tap to change</Text>
            </View>
          ) : (
            <>
              <View style={styles.uploadIconWrap}>
                <Icon name="cloud-upload-alt" size={wp(8)} color="#FFBF00" />
              </View>
              <Text style={styles.uploadTitle}>Tap to upload</Text>
              <Text style={styles.uploadSub}>Choose file or take a photo</Text>
              <View style={styles.uploadFileTypes}>
                <View style={styles.fileTypeBadge}>
                  <Text style={styles.fileTypeBadgeText}>PDF</Text>
                </View>
                <View style={styles.fileTypeBadge}>
                  <Text style={styles.fileTypeBadgeText}>JPG</Text>
                </View>
                <View style={styles.fileTypeBadge}>
                  <Text style={styles.fileTypeBadgeText}>PNG</Text>
                </View>
              </View>
              <Text style={styles.uploadHint}>Max file size: 10 MB</Text>
            </>
          )}
        </TouchableOpacity>

        {/* File name display when image is shown */}
        {fileInfo && isImage && (
          <View style={styles.fileNameRow}>
            <Icon name="paperclip" size={wp(3.5)} color="#FFBF00" />
            <Text style={styles.fileNameSmall} numberOfLines={1}>{fileInfo.name}</Text>
            <TouchableOpacity onPress={() => setFileInfo(null)} activeOpacity={0.7} disabled={isBusy}>
              <Icon name="times-circle" size={wp(4)} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* OCR Note */}
        <View style={styles.ocrNote}>
          <Icon name="magic" size={wp(4.5)} color="#FFBF00" style={{ marginRight: wp(3) }} />
          <Text style={styles.ocrNoteText}>
            AI will auto-extract document details after upload
          </Text>
        </View>

        {/* Upload Button */}
        <LoaderButton
          title="Upload"
          loading={uploading}
          loadingTitle="Uploading..."
          onPress={handleUpload}
          disabled={qualityCheckLoading}
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
        />
      </ScrollView>

      {/* Source Selection Modal */}
      <Modal
        visible={showSourceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isBusy) {
            setShowSourceModal(false);
          }
        }}
      >
        <TouchableWithoutFeedback onPress={() => {
          if (!isBusy) {
            setShowSourceModal(false);
          }
        }}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choose Source</Text>
                  <TouchableOpacity onPress={() => setShowSourceModal(false)} disabled={isBusy}>
                    <Icon name="times" size={wp(5)} color="#888" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalOptions}>
                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); void handleTakePhoto(); }}
                    disabled={isBusy}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                      <Icon name="camera" size={wp(5)} color="#4CAF50" />
                    </View>
                    <Text style={styles.modalOptionText}>Take Photo</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); void handlePickImage(); }}
                    disabled={isBusy}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                      <Icon name="images" size={wp(5)} color="#2196F3" />
                    </View>
                    <Text style={styles.modalOptionText}>From Gallery</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalOption}
                    onPress={() => { setShowSourceModal(false); handlePickDocument(); }}
                    disabled={isBusy}
                  >
                    <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(255, 152, 0, 0.1)' }]}>
                      <Icon name="file-pdf" size={wp(5)} color="#FF9800" />
                    </View>
                    <Text style={styles.modalOptionText}>Choose File (PDF)</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowSourceModal(false)}
                  disabled={isBusy}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Quality check retake modal (A3) */}
      <Modal visible={showQualityModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Image quality</Text>
              <TouchableOpacity onPress={() => { setShowQualityModal(false); setPendingImageAsset(null); }}>
                <Icon name="times" size={wp(5)} color="#888" />
              </TouchableOpacity>
            </View>
            <Text style={styles.qualityHintText}>
              For better results:
            </Text>
            {qualityHints.map((hint, i) => (
              <Text key={i} style={styles.qualityHintItem}>• {hint}</Text>
            ))}
            <View style={styles.qualityActions}>
              <TouchableOpacity
                style={[styles.modalOption, styles.qualityRetakeBtn]}
                onPress={() => { setShowQualityModal(false); setPendingImageAsset(null); }}
              >
                <Icon name="camera" size={wp(4)} color="#FFBF00" />
                <Text style={styles.qualityRetakeText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalOption, styles.qualityUseAnywayBtn]}
                onPress={() => {
                  if (pendingImageAsset) {
                    setFileFromImageAsset(pendingImageAsset, 'gallery');
                    setShowQualityModal(false);
                    setPendingImageAsset(null);
                  }
                }}
              >
                <Text style={styles.qualityUseAnywayText}>Use anyway</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {qualityCheckLoading && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-only">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <ActivityIndicator size="large" color="#FFBF00" />
            <Text style={{ color: '#fff', marginTop: hp(2), fontFamily: 'Outfit-Regular' }}>Checking image quality…</Text>
          </View>
        </View>
      )}
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { padding: wp(2) },
  headerTitle: { flex: 1, fontSize: wp(5.5), fontWeight: '700', color: '#fff', marginLeft: wp(3) },
  headerRight: { width: wp(10) },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
    paddingBottom: hp(4),
  },

  label: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#fff',
    marginBottom: hp(1),
  },
  required: { color: '#F44336' },

  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    height: hp(6.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  selectText: { fontSize: wp(4), color: '#fff' },
  selectPlaceholder: { fontSize: wp(4), color: '#666' },

  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    height: hp(6.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: wp(4),
    color: '#fff',
  },

  dropdown: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    marginTop: -hp(1.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(1.6),
    paddingHorizontal: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  dropdownItemActive: { backgroundColor: 'rgba(255,191,0,0.08)' },
  dropdownItemText: { fontSize: wp(4), color: '#ccc' },
  dropdownItemTextActive: { color: '#FFBF00', fontWeight: '600' },

  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    paddingVertical: hp(3),
    marginBottom: hp(1.5),
    borderWidth: 2,
    borderColor: 'rgba(255,191,0,0.25)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadAreaDisabled: {
    opacity: 0.6,
  },
  uploadIconWrap: {
    width: wp(18),
    height: wp(18),
    borderRadius: wp(9),
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
  },
  uploadTitle: {
    fontSize: wp(4.5),
    fontWeight: '600',
    color: '#fff',
    marginBottom: hp(0.3),
  },
  uploadSub: { fontSize: wp(3.5), color: '#888', marginBottom: hp(2) },
  uploadFileTypes: {
    flexDirection: 'row',
    gap: wp(2),
    marginBottom: hp(1),
  },
  fileTypeBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.4),
    borderRadius: wp(2),
    backgroundColor: '#2a2a2a',
  },
  fileTypeBadgeText: { fontSize: wp(3), color: '#aaa', fontWeight: '600' },
  uploadHint: { fontSize: wp(3), color: '#555' },

  previewImage: {
    width: '100%',
    height: hp(25),
    minHeight: hp(20),
    borderRadius: wp(2),
  },
  previewFallback: {
    width: '100%',
    height: hp(25),
    minHeight: hp(20),
    borderRadius: wp(2),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(2),
  },
  previewFallbackText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
    marginTop: hp(1),
  },
  filePreview: {
    alignItems: 'center',
    paddingVertical: hp(2),
  },
  fileName: {
    fontSize: wp(3.8),
    color: '#fff',
    marginTop: hp(1),
    textAlign: 'center',
    paddingHorizontal: wp(4),
  },

  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(2.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    marginBottom: hp(1.5),
    gap: wp(2),
  },
  fileNameSmall: {
    flex: 1,
    fontSize: wp(3.3),
    color: '#ccc',
  },

  ocrNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,191,0,0.08)',
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: hp(3),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.15)',
  },
  ocrNoteText: { flex: 1, fontSize: wp(3.5), color: '#ccc' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
    gap: wp(2),
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: wp(4.5), fontWeight: '700', color: '#000' },

  autoLinkBox: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    padding: wp(4),
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.15)',
  },
  autoLinkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.2),
    gap: wp(2),
  },
  autoLinkLabel: {
    fontSize: wp(3.2),
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  autoLinkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(3),
  },
  vehicleIcon: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleNumber: {
    fontSize: wp(4.2),
    fontWeight: '700',
    color: '#fff',
  },
  vehicleModel: {
    fontSize: wp(3.3),
    color: '#888',
    marginTop: hp(0.2),
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: wp(6),
    borderTopRightRadius: wp(6),
    padding: wp(5),
    paddingBottom: Platform.OS === 'ios' ? hp(4) : hp(2),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: hp(2.5),
    paddingHorizontal: wp(1),
  },
  modalTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
  },
  modalOptions: {
    gap: hp(1.5),
    marginBottom: hp(3),
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    padding: wp(4),
    borderRadius: wp(4),
    gap: wp(4),
  },
  modalOptionIcon: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: wp(4),
    fontWeight: '600',
    color: '#fff',
  },
  modalCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(2),
    backgroundColor: '#2a2a2a',
    borderRadius: wp(4),
  },
  modalCancelText: {
    fontSize: wp(4.2),
    fontWeight: '600',
    color: '#888',
  },
  qualityHintText: {
    fontSize: wp(4),
    color: '#ccc',
    marginBottom: hp(1.5),
  },
  qualityHintItem: {
    fontSize: wp(3.8),
    color: '#aaa',
    marginBottom: hp(1),
    paddingLeft: wp(2),
  },
  qualityActions: {
    flexDirection: 'row',
    gap: wp(4),
    marginTop: hp(3),
  },
  qualityRetakeBtn: {
    flex: 1,
    justifyContent: 'center',
    gap: wp(2),
    borderWidth: 1,
    borderColor: '#FFBF00',
  },
  qualityRetakeText: { fontSize: wp(4), fontWeight: '600', color: '#FFBF00' },
  qualityUseAnywayBtn: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  qualityUseAnywayText: { fontSize: wp(4), fontWeight: '600', color: '#fff' },
});
