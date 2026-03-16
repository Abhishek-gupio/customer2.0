import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
  Share,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Modal,
  Linking,
  Image as RNImage,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PinchGestureHandler, PanGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { RouteProp } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import type { RootState } from '../../store';
import { removeDocumentAsync, fetchDocumentById } from '../../store/slices/documentsSlice';
import { getAbsoluteUrl } from '../../config';
import { jsPDF } from 'jspdf';
import RNFS from 'react-native-fs';
import BackButton from '../../components/BackButton';

/** Open share sheet. Uses react-native-share if the native module is linked, otherwise falls back to RN Share. */
async function openShare(options: { fileUrl: string; fileName?: string; type?: string }): Promise<void> {
  const { fileUrl, fileName = 'Document', type = 'application/pdf' } = options;
  try {
    const RNShare = (require('react-native-share') as any).default;
    await RNShare.open({
      urls: [fileUrl],
      type,
      title: fileName,
      subject: fileName,
      failOnCancel: false,
    });
  } catch {
    await Share.share({
      url: fileUrl,
      message: fileName,
      title: fileName,
    });
  }
}

type DetailNavProp = NativeStackNavigationProp<RootStackParamList, 'DocumentDetail'>;

function statusColor(s: string) {
  if (s === 'verified') return '#4CAF50';
  if (s === 'expiring') return '#FFA000';
  return '#F44336';
}

function statusLabel(s: string) {
  if (s === 'verified') return 'Verified';
  if (s === 'expiring') return 'Expiring Soon';
  return 'Expired';
}

function formatDate(dateVal?: string | number | null): string {
  if (!dateVal) return 'N/A';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateVal);
  }
}

interface Props {
  route: RouteProp<RootStackParamList, 'DocumentDetail'>;
}

export default function DocumentDetail({ route }: Props) {
  const navigation = useNavigation<DetailNavProp>();
  const dispatch = useAppDispatch();
  const { documentId } = route.params;
  const doc = useAppSelector((state: RootState) =>
    state.documents.documents.find((d) => d.id === documentId),
  );
  const [deleting, setDeleting] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  // Animation handling for pinch-to-zoom (similar to MyProfile pattern)
  const zoomScale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const lastScale = useRef(1);
  const lastOffset = useRef({ x: 0, y: 0 });

  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: zoomScale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current *= event.nativeEvent.scale;
      if (lastScale.current < 1) {
        lastScale.current = 1;
        Animated.spring(zoomScale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      }
    }
  };

  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastOffset.current.x += event.nativeEvent.translationX;
      lastOffset.current.y += event.nativeEvent.translationY;
      translateX.setOffset(lastOffset.current.x);
      translateX.setValue(0);
      translateY.setOffset(lastOffset.current.y);
      translateY.setValue(0);
    }
  };

  const resetZoom = () => {
    lastScale.current = 1;
    lastOffset.current = { x: 0, y: 0 };
    zoomScale.setValue(1);
    translateX.setOffset(0);
    translateX.setValue(0);
    translateY.setOffset(0);
    translateY.setValue(0);
    setShowFullImage(false);
  };

  useEffect(() => {
    if (!doc) {
      dispatch(fetchDocumentById(documentId));
    }
  }, [doc, documentId, dispatch]);

  const handleDelete = () => {
    if (!doc) return;
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await dispatch(removeDocumentAsync(documentId)).unwrap();
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const imageUri = doc?.imageUri;
  const fullImageUri = imageUri ? getAbsoluteUrl(imageUri) : null;

  const isPdf = imageUri?.toLowerCase().endsWith('.pdf');
  const isImage = imageUri && !isPdf;

  const getReadyDocumentPath = async () => {
    if (!fullImageUri) throw new Error('Download link not available');

    const fileName = `${(doc?.type || 'Document').replace(/\s+/g, '_')}_${Date.now()}`;
    const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}${isPdf ? '.pdf' : '.jpg'}`;

    // 1. Download source file
    if (fullImageUri.startsWith('http')) {
      const downloadResult = await RNFS.downloadFile({
        fromUrl: fullImageUri,
        toFile: tempPath,
      }).promise;
      if (downloadResult.statusCode !== 200) throw new Error('Failed to download source file');
    } else {
      await RNFS.copyFile(fullImageUri.replace('file://', ''), tempPath).catch(() => null);
    }

    let finalPdfPath = tempPath;

    // 2. Convert to PDF if image
    if (!isPdf) {
      const base64Data = await RNFS.readFile(tempPath, 'base64');
      const imgType = fullImageUri.toLowerCase().endsWith('.png') ? 'PNG' : 'JPEG';

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 30;
      const maxWidth = pageWidth - (margin * 2);
      const maxHeight = pageHeight - (margin * 2);

      pdf.addImage(`data:image/${imgType.toLowerCase()};base64,${base64Data}`, imgType, margin, margin, maxWidth, maxHeight, undefined, 'FAST');

      const pdfBase64 = pdf.output('datauristring').split(',')[1];
      // Use CachesDirectoryPath for sharing compatibility on Android
      finalPdfPath = `${RNFS.CachesDirectoryPath}/${fileName}.pdf`;
      await RNFS.writeFile(finalPdfPath, pdfBase64, 'base64');
      await RNFS.unlink(tempPath).catch(() => null);
    }

    // Ensure the returned filename has the correct extension for the intent
    const finalFileName = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;

    return { path: finalPdfPath, fileName: finalFileName };
  };

  const handleDownload = async () => {
    try {
      Alert.alert('Processing', 'Preparing your document...');
      const { path, fileName } = await getReadyDocumentPath();

      if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
        try {
          const publicPath = `${RNFS.DownloadDirectoryPath}/${fileName}`;
          await RNFS.copyFile(path, publicPath);
          Alert.alert('Download Complete', 'Document saved to your Downloads folder.', [
            {
              text: 'Open/Share',
              onPress: () => openShare({ fileUrl: `file://${publicPath}`, fileName }).catch(() => null)
            },
            { text: 'OK' }
          ]);
          return;
        } catch (err) {
          console.log('Android Save Error:', err);
        }
      }

      openShare({ fileUrl: `file://${path}`, fileName }).catch(() => null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Processing failed');
    }
  };

  const handleShare = async () => {
    try {
      Alert.alert('Preparing Share', 'Generating document PDF...');
      const { path, fileName } = await getReadyDocumentPath();

      const fileUrl = `file://${path}`;

      await openShare({ fileUrl, fileName, type: 'application/pdf' });
    } catch (err: any) {
      console.error('Share Error Detail:', err);
      Alert.alert('Error', err.message || 'Share failed');
    }
  };

  if (!doc) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => navigation.goBack()} />
          <Text style={styles.headerTitle}>Document</Text>
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#FFBF00" />
          <Text style={styles.emptyStateText}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }




  const fields: { label: string; value: string }[] = [];
  if (doc.documentNumber) fields.push({ label: 'Doc Number', value: doc.documentNumber });

  const displayExpiry = doc.expiryDate;

  if (displayExpiry) {
    fields.push({ label: 'Expiry', value: formatDate(displayExpiry) });
  }

  if (doc.issuerName) fields.push({ label: 'Issuer', value: doc.issuerName });
  if (doc.vehicle) fields.push({ label: 'Vehicle', value: doc.vehicle });

  if (doc.extractedFields) {
    const ef = doc.extractedFields;
    if (ef.ownerName && !fields.find((f) => f.label === 'Owner'))
      fields.push({ label: 'Owner', value: ef.ownerName });
    if (ef.vehicleDetails?.make)
      fields.push({ label: 'Make', value: ef.vehicleDetails.make });
    if (ef.vehicleDetails?.model)
      fields.push({ label: 'Model', value: ef.vehicleDetails.model });
    if (ef.vehicleDetails?.engineNumber)
      fields.push({ label: 'Engine No', value: ef.vehicleDetails.engineNumber });
    if (ef.vehicleDetails?.chassisNumber)
      fields.push({ label: 'Chassis No', value: ef.vehicleDetails.chassisNumber });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {doc.type} {doc.vehicle ? `– ${doc.vehicle}` : ''}
        </Text>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteBtn}
          activeOpacity={0.85}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#F44336" />
          ) : (
            <Icon name="trash-alt" size={wp(4.5)} color="#F44336" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Document Preview */}
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => (isImage ? setShowFullImage(true) : isPdf ? setShowPdf(true) : null)}
          style={styles.previewCard}
        >
          {isImage ? (
            <Image
              source={{ uri: fullImageUri || '' }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : isPdf ? (
            <View style={styles.previewPlaceholder}>
              <Icon name="file-pdf" size={wp(14)} color="#FFBF00" />
              <Text style={styles.previewText}>Tap to view PDF</Text>
            </View>
          ) : (
            <View style={styles.previewPlaceholder}>
              <Icon name="file-alt" size={wp(14)} color="#555" />
              <Text style={styles.previewText}>No Preview</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Status */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <View
                style={[styles.statusDot, { backgroundColor: statusColor(doc.status) }]}
              />
              <Text style={[styles.statusText, { color: statusColor(doc.status) }]}>
                {statusLabel(doc.status)}
              </Text>
            </View>
          </View>
        </View>

        {/* Extracted Fields */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Icon name="magic" size={wp(4)} color="#FFBF00" style={{ marginRight: wp(2) }} />
            <Text style={styles.sectionTitle}>Document Details</Text>
          </View>

          <View style={styles.fieldCard}>
            {fields.length > 0 ? (
              fields.map((f, i) => (
                <FieldRow key={f.label} label={f.label} value={f.value} last={i === fields.length - 1} />
              ))
            ) : (
              <View style={styles.noOcrRow}>
                <Text style={styles.noOcrText}>No details extracted yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.shareBtn}
            onPress={handleShare}
          >
            <Icon name="share-alt" size={wp(4.5)} color="#000" style={{ marginRight: wp(2) }} />
            <Text style={styles.shareBtnText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.85}
            style={styles.downloadBtn}
            onPress={handleDownload}
          >
            <Icon name="download" size={wp(4.5)} color="#fff" style={{ marginRight: wp(2) }} />
            <Text style={styles.downloadBtnText}>Download</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full Image Modal */}
      <Modal
        visible={showFullImage}
        transparent={false}
        animationType="fade"
        onRequestClose={resetZoom}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={resetZoom} style={styles.modalCloseBtn}>
                <Icon name="times" size={wp(6)} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Image Preview</Text>
              <TouchableOpacity onPress={handleDownload} style={styles.modalDownloadIcon}>
                <Icon name="download" size={wp(5)} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalImageWrap}>
              <PanGestureHandler
                onGestureEvent={onPanEvent}
                onHandlerStateChange={onPanStateChange}
              >
                <Animated.View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
                  <PinchGestureHandler
                    onGestureEvent={onPinchEvent}
                    onHandlerStateChange={onPinchStateChange}
                  >
                    <Animated.Image
                      source={{ uri: fullImageUri || '' }}
                      style={[
                        styles.modalFullImage,
                        {
                          transform: [
                            { scale: zoomScale },
                            { translateX: translateX },
                            { translateY: translateY },
                          ]
                        }
                      ]}
                      resizeMode="contain"
                    />
                  </PinchGestureHandler>
                </Animated.View>
              </PanGestureHandler>
            </View>
          </SafeAreaView>
        </GestureHandlerRootView>
      </Modal>

      {/* PDF View Modal placeholder */}
      {showPdf && (
        <Modal
          visible={showPdf}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setShowPdf(false)}
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <BackButton onPress={() => setShowPdf(false)} />
              <Text style={styles.modalTitle}>PDF Viewer</Text>
              <TouchableOpacity onPress={handleDownload} style={styles.modalDownloadIcon}>
                <Icon name="download" size={wp(5)} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1, backgroundColor: '#eee' }}>
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="file-pdf" size={wp(14)} color="#FFBF00" />
                <Text style={{ marginTop: hp(2), color: '#333', fontSize: wp(4) }}>
                  Opening PDF Download Link...
                </Text>
                <TouchableOpacity
                  style={[styles.shareBtn, { marginTop: hp(3), paddingHorizontal: wp(6) }]}
                  onPress={handleDownload}
                >
                  <Text style={styles.shareBtnText}>Download to View</Text>
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>
  );
}

function FieldRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
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
  headerTitle: {
    flex: 1,
    fontSize: wp(5.5),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp(3),
  },
  deleteBtn: { padding: wp(2) },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingTop: hp(2), paddingBottom: hp(4) },

  previewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    overflow: 'hidden',
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    height: hp(30),
    justifyContent: 'center',
  },
  previewPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewText: {
    fontSize: wp(3.5),
    color: '#666',
    marginTop: hp(1.5)
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(5),
  },
  emptyStateText: { fontSize: wp(4), color: '#888', marginTop: hp(1.5) },

  infoRow: {
    flexDirection: 'row',
    gap: wp(3),
    marginBottom: hp(2.5),
  },
  infoItem: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  infoLabel: {
    fontSize: wp(3.2),
    color: '#888',
    marginBottom: hp(0.8),
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusBadge: { flexDirection: 'row', alignItems: 'center' },
  statusDot: {
    width: wp(2.5),
    height: wp(2.5),
    borderRadius: wp(1.25),
    marginRight: wp(2),
  },
  statusText: { fontSize: wp(3.8), fontWeight: '600' },
  sourceBadge: { flexDirection: 'row', alignItems: 'center' },
  sourceText: { fontSize: wp(3.8), fontWeight: '600', color: '#ccc' },

  section: { marginBottom: hp(3) },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  sectionTitle: { fontSize: wp(4.5), fontWeight: '700', color: '#fff' },

  fieldCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(1.8),
    paddingHorizontal: wp(4),
  },
  fieldRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  fieldLabel: { fontSize: wp(3.5), color: '#888' },
  fieldValue: { fontSize: wp(3.8), color: '#fff', fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  noOcrRow: { padding: wp(4) },
  noOcrText: { fontSize: wp(3.5), color: '#666' },

  actionsRow: {
    flexDirection: 'row',
    gap: wp(3),
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
  },
  shareBtnText: { fontSize: wp(4), fontWeight: '700', color: '#000' },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  downloadBtnText: { fontSize: wp(4), fontWeight: '700', color: '#fff' },

  modalContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    backgroundColor: '#0a0a0a',
  },
  modalCloseBtn: {
    padding: wp(2),
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '700',
  },
  modalDownloadIcon: {
    padding: wp(2),
  },
  modalImageWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFullImage: {
    width: '100%',
    height: '100%',
  },
});
