import React, { useState, useEffect } from 'react';
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
  Linking,
  Animated,
  Easing,
  useWindowDimensions,
} from 'react-native';
import Svg, {Circle} from 'react-native-svg';
// @ts-ignore
import { generatePDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShieldCheck,
  FileText,
  ChevronRight,
  Clock3,
  IdCard,
  Lock,
  Cloud,
  Camera,
  Image as ImageIcon,
  FileUp,
  Link,
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
import {
  fetchDocuments,
  addDocumentFromResponse,
  toDocItem,
  removeDocumentAsync,
  type DocumentItem,
} from '../../store/slices/documentsSlice';
import { INDPlate } from '../../components/Vehicles/VehicleUI';
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { uploadDocument, connectDigiLocker, syncDigiLocker } from '../../services/documentService';
import { getNetworkOnlineState } from '../../services/api';
import { queueDocumentUpload, flushQueuedDocumentUploads } from '../../services/offlineMutationQueue';
import StatusModal from '../../components/common/Modals/StatusModal';
import ConfirmModal from '../../components/common/Modals/ConfirmModal';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { getAbsoluteUrl } from '../../config';

const { width } = Dimensions.get('window');
const CarImage = require('../../assets/images/car_vehicle_demo.png');
const BikeImage = require('../../assets/images/bike.png');
const REQUIRED_DOCS = [
  { type: 'RC', label: 'reg certificate' },
  { type: 'Insurance', label: 'insurance policy' },
  { type: 'PUC', label: 'puc certificate' },
  { type: 'DL', label: 'driving license' },
] as const;

const DOC_ROW_META = {
  RC: {
    title: 'RC Front',
    subtitle: 'Registration certificate',
    icon: FileText,
  },
  Insurance: {
    title: 'Insurance',
    subtitle: 'Vehicle insurance policy',
    icon: ShieldCheck,
  },
  PUC: {
    title: 'PUC Certificate',
    subtitle: 'Pollution under control',
    icon: Clock3,
  },
  DL: {
    title: 'Driving License',
    subtitle: 'Personal ID - required for driving',
    icon: IdCard,
  },
} as const;

const DOC_ROW_ORDER = ['RC', 'Insurance', 'PUC', 'DL'] as const;

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

function formatDocDate(date?: string | null): string {
  if (!date) return 'No expiry found';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'No expiry found';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getDocumentStatusMeta(doc?: DocumentItem | null) {
  if (!doc) {
    return {
      label: 'Missing',
      caption: 'Tap to add',
      tone: '#A1A1AA',
      bg: 'rgba(255,255,255,0.06)',
      border: 'rgba(255,255,255,0.08)',
    };
  }

  if (doc.status === 'expired') {
    return {
      label: 'Expired',
      caption: `Expired ${formatDocDate(doc.expiryDate)}`,
      tone: '#FB7185',
      bg: 'rgba(251,113,133,0.14)',
      border: 'rgba(251,113,133,0.35)',
    };
  }

  if (doc.status === 'expiring') {
    return {
      label: 'Expiring',
      caption: `Due ${formatDocDate(doc.expiryDate)}`,
      tone: '#F59E0B',
      bg: 'rgba(245,158,11,0.14)',
      border: 'rgba(245,158,11,0.35)',
    };
  }

  return {
    label: doc.verificationStatus === 'VERIFIED' ? 'Verified' : 'Stored',
    caption: doc.expiryDate ? `Valid till ${formatDocDate(doc.expiryDate)}` : 'Ready in glovebox',
    tone: '#22C55E',
    bg: 'rgba(34,197,94,0.14)',
    border: 'rgba(34,197,94,0.35)',
  };
}

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const dispatch = useAppDispatch();
  const { documents: allStoreDocuments, loading } = useAppSelector((state: RootState) => state.documents);
  const { width: windowWidth } = useWindowDimensions();
  const healthSpin = React.useRef(new Animated.Value(0)).current;
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [vehicleImageError, setVehicleImageError] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Filter documents to show only those belonging specifically to the primary vehicle
  // Use robust, case-insensitive comparison for registration numbers
  const documents = allStoreDocuments.filter(doc => {
    if (!primaryVehicle) return false;
    const primaryReg = (primaryVehicle.registrationNumber || '').trim().toUpperCase();
    if (primaryReg === '') return false;
    
    const docReg = (doc.vehicle || '').trim().toUpperCase();
    const docNum = (doc.documentNumber || '').trim().toUpperCase();
    
    return docReg === primaryReg || docNum === primaryReg;
  });
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    type: 'default' as 'default' | 'delete' | 'logout',
    confirmText: 'Confirm',
    onConfirm: () => { },
  });
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
    dispatch(fetchDocuments());
    loadPrimaryVehicle();
    flushQueuedDocumentUploads((doc) => {
      dispatch(addDocumentFromResponse(toDocItem(doc)));
    }).catch(() => {});
  }, [dispatch]);

  useEffect(() => {
    Animated.timing(healthSpin, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [healthSpin]);

  useEffect(() => {
    setVehicleImageError(false);
  }, [primaryVehicle?.id, primaryVehicle?.imageUrl]);

  const loadPrimaryVehicle = async () => {
    try {
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary);
      setPrimaryVehicle(primary || null);
    } catch {
      setPrimaryVehicle(null);
    }
  };

  const checkPrimaryVehicle = () => {
    if (!primaryVehicle) {
      Alert.alert(
        'Action Required',
        'Please set a primary vehicle in your garage before uploading documents.',
        [
          { text: 'Go to Garage', onPress: () => navigation.navigate('VehicleList') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return false;
    }
    return true;
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
    if (!checkPrimaryVehicle()) return;
    try {
      const res = await pickDocument({
        type: [docTypes.pdf, docTypes.images],
        allowMultiSelection: false,
      });
      if (res?.[0]) {
        performUpload(type, res[0].uri, res[0].name || `file_${Date.now()}`, res[0].type || 'application/octet-stream');
      }
    } catch (e: any) {
      const err = e as { code?: string };
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        showStatus('Error', 'Could not pick file', 'error');
      }
    }
  };

  const handlePickImage = async (type: string) => {
    if (!checkPrimaryVehicle()) return;
    setSelectedDocType(type);
    if (Platform.OS === 'android') {
      const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      const storage = Platform.Version >= 33 
        ? await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES)
        : await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
      
      if (camera !== PermissionsAndroid.RESULTS.GRANTED || storage !== PermissionsAndroid.RESULTS.GRANTED) {
        showStatus('Permission needed', 'Camera and photo library access are required.', 'error');
        return;
      }
    }
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        uploadImageAsset(res.assets[0], type);
      }
    } catch {
      showStatus('Error', 'Could not pick image', 'error');
    }
  };

  const handleTakePhoto = async (type: string) => {
    if (!checkPrimaryVehicle()) return;
    setSelectedDocType(type);
    if (Platform.OS === 'android') {
      const camera = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
      if (camera !== PermissionsAndroid.RESULTS.GRANTED) {
        showStatus('Permission needed', 'Camera access is required.', 'error');
        return;
      }
    }
    try {
      const res = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        uploadImageAsset(res.assets[0], type);
      }
    } catch {
      showStatus('Error', 'Could not take photo', 'error');
    }
  };

  const uploadImageAsset = async (asset: any, type: string) => {
    setIsUploading(true);
    try {
      const result = await uploadDocument({
        type,
        fileUri: asset.uri,
        fileName: asset.fileName || `camera_${Date.now()}.jpg`,
        mimeType: asset.type || 'image/jpeg',
        documentNumber: primaryVehicle?.registrationNumber,
      });
      dispatch(addDocumentFromResponse(toDocItem(result)));
      showStatus('Success', 'Document uploaded successfully');
    } catch (err: any) {
      showStatus('Upload Failed', err.message || 'Something went wrong', 'error');
    } finally {
      setIsUploading(false);
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
        vehicleId: primaryVehicle?.id,
        documentNumber: primaryVehicle?.registrationNumber,
      });

      dispatch(addDocumentFromResponse(toDocItem(result)));
      showStatus('Upload Successful', `${type} has been added to your glovebox.`);
    } catch (err: any) {
      const message = String(err?.message ?? '');
      const isNetworkError =
        !getNetworkOnlineState() ||
        /network error|network request failed|failed to fetch|server unreachable/i.test(message);

      if (!isNetworkError) {
        Alert.alert('Upload Failed', message || 'Something went wrong');
        return;
      }

      try {
        await queueDocumentUpload({
          type,
          fileUri: uri,
          fileName: name,
          mimeType: mime,
          vehicleId: primaryVehicle?.id,
          documentNumber: primaryVehicle?.registrationNumber,
        });
        Alert.alert('Saved offline', `${type} will upload automatically when network returns.`);
      } catch {
        Alert.alert('Upload Failed', message || 'Something went wrong');
      }
      showStatus('Upload Failed', err.message || 'Something went wrong', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const createPDFFromDocuments = async (docs: any[], fileName?: string) => {
    try {
      const fetchImageAsBase64 = async (uri: string, retries = 2) => {
        if (!uri) return '';

        for (let i = 0; i <= retries; i++) {
          try {
            if (uri.startsWith('http')) {
              const tempPath = `${RNFS.CachesDirectoryPath}/pdf_tmp_${Date.now()}_${Math.floor(Math.random() * 10000)}.jpg`;

              const downloadResult = await RNFS.downloadFile({
                fromUrl: uri,
                toFile: tempPath,
                connectionTimeout: 15000,
                readTimeout: 15000,
              }).promise;

              if (downloadResult.statusCode === 200) {
                const base64 = await RNFS.readFile(tempPath, 'base64');
                await RNFS.unlink(tempPath).catch(() => { });
                return `data:image/jpeg;base64,${base64}`;
              } else {
                throw new Error(`Status ${downloadResult.statusCode}`);
              }
            } else {
              const cleanPath = uri.replace('file://', '');
              if (await RNFS.exists(cleanPath)) {
                const base64 = await RNFS.readFile(cleanPath, 'base64');
                return `data:image/jpeg;base64,${base64}`;
              }
              return uri;
            }
          } catch (e) {
            console.error(`Attempt ${i + 1} failed for ${uri}:`, e);
            if (i === retries) return uri;
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        return uri;
      };

      const pagesHtml = await Promise.all(docs.map(async (doc) => {
        const base64Uri = await fetchImageAsBase64(doc.imageUri);
        return `
          <div style="page-break-after:always; display:flex; flex-direction:column; align-items:center; justify-content:center; width:100%; height:100vh; padding: 20px; box-sizing: border-box;">
            <h1 style="font-family: Arial; margin-bottom: 20px;">${doc.type}</h1>
            <p style="font-family: Arial; color: #666; margin-bottom: 20px;">Vehicle: ${primaryVehicle?.registrationNumber || 'N/A'}</p>
            <img src="${base64Uri}" style="max-width:100%; max-height:80%; object-fit:contain; border: 1px solid #eee;" />
          </div>
        `;
      }));

      const options = {
        html: `
          <html>
            <body style="margin:0;padding:0;">
              ${pagesHtml.join('')}
            </body>
          </html>
        `,
        fileName: fileName || `glovebox_docs_${Date.now()}`,
      };
      const file = await generatePDF(options);
      return file.filePath;
    } catch (error) {
      console.error('PDF Generation Error:', error);
      throw new Error('Failed to generate PDF');
    }
  };

  const handleShareAll = async () => {
    if (documents.length === 0) {
      showStatus('No Documents', 'You have no documents to share.', 'error');
      return;
    }
    try {
      setIsUploading(true);
      const pdfPath = await createPDFFromDocuments(documents, `all_documents_${primaryVehicle?.registrationNumber}`);
      setIsUploading(false);

      await RNShareCustom.open({
        url: `file://${pdfPath}`,
        type: 'application/pdf',
        title: 'Share All Documents',
        message: `Sharing all vehicle documents for ${primaryVehicle?.registrationNumber}`,
      });
    } catch (error: any) {
      setIsUploading(false);
      if (error?.message !== 'User did not share') {
        showStatus('Error', 'Could not share documents', 'error');
      }
    }
  };

  const handleDownloadAll = async () => {
    if (documents.length === 0) {
      showStatus('No Documents', 'You have no documents to download.', 'error');
      return;
    }
    let localPath = '';
    try {
      setIsUploading(true);
      localPath = await createPDFFromDocuments(documents, `all_documents_${primaryVehicle?.registrationNumber}`);
      const fileName = localPath.split('/').pop() || `all_docs_${Date.now()}.pdf`;

      if (Platform.OS === 'android') {
        const downloadDir = `${RNFS.ExternalStorageDirectoryPath}/Download`;
        const finalPath = `${downloadDir}/${fileName}`;
        try {
          const exists = await RNFS.exists(downloadDir);
          if (!exists) await RNFS.mkdir(downloadDir);
          await RNFS.copyFile(localPath, finalPath);
          await RNFS.scanFile(finalPath);
          setIsUploading(false);
          showStatus('Download Complete', 'All documents saved to your Downloads folder.');
          return;
        } catch (copyErr) {
          console.log('Download All Direct Copy Failed:', copyErr);
        }
      }

      setIsUploading(false);
      await RNShareCustom.open({
        url: `file://${localPath}`,
        type: 'application/pdf',
        title: 'Save All Documents',
        saveToFiles: true,
      });
    } catch (error: any) {
      setIsUploading(false);
      if (error?.message === 'User did not share') return;
      if (localPath) {
        try {
          await RNShareCustom.open({ url: `file://${localPath}`, type: 'application/pdf' });
        } catch { }
      }
    }
  };

  const handleShareDoc = async (doc: any) => {
    if (!doc?.imageUri) return;
    try {
      setIsUploading(true);
      const pdfPath = await createPDFFromDocuments([doc]);
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
        showStatus('Error', 'Could not share document as PDF', 'error');
      }
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    if (!doc?.id) return;
    try {
      setIsUploading(true);
      if (Platform.OS === 'android') {
        const pdfUrl = doc.imageUri.replace('/image', '/pdf');
        await Linking.openURL(pdfUrl);
        setIsUploading(false);
        return;
      }

      const localPath = await createPDFFromDocuments([doc]);
      await RNShareCustom.open({
        url: `file://${localPath}`,
        type: 'application/pdf',
        title: 'Save Document',
        saveToFiles: true,
      });
      setIsUploading(false);
    } catch (error: any) {
      setIsUploading(false);
      showStatus('Download Error', 'Could not initiate download. Please use the Share button.', 'error');
    }
  };

  const getDocByType = (type: string) => {
    return documents.find(d => d.type === type);
  };

  const requiredDocuments = REQUIRED_DOCS.map(({ type, label }) => ({
    type,
    label,
    document: getDocByType(type),
  }));
  const missingRequiredDocs = requiredDocuments.filter(item => !item.document);
  const expiredRequiredDocs = requiredDocuments.filter(item => item.document?.status === 'expired');
  const expiringRequiredDocs = requiredDocuments.filter(item => item.document?.status === 'expiring');
  const healthyRequiredDocs = requiredDocuments.filter(item => item.document?.status === 'verified');

  const openDocumentFlow = (type: string) => {
    setSelectedDocType(type);
    setShowSourceModal(true);
  };

  const handlePriorityAction = () => {
    if (missingRequiredDocs[0]) {
      openDocumentFlow(missingRequiredDocs[0].type);
      return;
    }

    const attentionDoc = expiredRequiredDocs[0]?.document || expiringRequiredDocs[0]?.document;
    if (attentionDoc) {
      setViewingDoc(attentionDoc);
      setShowViewerModal(true);
      return;
    }

    handleConnectDigiLocker();
  };

  const handleDeleteDoc = (id: string, type: string) => {
    setConfirmModal({
      visible: true,
      title: 'Delete Document',
      message: `Are you sure you want to delete your ${type}? This action cannot be undone.`,
      type: 'delete',
      confirmText: 'Delete',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await dispatch(removeDocumentAsync(id)).unwrap();
          showStatus('Deleted', `${type} has been removed.`, 'delete');
        } catch (err: any) {
          showStatus('Error', err.message || 'Failed to delete', 'error');
        }
      }
    });
  };

  const handleConnectDigiLocker = async () => {
    try {
      setIsUploading(true);
      const res = await connectDigiLocker();
      setIsUploading(false);
      if (res?.url && res?.client_id) {
        navigation.navigate('DigiLockerKYC', { url: res.url, client_id: res.client_id });
        return;
      }
      if (res?.url) {
        await Linking.openURL(res.url);
        setConfirmModal({
          visible: true,
          title: 'DigiLocker Linked',
          message: 'Once you complete verification in your browser, tap Sync to update your documents.',
          type: 'default',
          confirmText: 'Sync Now',
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
            setIsUploading(true);
            try {
              await syncDigiLocker(res.client_id);
              dispatch(fetchDocuments());
              showStatus('Synced', 'Documents updated from DigiLocker!');
            } catch (err) {
              showStatus('Error', 'Sync failed. Please try again.', 'error');
            } finally {
              setIsUploading(false);
            }
          }
        });
      }
    } catch (error: any) {
      setIsUploading(false);
      showStatus('Error', error.message || 'Could not connect to DigiLocker', 'error');
    }
  };

  const verifiedDocumentsCount = healthyRequiredDocs.length;
  const reviewDocumentsCount =
    expiringRequiredDocs.length + expiredRequiredDocs.length;
  const missingDocumentsCount = missingRequiredDocs.length;
  const documentHealthScore = Math.max(
    0,
    Math.min(100, verifiedDocumentsCount * 25),
  );
  const documentHealthScoreText = String(documentHealthScore).padStart(2, '0');
  const documentHealthSubtitle =
    missingDocumentsCount > 0
      ? `${missingDocumentsCount} document${missingDocumentsCount === 1 ? '' : 's'} still missing`
      : reviewDocumentsCount > 0
        ? `${reviewDocumentsCount} document${reviewDocumentsCount === 1 ? '' : 's'} need review`
        : 'Everything important is stored';
  const documentHealthBadgeText =
    missingDocumentsCount > 0
      ? `${missingDocumentsCount} missing`
      : reviewDocumentsCount > 0
        ? `${reviewDocumentsCount} review${reviewDocumentsCount === 1 ? '' : 's'}`
        : 'ready';
  const documentHealthBadgeTone =
    missingDocumentsCount > 0
      ? '#f59e0b'
      : reviewDocumentsCount > 0
        ? '#fb7185'
        : '#22c55e';
  const documentHealthBadgeBg =
    missingDocumentsCount > 0
      ? 'rgba(245,158,11,0.14)'
      : reviewDocumentsCount > 0
        ? 'rgba(251,113,133,0.14)'
        : 'rgba(34,197,94,0.14)';
  const documentHealthBadgeBorder =
    missingDocumentsCount > 0
      ? 'rgba(245,158,11,0.35)'
      : reviewDocumentsCount > 0
        ? 'rgba(251,113,133,0.35)'
        : 'rgba(34,197,94,0.35)';
  const healthRingColor =
    missingDocumentsCount > 0 || reviewDocumentsCount > 0
      ? '#f59e0b'
      : '#22c55e';
  const healthRingRotation = healthSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ['-90deg', '270deg'],
  });
  const pageWidth = Math.max(0, Math.min(windowWidth - 44, 430));
  const digiLockerHeadlineSize = Math.max(16, Math.min(22, Math.round(pageWidth * 0.058)));
  const digiLockerBrandTitleSize = Math.max(16, Math.min(20, Math.round(pageWidth * 0.048)));
  const digiLockerBrandSubtitleSize = Math.max(9, Math.min(11, Math.round(pageWidth * 0.028)));
  const digiLockerLogoSize = Math.max(50, Math.min(60, Math.round(pageWidth * 0.17)));
  const digiLockerSheetSize = Math.max(34, Math.min(42, Math.round(digiLockerLogoSize * 0.72)));
  const digiLockerChipTextSize = Math.max(12, Math.min(14, Math.round(pageWidth * 0.04)));
  const digiLockerCompact = pageWidth < 360;
  const statsRowGap = 12;
  const statCardWidth = Math.max(0, Math.floor((pageWidth - statsRowGap * 2) / 3));
  const statCardHeight = Math.max(86, Math.round(statCardWidth * 0.88));
  const statValueSize = Math.max(26, Math.min(44, Math.round(statCardWidth * 0.36)));
  const statValueLineHeight = statValueSize + 2;
  const statLabelSize = Math.max(9, Math.min(12, Math.round(statCardWidth * 0.1)));
  const documentGridGap = 8;
  const documentSectionCardPadding = 10;
  const documentGridCardWidth = Math.max(0, Math.floor((pageWidth - documentSectionCardPadding * 2 - documentGridGap) / 2));
  const documentGridCardHeight = Math.max(118, Math.round(documentGridCardWidth * 0.68));
  const documentGridRows = [
    DOC_ROW_ORDER.slice(0, 2),
    DOC_ROW_ORDER.slice(2, 4),
  ] as const;
  const healthSegmentCount = 5;
  const filledHealthSegments =
    documentHealthScore > 0
      ? Math.min(
          healthSegmentCount,
          Math.max(1, Math.round((documentHealthScore / 100) * healthSegmentCount)),
        )
      : 0;
  const primaryHealthActionLabel =
    missingDocumentsCount > 0
      ? '+ Add Documents'
      : reviewDocumentsCount > 0
        ? 'Review document'
        : 'Connect DigiLocker';

  const vehicleImageUrl = primaryVehicle?.imageUrl || primaryVehicle?.rtoDetails?.imageUrl;
  const vehicleImageSource =
    !vehicleImageError && vehicleImageUrl
      ? { uri: getAbsoluteUrl(vehicleImageUrl) }
      : (primaryVehicle?.vehicleType === 'BIKE' ? BikeImage : CarImage);

  const DocumentHealthRing = ({score}: {score: number}) => {
    const size = 104;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const safeScore = Math.max(0, Math.min(100, score));
    const renderScore =
      safeScore > 0 ? safeScore : missingDocumentsCount > 0 ? 4 : 0;
    const dashOffset = circumference - (circumference * renderScore) / 100;

    return (
      <View style={styles.docHealthRing}>
        <Animated.View style={[styles.docHealthRingSpin, {transform: [{rotate: healthRingRotation}]}]}>
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#2c2c33"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={healthRingColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              fill="transparent"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          </Svg>
        </Animated.View>
        <View style={styles.docHealthRingCenter}>
          <Text style={styles.docHealthRingText}>
            {safeScore.toFixed(0)}%
          </Text>
        </View>
      </View>
    );
  };

  const DocumentRow = ({type}: {type: keyof typeof DOC_ROW_META}) => {
    const doc = getDocByType(type);
    const statusMeta = getDocumentStatusMeta(doc);
    const rowMeta = DOC_ROW_META[type];
    const RowIcon = rowMeta.icon;
    const isMissing = !doc;
    const rowTone = isMissing
      ? '#ef4444'
      : doc?.status === 'expiring'
        ? '#f59e0b'
        : doc?.status === 'expired'
          ? '#ef4444'
          : '#22c55e';
    const rowBg = isMissing
      ? 'rgba(239,68,68,0.10)'
      : doc?.status === 'expiring'
        ? 'rgba(245,158,11,0.10)'
        : doc?.status === 'expired'
          ? 'rgba(239,68,68,0.10)'
          : 'rgba(34,197,94,0.08)';
    const rowBorder = isMissing
      ? 'rgba(239,68,68,0.25)'
      : doc?.status === 'expiring'
        ? 'rgba(245,158,11,0.25)'
        : doc?.status === 'expired'
          ? 'rgba(239,68,68,0.25)'
          : 'rgba(34,197,94,0.20)';
    const rowSubtitle = doc ? statusMeta.caption : rowMeta.subtitle;
    const rowStatusLabel = statusMeta.label.toUpperCase();

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        style={[
          styles.documentGridItem,
          {borderColor: rowBorder, borderStyle: isMissing ? 'dashed' : 'solid'},
          {width: documentGridCardWidth, minHeight: documentGridCardHeight},
        ]}
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
        <View style={styles.documentGridTop}>
          <View
            style={[
              styles.documentIconWrap,
              {backgroundColor: rowBg, borderColor: rowBorder},
            ]}
          >
            <RowIcon size={22} color={rowTone} />
          </View>
          <View style={styles.documentGridTextWrap}>
            <Text style={styles.documentTitle} numberOfLines={1}>{rowMeta.title}</Text>
            <Text style={styles.documentSubtitle} numberOfLines={2}>{rowSubtitle}</Text>
          </View>
        </View>
        <View style={styles.documentGridBottom}>
          <View style={[styles.documentStatusPill, {backgroundColor: rowBg, borderColor: rowBorder}]}>
            <Text style={[styles.documentStatusText, {color: rowTone}]}>
              {rowStatusLabel}
            </Text>
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.28)" />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#050505" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.screenContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <View style={styles.heroHeader}>
            <BackButton onPress={() => navigation.goBack()} />

            <View style={styles.heroHeaderTextWrap}>
              <Text style={styles.heroTitle}>glovebox</Text>
              <Text style={styles.heroSubtitle}>vehicle document hub</Text>
            </View>

            <View style={styles.securedBadge}>
              <Lock size={14} color="#00d084" />
              <Text style={styles.securedBadgeText}>secured</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={[styles.statCard, styles.statCardNeutral, { width: statCardWidth, height: statCardHeight }]}>
              <Text style={[styles.statValue, { fontSize: statValueSize, lineHeight: statValueLineHeight }]}>
                {verifiedDocumentsCount}
              </Text>
              <Text style={[styles.statLabel, { fontSize: statLabelSize, lineHeight: statLabelSize + 3 }]}>READY</Text>
            </View>
            <View style={[styles.statCard, styles.statCardReview, { width: statCardWidth, height: statCardHeight }]}>
              <Text style={[styles.statValue, styles.statValueAmber, { fontSize: statValueSize, lineHeight: statValueLineHeight }]}>
                {reviewDocumentsCount}
              </Text>
              <Text style={[styles.statLabel, { fontSize: statLabelSize, lineHeight: statLabelSize + 3 }]}>REVIEW</Text>
            </View>
            <View style={[styles.statCard, styles.statCardDanger, { width: statCardWidth, height: statCardHeight }]}>
              <Text style={[styles.statValue, styles.statValueRed, { fontSize: statValueSize, lineHeight: statValueLineHeight }]}>
                {missingDocumentsCount}
              </Text>
              <Text style={[styles.statLabel, { fontSize: statLabelSize, lineHeight: statLabelSize + 3 }]}>MISSING</Text>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>YOUR VEHICLE</Text>
            <TouchableOpacity onPress={() => navigation.navigate('VehicleList')}>
              <Text style={styles.sectionActionLink}>+ Add vehicle</Text>
            </TouchableOpacity>
          </View>

          {primaryVehicle ? (
            <View style={styles.vehicleCard}>
              <View style={styles.vehicleCardTop}>
                <View style={styles.primaryChip}>
                  <View style={styles.primaryChipDot} />
                  <Text style={styles.primaryChipText}>ACTIVE PRIMARY</Text>
                </View>

                <TouchableOpacity
                  style={styles.vehicleDetailsChip}
                  onPress={() =>
                    navigation.navigate('VehicleDetails', {
                      vehicleId: primaryVehicle.id,
                      initialTab: 'Details',
                    })
                  }
                >
                  <Text style={styles.vehicleDetailsChipText}>View details {'>'}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.vehicleCardDivider} />

              <View style={styles.vehicleCardBody}>
                <View style={styles.vehicleIllustrationWrap}>
                  <Image
                    source={vehicleImageSource as any}
                    style={styles.vehicleIllustration}
                    resizeMode="contain"
                    onError={() => setVehicleImageError(true)}
                  />
                </View>

                <View style={styles.vehicleCardCenter}>
                  <Text style={styles.vehicleCardTitle}>
                    {primaryVehicle.model?.toUpperCase() ||
                      primaryVehicle.registrationNumber ||
                      'VEHICLE'}
                  </Text>
                  <View style={styles.vehiclePlateWrap}>
                    <INDPlate number={primaryVehicle.registrationNumber} />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              activeOpacity={0.9}
              style={styles.vehicleEmptyCard}
              onPress={() => navigation.navigate('VehicleList')}
            >
              <View style={styles.vehicleEmptyTopRow}>
                <View style={styles.primaryChip}>
                  <View style={styles.primaryChipDot} />
                  <Text style={styles.primaryChipText}>NO PRIMARY VEHICLE</Text>
                </View>
                <Text style={styles.vehicleDetailsChipText}>View details {'>'}</Text>
              </View>
              <View style={styles.vehicleCardDivider} />
              <View style={styles.vehicleEmptyBody}>
                <View style={styles.vehicleEmptyIconWrap}>
                  <MaterialIcon name="directions-car" size={30} color="#f59e0b" />
                </View>
                <View style={styles.vehicleEmptyTextWrap}>
                  <Text style={styles.vehicleEmptyTitle}>Add your first vehicle</Text>
                  <Text style={styles.vehicleEmptySubtitle}>
                    Select a vehicle from your garage to manage documents.
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.docHealthCard}>
            <View style={styles.docHealthTopRow}>
              <View style={styles.docHealthCopy}>
                <Text style={styles.docHealthEyebrow}>DOC HEALTH SCORE</Text>
                <View style={styles.docHealthScoreRow}>
                  <Text style={styles.docHealthScoreValue}>
                    {documentHealthScoreText}
                  </Text>
                  <Text style={styles.docHealthScoreSuffix}>/ 100</Text>
                </View>
                <Text style={styles.docHealthSummary}>{documentHealthSubtitle}</Text>
              </View>

              <View style={styles.docHealthRingColumn}>
                <DocumentHealthRing score={documentHealthScore} />
                <View
                  style={[
                    styles.docHealthBadge,
                    {
                      backgroundColor: documentHealthBadgeBg,
                      borderColor: documentHealthBadgeBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.docHealthBadgeText,
                      {color: documentHealthBadgeTone},
                    ]}
                  >
                    {documentHealthBadgeText}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.docHealthBars}>
              {Array.from({length: healthSegmentCount}).map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.docHealthBar,
                    index < filledHealthSegments && styles.docHealthBarActive,
                  ]}
                />
              ))}
            </View>

            <View style={styles.docHealthActions}>
              <TouchableOpacity
                style={styles.docHealthPrimaryAction}
                onPress={handlePriorityAction}
              >
                <Text style={styles.docHealthPrimaryActionText}>
                  {primaryHealthActionLabel}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>VEHICLE DOCUMENTS</Text>
          </View>

          <View style={styles.documentSectionCard}>
            <View style={styles.documentList}>
              {documentGridRows.map((row, rowIndex) => (
                <View
                  key={`doc-row-${rowIndex}`}
                  style={[
                    styles.documentGridRow,
                    rowIndex > 0 && styles.documentGridRowSpacing,
                  ]}
                >
                  {row.map(type => (
                    <DocumentRow key={type} type={type} />
                  ))}
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.92}
            style={styles.digiLockerCard}
            onPress={handleConnectDigiLocker}
          >
            <View style={styles.digiLockerHeadlineWrap}>
              <Text
                style={[
                  styles.digiLockerHeadline,
                  {
                    fontSize: digiLockerHeadlineSize,
                    lineHeight: digiLockerHeadlineSize + 8,
                  },
                ]}
              >
                Link your RC, Insurance & DL from your DigiLocker account
              </Text>
            </View>

            <View
              style={[
                styles.digiLockerBottomRow,
                digiLockerCompact && styles.digiLockerBottomRowCompact,
              ]}
            >
              <View
                style={[
                  styles.digiLockerLeft,
                  digiLockerCompact && styles.digiLockerLeftCompact,
                ]}
              >
                <View
                  style={[
                    styles.digiLockerLogoWrap,
                    {
                      width: digiLockerLogoSize,
                      height: digiLockerLogoSize,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.digiLockerLogoSheet,
                      {
                        width: digiLockerSheetSize,
                        height: digiLockerSheetSize,
                        borderRadius: Math.round(digiLockerSheetSize * 0.28),
                      },
                    ]}
                  >
                    <View style={styles.digiLockerLogoFold} />
                    <FileText
                      size={Math.max(20, Math.round(digiLockerSheetSize * 0.58))}
                      color="#f4f2ff"
                      strokeWidth={2.15}
                    />
                  </View>
                  <View style={styles.digiLockerLogoBadge}>
                    <Cloud size={12} color="#5f43f7" strokeWidth={2.6} />
                    <Lock size={8} color="#5f43f7" strokeWidth={2.8} style={styles.digiLockerLogoLock} />
                  </View>
                </View>
                <View style={styles.digiLockerTextWrap}>
                  <Text
                    style={[
                      styles.digiLockerTitle,
                      {
                        fontSize: digiLockerBrandTitleSize,
                        lineHeight: digiLockerBrandTitleSize + 3,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    DigiLocker
                  </Text>
                  <Text
                    style={[
                      styles.digiLockerSubtitle,
                      {
                        fontSize: digiLockerBrandSubtitleSize,
                        lineHeight: digiLockerBrandSubtitleSize + 4,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Document Wallet to Empower Citizens
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.digiLockerActionWrap,
                  digiLockerCompact && styles.digiLockerActionWrapCompact,
                ]}
              >
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.digiLockerActionChip,
                    digiLockerCompact && styles.digiLockerActionChipCompact,
                  ]}
                  onPress={handleConnectDigiLocker}
                  accessibilityRole="button"
                >
                  <Link size={15} color="#f4f2ff" strokeWidth={2.5} />
                  <Text
                    style={[
                      styles.digiLockerActionText,
                      {
                        fontSize: digiLockerChipTextSize,
                        lineHeight: digiLockerChipTextSize + 4,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    Link DigiLocker
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableOpacity>

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                documents.length === 0 && styles.bottomActionButtonMuted,
              ]}
              onPress={handleDownloadAll}
            >
              <Download size={18} color="#FFF" />
              <Text style={styles.bottomActionText}>Download all</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bottomActionButton,
                styles.bottomActionButtonOutline,
                documents.length === 0 && styles.bottomActionButtonMuted,
              ]}
              onPress={handleShareAll}
            >
              <Share2 size={18} color="#FFF" />
              <Text style={styles.bottomActionText}>Share docs</Text>
            </TouchableOpacity>
          </View>

          <View style={{height: 32}} />
        </View>
      </ScrollView>

      {isUploading || loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#f59e0b" />
          {isUploading ? (
            <Text style={styles.loaderText}>Uploading document...</Text>
          ) : null}
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

      {/* Status Feedback Modal (Success/Delete/Error) */}
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />

      {/* Confirmation Modal (Delete/DigiLocker) */}
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
  container: { flex: 1, backgroundColor: '#050505' },
  screenContent: {
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 28,
  },
  page: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 18,
  },
  heroHeaderTextWrap: {
    flex: 1,
    marginLeft: 12,
    flexDirection: 'column',
    alignItems: 'flex-start',
    flexShrink: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: '#fff',
    fontSize: Math.max(24, Math.min(30, width * 0.072)),
    lineHeight: 31,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'lowercase',
    textAlign: 'left',
  },
  heroSubtitle: {
    color: '#666a73',
    fontSize: Math.max(10, Math.min(12, width * 0.03)),
    lineHeight: 15,
    fontFamily: 'Outfit-Medium',
    marginLeft: 0,
    marginTop: 3,
    textTransform: 'lowercase',
    textAlign: 'left',
  },
  securedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.20)',
    backgroundColor: 'rgba(16,185,129,0.10)',
  },
  securedBadgeText: {
    color: '#16c784',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Outfit-Medium',
    textTransform: 'lowercase',
  },
  docHealthCard: {
    backgroundColor: '#131313',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#2a2a2f',
    paddingHorizontal: 22,
    paddingVertical: 20,
    marginTop: 16,
  },
  docHealthTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  docHealthCopy: {
    flex: 1,
    paddingRight: 4,
  },
  docHealthEyebrow: {
    color: '#7f7f88',
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  docHealthScoreRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: 6,
  },
  docHealthScoreValue: {
    color: '#fff',
    fontSize: 72,
    lineHeight: 72,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    letterSpacing: -3,
  },
  docHealthScoreSuffix: {
    color: '#6d6d74',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Outfit-Medium',
    marginBottom: 8,
    marginLeft: 4,
  },
  docHealthSummary: {
    color: '#8b8b93',
    fontSize: 15,
    lineHeight: 19,
    fontFamily: 'Outfit-Regular',
    marginTop: 8,
  },
  docHealthRingColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    width: 104,
    paddingTop: 6,
  },
  docHealthRing: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHealthRingSpin: {
    width: 104,
    height: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHealthRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docHealthRingText: {
    color: '#f59e0b',
    fontSize: 28,
    lineHeight: 30,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
  },
  docHealthBadge: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    minWidth: 86,
    alignItems: 'center',
  },
  docHealthBadgeText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    textTransform: 'lowercase',
  },
  docHealthBars: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 20,
  },
  docHealthBar: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#26262d',
  },
  docHealthBarActive: {
    backgroundColor: '#f59e0b',
  },
  docHealthActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  docHealthPrimaryAction: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.24)',
    backgroundColor: 'rgba(34,197,94,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  docHealthPrimaryActionText: {
    color: '#22c55e',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
  docHealthSecondaryAction: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  docHealthSecondaryActionText: {
    color: '#60606a',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    alignItems: 'stretch',
  },
  statCard: {
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    flexGrow: 0,
    flexShrink: 0,
  },
  statCardNeutral: {
    backgroundColor: '#111214',
    borderColor: '#2b2b31',
  },
  statCardReview: {
    backgroundColor: 'rgba(245,158,11,0.18)',
    borderColor: 'rgba(245,158,11,0.28)',
  },
  statCardDanger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(239,68,68,0.28)',
  },
  statValue: {
    color: '#fff',
    fontSize: 44,
    lineHeight: 46,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
  },
  statValueAmber: {
    color: '#f59e0b',
  },
  statValueRed: {
    color: '#ef4444',
  },
  statLabel: {
    marginTop: 4,
    color: '#6e6e76',
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Outfit-Medium',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  sectionActionLink: {
    color: '#f59e0b',
    fontSize: 14,
    lineHeight: 18,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
  },
  vehicleCard: {
    marginTop: 8,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#2b2b31',
    backgroundColor: '#141414',
    overflow: 'hidden',
  },
  vehicleCardTop: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.35)',
    backgroundColor: 'rgba(16,185,129,0.10)',
  },
  primaryChipDot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    backgroundColor: '#16c784',
  },
  primaryChipText: {
    color: '#16c784',
    fontSize: 12,
    lineHeight: 14,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  vehicleDetailsChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  vehicleDetailsChipText: {
    color: '#404047',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Outfit-Medium',
  },
  vehicleCardDivider: {
    height: 1,
    backgroundColor: '#2a2a30',
  },
  vehicleCardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 20,
    gap: 10,
  },
  vehicleIllustrationWrap: {
    width: 118,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleIllustration: {
    width: 106,
    height: 76,
  },
  vehicleCardCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 0,
    paddingHorizontal: 4,
  },
  vehicleCardTitle: {
    color: '#fff',
    fontSize: 30,
    lineHeight: 32,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  vehiclePlateWrap: {
    marginTop: 10,
    alignSelf: 'center',
    transform: [{scale: 0.86}],
  },
  vehicleEmptyCard: {
    marginTop: 8,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#2b2b31',
    backgroundColor: '#141414',
    overflow: 'hidden',
  },
  vehicleEmptyTopRow: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  vehicleEmptyBody: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  vehicleEmptyIconWrap: {
    width: 70,
    height: 70,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    backgroundColor: 'rgba(245,158,11,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vehicleEmptyTextWrap: {
    flex: 1,
  },
  vehicleEmptyTitle: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 24,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
  },
  vehicleEmptySubtitle: {
    color: '#7a7a82',
    fontSize: 13,
    lineHeight: 18,
    fontFamily: 'Outfit-Regular',
    marginTop: 4,
  },
  documentList: {
    marginTop: 0,
  },
  documentGridRow: {
    flexDirection: 'row',
    gap: 8,
  },
  documentGridRowSpacing: {
    marginTop: 8,
  },
  documentSectionCard: {
    marginTop: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#24242b',
    backgroundColor: '#111214',
    padding: 10,
    overflow: 'hidden',
  },
  documentGridItem: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: '#151515',
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  documentGridTop: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    gap: 8,
  },
  documentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentGridTextWrap: {
    alignSelf: 'stretch',
    gap: 2,
  },
  documentTitle: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 16,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
  },
  documentSubtitle: {
    color: '#7c7c84',
    fontSize: 9,
    lineHeight: 12,
    fontFamily: 'Outfit-Regular',
  },
  documentGridBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  documentStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
    marginBottom: 0,
  },
  documentStatusText: {
    fontSize: 8,
    lineHeight: 10,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  digiLockerCard: {
    marginTop: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(111, 88, 255, 0.34)',
    backgroundColor: '#10162a',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  digiLockerHeadlineWrap: {
    width: '100%',
    paddingRight: 8,
  },
  digiLockerHeadline: {
    color: '#f4f2ff',
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  digiLockerBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  digiLockerBottomRowCompact: {
    alignItems: 'stretch',
    flexDirection: 'column',
  },
  digiLockerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
    minWidth: 0,
  },
  digiLockerLeftCompact: {
    flex: 0,
    width: '100%',
    paddingRight: 0,
  },
  digiLockerLogoWrap: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(158, 144, 255, 0.34)',
    backgroundColor: 'rgba(99, 73, 244, 0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  digiLockerLogoSheet: {
    borderRadius: 12,
    backgroundColor: '#6a4cff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6a4cff',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  digiLockerLogoFold: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderTopRightRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  digiLockerLogoBadge: {
    position: 'absolute',
    left: 2,
    bottom: 2,
    width: 24,
    height: 18,
    borderRadius: 10,
    backgroundColor: '#f4f2ff',
    borderWidth: 1,
    borderColor: 'rgba(111, 88, 255, 0.32)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  digiLockerLogoLock: {
    position: 'absolute',
    bottom: 1,
    left: 8,
  },
  digiLockerTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  digiLockerTitle: {
    color: '#8e7bff',
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  digiLockerSubtitle: {
    color: '#b7c0f8',
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
  },
  digiLockerActionWrap: {
    flexShrink: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 0,
  },
  digiLockerActionWrapCompact: {
    alignSelf: 'stretch',
    width: '100%',
    alignItems: 'stretch',
  },
  digiLockerActionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#111111',
  },
  digiLockerActionChipCompact: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  digiLockerActionText: {
    color: '#f4f2ff',
    lineHeight: 18,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  bottomActionButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  bottomActionButtonOutline: {
    borderColor: 'rgba(255,255,255,0.10)',
  },
  bottomActionButtonMuted: {
    opacity: 0.38,
  },
  bottomActionText: {
    color: '#e5e7eb',
    fontSize: 15,
    lineHeight: 18,
    fontFamily: 'Outfit-Bold',
    fontWeight: '700',
  },
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
  healthOverviewRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  healthMetricCard: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  healthMetricValue: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
  },
  healthMetricWarning: {
    color: '#F59E0B',
  },
  healthMetricLabel: {
    marginTop: 4,
    color: '#8E8E93',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextActionCard: {
    marginTop: 18,
    backgroundColor: '#0E1218',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1B2230',
  },
  nextActionHeader: {
    marginBottom: 10,
  },
  nextActionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  nextActionCaption: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  nextActionBody: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Outfit-Regular',
  },
  nextActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  nextActionPrimaryBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextActionPrimaryText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  nextActionSecondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B3648',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  nextActionSecondaryText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },

  // DigiLocker Banner
  digiBanner: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, marginTop: 32 },
  digiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  digiContentLeft: { flex: 1, paddingRight: 16 },
  digiTitle: { fontSize: 16, fontFamily: 'Outfit-Bold', color: '#000', lineHeight: 22, fontWeight: '700', marginBottom: 12 },
  digiGraphic: { width: 75, alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: -10, marginRight: -4 },
  digiImage: { width: 75, height: 75 },

  digiBtn: { backgroundColor: '#111', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  digiBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  digiLogoPlaceholder: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  digiBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Outfit-Bold', fontWeight: '600', marginRight: 12 },

  // Sections
  sectionHeaderRow: {
    marginTop: 28,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Outfit-Bold',
    color: '#6d6d76',
    letterSpacing: 1.4,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  vehicleSummaryCard: {
    backgroundColor: '#0F0F0F',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#222',
    marginBottom: 32,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  primaryBadge: {
    position: 'absolute',
    top: 0,
    left: 16,
    backgroundColor: '#FFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  primaryBadgeText: {
    fontSize: 8,
    fontFamily: 'Outfit-Black',
    color: '#000',
    letterSpacing: 1,
  },
  vehicleThumbWrap: { 
    width: 80, 
    height: 80, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  vehicleThumb: { width: 70, height: 70 },
  vehicleInfo: { flex: 1, marginLeft: 8, justifyContent: 'center' },
  vehicleName: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Bold', fontWeight: '800' },
  plateWrap: { alignSelf: 'flex-start', transform: [{ scale: 0.75 }], marginLeft: -18, marginTop: 4 },
  vehicleActions: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 4,
  },
  viewDetailsBtn: {
    backgroundColor: '#222',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  viewDetailsText: { 
    color: '#FFF', 
    fontSize: 10, 
    fontFamily: 'Outfit-Bold',
  },
  noVehicleCard: {
    backgroundColor: '#0A0A0A',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
    gap: 16,
  },
  noVehicleIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#222',
  },
  noVehicleContent: {
    flex: 1,
  },
  noVehicleTitle: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  noVehicleDesc: {
    color: '#666',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
    marginTop: 4,
    lineHeight: 18,
  },
  gloveboxGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  personalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  slotContainer: { width: (width - 72) / 3, gap: 12 },
  slotBox: { width: '100%', aspectRatio: 1, backgroundColor: '#0A0A0A', borderRadius: 14, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  slotLabel: { fontSize: 11, fontFamily: 'Outfit-Medium', color: '#8E8E93', textTransform: 'lowercase', textAlign: 'center' },
  slotStatusBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: -4,
  },
  slotStatusText: {
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  slotHint: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: -6,
    lineHeight: 14,
  },

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

  // Status Modal Styles
  statusModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  statusModalContent: {
    width: '100%',
    backgroundColor: '#121212',
    borderRadius: 32,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  statusIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusIconCircleSuccess: {
    backgroundColor: 'rgba(0, 200, 83, 0.1)',
  },
  statusIconCircleDelete: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
  },
  statusTitle: {
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 14,
    fontFamily: 'Outfit-Regular',
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 20,
  },
  statusActionBtn: {
    width: '100%',
    backgroundColor: '#FFF',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  statusActionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#000',
    fontWeight: '700',
  },

  // Confirm Modal Specifics
  confirmActionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#1A1A1A',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  confirmCancelText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#8E8E93',
  },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#FF453A',
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  confirmDeleteText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
  },
});
