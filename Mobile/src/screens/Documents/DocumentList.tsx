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
} from 'react-native';
// @ts-ignore
import { generatePDF } from 'react-native-html-to-pdf';
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
import BoundaryBlock from '../../components/BoundaryBlock';
import { appendCorrelationId, reportHandledError } from '../../lib/sentry';

const { width } = Dimensions.get('window');
const FALLBACK_ICON_SIZE = 40;
const REQUIRED_DOCS = [
  { type: 'RC', label: 'reg certificate' },
  { type: 'Insurance', label: 'insurance policy' },
  { type: 'PUC', label: 'puc certificate' },
  { type: 'DL', label: 'driving license' },
] as const;

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

interface DocumentSlotProps {
  label: string;
  type: string;
  documents: DocumentItem[];
  onView: (doc: DocumentItem) => void;
  onUpload: (type: string) => void;
}

const DocumentSlot = ({ label, type, documents, onView, onUpload }: DocumentSlotProps) => {
  const doc = documents.find(d => d.type === type);
  const statusMeta = getDocumentStatusMeta(doc);
  return (
    <View style={styles.slotContainer}>
      <TouchableOpacity
        style={styles.slotBox}
        onPress={() => {
          if (doc) {
            onView(doc);
          } else {
            onUpload(type);
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
      <View style={[styles.slotStatusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
        <Text style={[styles.slotStatusText, { color: statusMeta.tone }]}>{statusMeta.label}</Text>
      </View>
      <Text style={styles.slotHint}>{statusMeta.caption}</Text>
    </View>
  );
};

export default function DocumentList() {
  const ENABLE_DOCUMENTS_FEATURE_BOUNDARY_TEST = __DEV__ && false;
  const navigation = useNavigation<DocListNavProp>();
  const dispatch = useAppDispatch();
  const { documents: allStoreDocuments = [], loading = false } = useAppSelector((state: RootState) => state.documents) || {};
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<any>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loaderMessage, setLoaderMessage] = useState('Uploading document...');

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

  if (ENABLE_DOCUMENTS_FEATURE_BOUNDARY_TEST) {
    throw new Error('documents feature test');
  }

  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };
  const reportDocumentError = (
    error: unknown,
    surface: string,
    userMessage?: string,
    extras?: Record<string, unknown>,
    title = 'Something went wrong',
  ) => {
    const { correlationId } = reportHandledError(error, {
      surface,
      level: 'feature',
      extras,
    });

    if (userMessage) {
      showStatus(title, appendCorrelationId(userMessage, correlationId), 'error');
    }

    return correlationId;
  };

  useEffect(() => {
    dispatch(fetchDocuments());
    loadPrimaryVehicle();
    flushQueuedDocumentUploads((doc) => {
      dispatch(addDocumentFromResponse(toDocItem(doc)));
    }).catch((error) => {
      reportHandledError(error, {
        surface: 'documents-queued-upload-flush',
        level: 'feature',
      });
    });
  }, [dispatch]);

  const loadPrimaryVehicle = async () => {
    try {
      const vehicles = await vehicleService.getVehicles();
      const primary = vehicles.find(v => v.isPrimary);
      setPrimaryVehicle(primary || null);
    } catch (error) {
      reportHandledError(error, {
        surface: 'documents-primary-vehicle-load',
        level: 'feature',
      });
      setPrimaryVehicle(null);
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
        reportDocumentError(e, 'documents-file-picker', 'Could not pick a file.', { type }, 'Picker Error');
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
    } catch (error) {
      reportDocumentError(error, 'documents-image-picker', 'Could not pick an image.', { type }, 'Picker Error');
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
    } catch (error) {
      reportDocumentError(error, 'documents-camera-capture', 'Could not capture a photo.', { type }, 'Camera Error');
    }
  };

  const uploadImageAsset = async (asset: any, type: string) => {
    setLoaderMessage('Uploading document...');
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
      reportDocumentError(
        err,
        'documents-image-upload',
        err?.message || 'Document upload failed.',
        { type },
        'Upload Failed',
      );
    } finally {
      setIsUploading(false);
    }
  };

  const performUpload = async (type: string, uri: string, name: string, mime: string) => {
    setLoaderMessage('Uploading document...');
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
        const correlationId = reportDocumentError(
          err,
          'documents-upload',
          undefined,
          { type, mime, isNetworkError: false },
          'Upload Failed',
        );
        Alert.alert('Upload Failed', appendCorrelationId(message || 'Something went wrong', correlationId));
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
      } catch (queueError) {
        const correlationId = reportDocumentError(
          queueError,
          'documents-upload-queue',
          undefined,
          { type, mime },
          'Upload Failed',
        );
        Alert.alert('Upload Failed', appendCorrelationId(message || 'Something went wrong', correlationId));
      }
      reportDocumentError(
        err,
        'documents-upload-network',
        'Upload was saved for retry when network returns.',
        { type, mime, isNetworkError: true },
        'Saved Offline',
      );
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
      const correlationId = reportDocumentError(
        error,
        'documents-pdf-generation',
        undefined,
        { documentCount: docs.length, fileName },
        'PDF Error',
      );
      throw new Error(appendCorrelationId('Failed to generate PDF', correlationId));
    }
  };

  const handleShareAll = async () => {
    if (documents.length === 0) {
      showStatus('No Documents', 'You have no documents to share.', 'error');
      return;
    }
    try {
      setLoaderMessage('Preparing documents...');
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
        reportDocumentError(
          error,
          'documents-share-all',
          'Could not share documents.',
          { documentCount: documents.length },
          'Share Failed',
        );
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
      setLoaderMessage('Downloading documents...');
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
        } catch (shareError) {
          reportHandledError(shareError, {
            surface: 'documents-download-all-fallback-share',
            level: 'feature',
          });
        }
      }
      reportDocumentError(
        error,
        'documents-download-all',
        'Could not save all documents.',
        { documentCount: documents.length },
        'Download Failed',
      );
    }
  };

  const handleShareDoc = async (doc: any) => {
    if (!doc?.imageUri) return;
    try {
      setLoaderMessage('Preparing share...');
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
        reportDocumentError(
          error,
          'documents-share-single',
          'Could not share this document.',
          { documentType: doc?.type },
          'Share Failed',
        );
      }
    }
  };

  const handleDownloadDoc = async (doc: any) => {
    if (!doc?.id) return;
    try {
      setLoaderMessage('Downloading document...');
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
    } catch (error) {
      setIsUploading(false);
      reportDocumentError(
        error,
        'documents-download-single',
        'Could not initiate download. Please use the Share button.',
        { documentType: doc?.type },
        'Download Failed',
      );
    }
  };

  const getDocByType = (type: string) => {
    return documents.find(d => d.type === type);
  };

  const requiredDocTypes = REQUIRED_DOCS.map(doc => doc.type);
  const uploadedDocsCount = documents.filter(d => (requiredDocTypes as string[]).includes(d.type)).length;
  const MAX_DOCS = 4;
  const totalDocs = Math.min(uploadedDocsCount, MAX_DOCS);
  const progressPercent = Math.round((totalDocs / MAX_DOCS) * 100);
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
          reportDocumentError(
            err,
            'documents-delete',
            err?.message || 'Failed to delete the document.',
            { documentId: id, documentType: type },
            'Delete Failed',
          );
        }
      }
    });
  };

  const handleConnectDigiLocker = async () => {
    try {
      setLoaderMessage('Connecting to DigiLocker...');
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
            setLoaderMessage('Syncing documents...');
            setIsUploading(true);
            try {
              await syncDigiLocker(res.client_id);
              dispatch(fetchDocuments());
              showStatus('Synced', 'Documents updated from DigiLocker!');
            } catch (error) {
              reportDocumentError(
                error,
                'documents-digilocker-sync',
                'Sync failed. Please try again.',
                { clientId: res.client_id },
                'Sync Failed',
              );
            } finally {
              setIsUploading(false);
            }
          }
        });
      }
    } catch (error: any) {
      setIsUploading(false);
      reportDocumentError(
        error,
        'documents-digilocker-connect',
        error?.message || 'Could not connect to DigiLocker.',
        undefined,
        'DigiLocker Unavailable',
      );
    }
  };

  const DocumentSlot = ({ label, type }: { label: string; type: string }) => {
    const doc = getDocByType(type);
    const statusMeta = getDocumentStatusMeta(doc);
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
        <View style={[styles.slotStatusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
          <Text style={[styles.slotStatusText, { color: statusMeta.tone }]}>{statusMeta.label}</Text>
        </View>
        <Text style={styles.slotHint}>{statusMeta.caption}</Text>
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

        <View style={styles.healthOverviewRow}>
          <View style={styles.healthMetricCard}>
            <Text style={styles.healthMetricValue}>{healthyRequiredDocs.length}</Text>
            <Text style={styles.healthMetricLabel}>Ready now</Text>
          </View>
          <View style={styles.healthMetricCard}>
            <Text style={[styles.healthMetricValue, styles.healthMetricWarning]}>
              {expiringRequiredDocs.length + expiredRequiredDocs.length}
            </Text>
            <Text style={styles.healthMetricLabel}>Need review</Text>
          </View>
          <View style={styles.healthMetricCard}>
            <Text style={styles.healthMetricValue}>{missingRequiredDocs.length}</Text>
            <Text style={styles.healthMetricLabel}>Missing</Text>
          </View>
        </View>

        <BoundaryBlock
          boundaryName="documents-health-widget"
          fallbackTitle="Document health is unavailable"
          fallbackMessage="You can keep using the rest of the glovebox. Retry this block or report the issue if it keeps happening."
        >
        <View style={styles.nextActionCard}>
          <View style={styles.nextActionHeader}>
            <Text style={styles.nextActionTitle}>Document health</Text>
            <Text style={styles.nextActionCaption}>
              {missingRequiredDocs.length > 0
                ? `${missingRequiredDocs.length} document${missingRequiredDocs.length === 1 ? '' : 's'} still missing`
                : expiringRequiredDocs.length + expiredRequiredDocs.length > 0
                  ? 'A few documents need attention soon'
                  : 'Your glovebox is in good shape'}
            </Text>
          </View>

          {missingRequiredDocs.length > 0 ? (
            <Text style={styles.nextActionBody}>
              Add {missingRequiredDocs.slice(0, 2).map(item => item.label).join(' and ')} to complete your core document set.
            </Text>
          ) : expiredRequiredDocs.length + expiringRequiredDocs.length > 0 ? (
            <Text style={styles.nextActionBody}>
              Review expiry dates and keep renewal documents ready before your next drive.
            </Text>
          ) : (
            <Text style={styles.nextActionBody}>
              Everything important is stored. Linking DigiLocker can still make future refreshes easier.
            </Text>
          )}

          <View style={styles.nextActionButtons}>
            <TouchableOpacity style={styles.nextActionPrimaryBtn} onPress={handlePriorityAction}>
              <Text style={styles.nextActionPrimaryText}>
                {missingRequiredDocs.length > 0
                  ? `Add ${missingRequiredDocs[0].label}`
                  : expiredRequiredDocs.length + expiringRequiredDocs.length > 0
                    ? 'Review document'
                    : 'Link DigiLocker'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.nextActionSecondaryBtn} onPress={handleConnectDigiLocker}>
              <Text style={styles.nextActionSecondaryText}>Sync official docs</Text>
            </TouchableOpacity>
          </View>
        </View>
        </BoundaryBlock>

        {/* DigiLocker Banner */}
        <BoundaryBlock
          boundaryName="documents-digilocker-banner-widget"
          fallbackTitle="DigiLocker banner is unavailable"
          fallbackMessage="You can keep using the rest of the glovebox. Retry this block or report the issue if it keeps happening."
        >
        <View style={styles.digiBanner}>
          <View style={styles.digiRow}>
            <View style={styles.digiContentLeft}>
              {totalDocs > 0 ? (
                <Text style={styles.digiTitle}>add your official driving license to your glovebox</Text>
              ) : (
                <Text style={styles.digiTitle}>accepted as official documents by traffic police everywhere</Text>
              )}

              <TouchableOpacity style={styles.digiBtn} onPress={handleConnectDigiLocker}>
                <View style={styles.digiBtnContent}>
                  <View style={styles.digiLogoPlaceholder}>
                    <FileText size={14} color="#FFF" />
                  </View>
                  <Text style={styles.digiBtnText}>Link to Digilocker</Text>
                </View>
                <ArrowRight size={18} color="#FFF" />
              </TouchableOpacity>
            </View>
            <View style={styles.digiGraphic}>
              <Image
                source={require('../../assets/images/document.png') as any}
                style={styles.digiImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
        </BoundaryBlock>

        {/* Your Vehicle Documents */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>YOUR VEHICLE DOCUMENTS</Text>
        </View>

        {primaryVehicle ? (
          <View style={styles.vehicleSummaryCard}>
            <View style={styles.primaryBadge}>
              <Text style={styles.primaryBadgeText}>ACTIVE PRIMARY</Text>
            </View>
            <View style={styles.vehicleThumbWrap}>
              {primaryVehicle.imageUrl ? (
                <Image
                  source={{ uri: getAbsoluteUrl(primaryVehicle.imageUrl) }}
                  style={styles.vehicleThumb}
                  resizeMode="contain"
                />
              ) : (
                <MaterialIcon 
                  name={primaryVehicle.vehicleType === 'BIKE' ? 'motorcycle' : 'directions-car'} 
                  size={FALLBACK_ICON_SIZE} 
                  color="#444" 
                />
              )}
            </View>
            <View style={styles.vehicleInfo}>
              <Text style={styles.vehicleName}>{primaryVehicle.model?.toUpperCase() || 'SXL'}</Text>
              <View style={styles.plateWrap}>
                <INDPlate number={primaryVehicle.registrationNumber} />
              </View>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('VehicleDetails', {
                vehicleId: primaryVehicle.id,
                initialTab: 'Details'
              })}
              style={styles.viewDetailsBtn}
            >
              <Text style={styles.viewDetailsText}>View details</Text>
            </TouchableOpacity>
          </View>
        )}

        <BoundaryBlock
          boundaryName="documents-vehicle-grid-widget"
          fallbackTitle="Vehicle documents are unavailable"
          fallbackMessage="You can keep using the rest of the glovebox. Retry this block or report the issue if it keeps happening."
        >
        <View style={styles.gloveboxGrid}>
          <DocumentSlot 
            label="RC Front" 
            type="RC" 
            documents={documents}
            onView={(doc) => { setViewingDoc(doc); setShowViewerModal(true); }}
            onUpload={openDocumentFlow}
          />
          <DocumentSlot 
            label="Insurance" 
            type="Insurance" 
            documents={documents}
            onView={(doc) => { setViewingDoc(doc); setShowViewerModal(true); }}
            onUpload={openDocumentFlow}
          />
          <DocumentSlot 
            label="PUC" 
            type="PUC" 
            documents={documents}
            onView={(doc) => { setViewingDoc(doc); setShowViewerModal(true); }}
            onUpload={openDocumentFlow}
          />
        </View>
        </BoundaryBlock>

        {/* Your Personal Documents */}
        <View style={[styles.sectionHeaderRow, { marginTop: 40 }]}>
          <Text style={styles.sectionTitle}>YOUR PERSONAL DOCUMENTS</Text>
        </View>

        <BoundaryBlock
          boundaryName="documents-personal-grid-widget"
          fallbackTitle="Personal documents are unavailable"
          fallbackMessage="You can keep using the rest of the glovebox. Retry this block or report the issue if it keeps happening."
        >
        <View style={styles.personalGrid}>
          <DocumentSlot 
            label="Driving License" 
            type="DL" 
            documents={documents}
            onView={(doc) => { setViewingDoc(doc); setShowViewerModal(true); }}
            onUpload={openDocumentFlow}
          />
        </View>
        </BoundaryBlock>

        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleDownloadAll}
          >
            <FileText size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Download All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnOutline]}
            onPress={handleShareAll}
          >
            <ArrowRight size={20} color="#FFF" />
            <Text style={styles.actionBtnText}>Share Documents</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {isUploading || loading ? (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#FFC107" />
          {isUploading && <Text style={styles.loaderText}>{loaderMessage}</Text>}
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

      {/* ── Status Feedback Modal (Success/Delete/Error) ── */}
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />

      {/* ── Confirmation Modal (Delete/DigiLocker) ── */}
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
  sectionHeaderRow: { marginTop: 44, marginBottom: 24 },
  sectionTitle: { fontSize: 11, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 1, fontWeight: '700' },

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
    width: 70,
    height: 70,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
  },
  vehicleThumb: { width: 60, height: 60 },
  vehicleInfo: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'center',
  },
  vehicleName: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    fontWeight: '800',
    marginBottom: 4
  },
  plateWrap: {
    alignSelf: 'flex-start',
    transform: [{ scale: 0.65 }],
    marginLeft: -35,
    marginTop: -2,
  },
  vehicleActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  viewDetailsBtn: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  viewDetailsText: {
    color: '#EEE',
    fontSize: 9,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
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
