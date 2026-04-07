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
  Alert,
  PermissionsAndroid,
  Linking,
} from 'react-native';
// @ts-ignore
import { generatePDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, ArrowRight, Car } from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes } from '@react-native-documents/picker';
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
import { vehicleService, Vehicle } from '../../services/vehicleService';
import { uploadDocument, connectDigiLocker, syncDigiLocker } from '../../services/documentService';
import { getNetworkOnlineState } from '../../services/api';
import { queueDocumentUpload, flushQueuedDocumentUploads } from '../../services/offlineMutationQueue';
import StatusModal from '../../components/common/Modals/StatusModal';
import ConfirmModal from '../../components/common/Modals/ConfirmModal';
import DocumentsHeader from '../../components/Documents/DocumentsHeader';
import DocumentHealthSection from '../../components/Documents/DocumentHealthSection';
import DigiLockerBanner from '../../components/Documents/DigiLockerBanner';
import VehicleSummaryCard from '../../components/Documents/VehicleSummaryCard';
import DocumentSlot from '../../components/Documents/DocumentSlot';
import DocumentSourceModal from '../../components/Documents/DocumentSourceModal';
import DocumentViewerModal from '../../components/Documents/DocumentViewerModal';
const REQUIRED_DOCS = [
  { type: 'RC', label: 'reg certificate' },
  { type: 'Insurance', label: 'insurance policy' },
  { type: 'PUC', label: 'puc certificate' },
  { type: 'DL', label: 'driving license' },
] as const;

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const dispatch = useAppDispatch();
  const { documents: allStoreDocuments, loading } = useAppSelector((state: RootState) => state.documents);
  const [primaryVehicle, setPrimaryVehicle] = useState<Vehicle | null>(null);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [showViewerModal, setShowViewerModal] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<string>('');
  const [viewingDoc, setViewingDoc] = useState<DocumentItem | null>(null);
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

  const handleDocumentSlotPress = (type: string) => {
    const doc = getDocByType(type);
    if (doc) {
      setViewingDoc(doc);
      setShowViewerModal(true);
      return;
    }
    openDocumentFlow(type);
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <DocumentsHeader
        totalDocs={totalDocs}
        maxDocs={MAX_DOCS}
        progressPercent={progressPercent}
        onBackPress={() => navigation.goBack()}
      />

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
        <DocumentHealthSection
          healthyCount={healthyRequiredDocs.length}
          reviewCount={expiringRequiredDocs.length + expiredRequiredDocs.length}
          missingItems={missingRequiredDocs}
          reviewItems={[...expiredRequiredDocs, ...expiringRequiredDocs]}
          onPrimaryAction={handlePriorityAction}
          onSecondaryAction={handleConnectDigiLocker}
        />

        <DigiLockerBanner hasDocuments={totalDocs > 0} onPress={handleConnectDigiLocker} />

        {/* Your Vehicle Documents */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>YOUR VEHICLE DOCUMENTS</Text>
        </View>

        {primaryVehicle ? (
          <VehicleSummaryCard
            vehicle={primaryVehicle}
            onViewDetails={() => navigation.navigate('VehicleDetails', {
              vehicleId: primaryVehicle.id,
              initialTab: 'Details'
            })}
          />
        ) : (
          <TouchableOpacity 
            style={styles.noVehicleCard}
            onPress={() => navigation.navigate('VehicleList')}
          >
            <View style={styles.noVehicleIcon}>
               <Car size={32} color="#8E8E93" />
            </View>
            <View style={styles.noVehicleContent}>
               <Text style={styles.noVehicleTitle}>No primary vehicle set</Text>
               <Text style={styles.noVehicleDesc}>Tap to select a vehicle from your garage to manage documents.</Text>
            </View>
            <ArrowRight size={20} color="#666" />
          </TouchableOpacity>
        )}

        <View style={styles.gloveboxGrid}>
          <DocumentSlot
            label="RC Front"
            document={getDocByType('RC')}
            onPress={() => handleDocumentSlotPress('RC')}
          />
          <DocumentSlot
            label="Insurance"
            document={getDocByType('Insurance')}
            onPress={() => handleDocumentSlotPress('Insurance')}
          />
          <DocumentSlot
            label="PUC"
            document={getDocByType('PUC')}
            onPress={() => handleDocumentSlotPress('PUC')}
          />
        </View>

        {/* Your Personal Documents */}
        <View style={[styles.sectionHeaderRow, { marginTop: 40 }]}>
          <Text style={styles.sectionTitle}>YOUR PERSONAL DOCUMENTS</Text>
        </View>

        <View style={styles.personalGrid}>
          <DocumentSlot
            label="Driving License"
            document={getDocByType('DL')}
            onPress={() => handleDocumentSlotPress('DL')}
          />
        </View>

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
          {isUploading && <Text style={styles.loaderText}>Uploading document...</Text>}
        </View>
      ) : null}

      <DocumentSourceModal
        visible={showSourceModal}
        onClose={() => setShowSourceModal(false)}
        onTakePhoto={() => {
          setShowSourceModal(false);
          handleTakePhoto(selectedDocType);
        }}
        onPickImage={() => {
          setShowSourceModal(false);
          handlePickImage(selectedDocType);
        }}
        onPickDocument={() => {
          setShowSourceModal(false);
          handlePickDocument(selectedDocType);
        }}
      />

      <DocumentViewerModal
        visible={showViewerModal}
        document={viewingDoc}
        vehicle={primaryVehicle}
        onClose={() => setShowViewerModal(false)}
        onDelete={(doc) => handleDeleteDoc(doc.id, doc.type)}
        onShare={handleShareDoc}
        onDownload={handleDownloadDoc}
      />

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
  container: { flex: 1, backgroundColor: '#000000' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingTop: 0 },
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
    borderColor: '#222',
  },
  actionBtnOutline: { backgroundColor: 'transparent', borderColor: '#333' },
  actionBtnText: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', fontWeight: '700' },
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  loaderText: { color: '#FFF', marginTop: 16, fontFamily: 'Outfit-Medium', fontSize: 14 },
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
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 2,
  },
});
