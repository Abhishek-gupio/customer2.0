import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '../../config';
import { jsPDF } from 'jspdf';
import RNFS from 'react-native-fs';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import type { RootState } from '../../store';
import { fetchDocuments } from '../../store/slices/documentsSlice';
import type { DocumentItem } from '../../store/slices/documentsSlice';

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORIES = ['All', 'RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];

const DOC_TYPE_LABELS: Record<string, string> = {
  RC: 'RC Book',
  Insurance: 'Insurance',
  PUC: 'PUC Certificate',
  FASTag: 'FASTag',
  DL: 'Driving License',
  Other: 'Other',
};

const FIXED_GRID_TYPES = ['RC', 'Insurance', 'PUC', 'DL'] as const;

type DocStatus = 'verified' | 'expiring' | 'expired';

function statusColor(s: DocStatus) {
  if (s === 'verified') return '#4CAF50';
  if (s === 'expiring') return '#FFA000';
  return '#F44336';
}
function statusLabel(s: DocStatus) {
  if (s === 'verified') return 'Verified';
  if (s === 'expiring') return 'Expiring Soon';
  return 'Expired';
}

function formatExpiry(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

async function openShare(options: { fileUrls: string[]; fileName?: string; type?: string }): Promise<void> {
  const { fileUrls, fileName = 'Documents', type = 'application/pdf' } = options;
  try {
    const RNShare = (require('react-native-share') as any).default;
    await RNShare.open({
      urls: fileUrls,
      type,
      title: fileName,
      subject: fileName,
      failOnCancel: false,
    });
  } catch {
    await Share.share({
      url: fileUrls[0],
      message: fileName,
      title: fileName,
    });
  }
}

async function getReadyDocumentPath(doc: DocumentItem) {
  const imageUri = doc.imageUri;
  const fullImageUri = imageUri
    ? imageUri.startsWith('http')
      ? imageUri
      : `${API_BASE_URL}${imageUri}`
    : null;

  if (!fullImageUri) throw new Error(`Link not available for ${doc.type}`);

  const isPdf = imageUri?.toLowerCase().endsWith('.pdf');
  const fileName = `${(doc.type || 'Document').replace(/\s+/g, '_')}_${Date.now()}`;
  const tempPath = `${RNFS.TemporaryDirectoryPath}/${fileName}${isPdf ? '.pdf' : '.jpg'}`;

  if (fullImageUri.startsWith('http')) {
    const downloadResult = await RNFS.downloadFile({
      fromUrl: fullImageUri,
      toFile: tempPath,
    }).promise;
    if (downloadResult.statusCode !== 200) throw new Error(`Failed to download ${doc.type}`);
  } else {
    await RNFS.copyFile(fullImageUri.replace('file://', ''), tempPath).catch(() => null);
  }

  let finalPdfPath = tempPath;
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
    finalPdfPath = `${RNFS.CachesDirectoryPath}/${fileName}.pdf`;
    await RNFS.writeFile(finalPdfPath, pdfBase64, 'base64');
    await RNFS.unlink(tempPath).catch(() => null);
  }
  const finalFileName = finalPdfPath.endsWith('.pdf') ? `${fileName}.pdf` : `${fileName}.pdf`;

  return { path: finalPdfPath, fileName: finalFileName };
}

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const dispatch = useAppDispatch();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);

  const { documents, loading } = useAppSelector((state: RootState) => state.documents);

  useEffect(() => {
    dispatch(fetchDocuments());
  }, [dispatch]);

  const gridCards = useMemo(() => {
    const byType = new Map<string, DocumentItem[]>();
    documents.forEach((d) => {
      const list = byType.get(d.type) ?? [];
      list.push(d);
      byType.set(d.type, list);
    });
    return FIXED_GRID_TYPES
      .filter(type => activeFilter === 'All' || activeFilter === type)
      .map((type) => {
        const docs = byType.get(type) ?? [];
        if (docs.length === 0) {
          return {
            id: `empty_${type}`,
            label: DOC_TYPE_LABELS[type] ?? type,
            expiry: 'Not uploaded',
            status: 'verified' as DocStatus,
            type,
            hasDoc: false,
          };
        }

        const docsWithExpiry = docs.filter((d) => d.expiryDate);
        let latest = docsWithExpiry.length > 0
          ? docsWithExpiry.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0]
          : docs.sort((a, b) => (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))[0];

        const expiryDate = latest.expiryDate;

        return {
          id: latest.id,
          label: DOC_TYPE_LABELS[type] ?? type,
          expiry: formatExpiry(expiryDate),
          status: latest.status,
          type,
          hasDoc: true,
        };
      });
  }, [documents, activeFilter]);

  const filteredDocs = useMemo(() => {
    let docs = documents;
    if (activeFilter !== 'All') {
      docs = docs.filter((d) => d.type === activeFilter);
    }
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      docs = docs.filter(
        (d) =>
          d.type.toLowerCase().includes(q) ||
          (DOC_TYPE_LABELS[d.type] ?? '').toLowerCase().includes(q) ||
          d.vehicle.toLowerCase().includes(q) ||
          (d.documentNumber ?? '').toLowerCase().includes(q),
      );
    }
    return docs;
  }, [documents, activeFilter, searchText]);

  const filteredGridCards = useMemo(() => {
    if (!searchText.trim()) return gridCards;
    const q = searchText.toLowerCase();
    return gridCards.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q),
    );
  }, [gridCards, searchText]);

  const handleDownloadAll = async () => {
    if (documents.length === 0) return Alert.alert('Error', 'No documents to download');
    try {
      Alert.alert('Processing', `Preparing ${documents.length} documents...`);
      const paths: { path: string; name: string }[] = [];
      for (const doc of documents) {
        try {
          const res = await getReadyDocumentPath(doc);
          paths.push({ path: res.path, name: res.fileName });
        } catch (e) {
          console.log(`Skip doc ${doc.id}`, e);
        }
      }

      if (paths.length === 0) throw new Error('Could not prepare any documents');

      if (Platform.OS === 'android' && RNFS.DownloadDirectoryPath) {
        let count = 0;
        for (const p of paths) {
          try {
            await RNFS.copyFile(p.path, `${RNFS.DownloadDirectoryPath}/${p.name}`);
            count++;
          } catch (e) {
            console.log('Save error', e);
          }
        }
        Alert.alert('Download Complete', `${count} documents saved to your Downloads folder.`);
      } else {
        await openShare({ fileUrls: paths.map((p) => `file://${p.path}`) });
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Download failed');
    }
  };

  const handleShareAll = async () => {
    if (documents.length === 0) return Alert.alert('Error', 'No documents to share');
    try {
      Alert.alert('Preparing Share', `Generating PDFs for ${documents.length} documents...`);
      const fileUrls: string[] = [];
      for (const doc of documents) {
        try {
          const res = await getReadyDocumentPath(doc);
          fileUrls.push(`file://${res.path}`);
        } catch (e) {
          console.log(`Skip sharing ${doc.id}`, e);
        }
      }
      if (fileUrls.length === 0) throw new Error('Could not prepare any documents');
      await openShare({ fileUrls });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Share failed');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Documents</Text>
          <Text style={styles.headerSub}>All vehicle documents</Text>
        </View>
        <TouchableOpacity
          style={styles.searchBtn}
          activeOpacity={0.85}
          onPress={() => {
            setSearchVisible((v) => {
              if (v) {
                setSearchText('');
                searchRef.current?.blur();
              } else {
                setTimeout(() => searchRef.current?.focus(), 100);
              }
              return !v;
            });
          }}
        >
          <Icon name="search" size={wp(4.5)} color="#fff" />
        </TouchableOpacity>
      </View>

      {searchVisible && (
        <TouchableOpacity
          activeOpacity={1}
          style={styles.searchBarWrap}
          onPress={() => searchRef.current?.focus()}
        >
          <Icon name="search" size={wp(4)} color="#888" style={styles.searchBarIcon} />
          <TextInput
            ref={searchRef}
            style={styles.searchBarInput}
            placeholder="Search documents..."
            placeholderTextColor="#888"
            value={searchText}
            onChangeText={setSearchText}
            returnKeyType="search"
          />
          <TouchableOpacity
            onPress={() => {
              setSearchText('');
              setSearchVisible(false);
              searchRef.current?.blur();
            }}
            style={styles.searchBarClear}
            activeOpacity={0.7}
          >
            <Icon name="times" size={wp(4)} color="#888" />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* DigiLocker Banner */}
        <TouchableOpacity activeOpacity={0.85} style={styles.digilockerBanner}>
          <View style={styles.digilockerIcon}>
            <Icon name="file-alt" size={wp(6)} color="#aaa" />
          </View>
          <View style={styles.digilockerInfo}>
            <Text style={styles.digilockerTitle}>Connect DigiLocker</Text>
            <Text style={styles.digilockerSub}>Auto-sync your documents securely</Text>
          </View>
          <Icon name="arrow-right" size={wp(4.5)} color="#888" />
        </TouchableOpacity>

        {/* Scan New Document */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.scanCard}
          onPress={() => navigation.navigate('UploadDocument')}
        >
          <View style={styles.scanIconWrap}>
            <Icon name="camera" size={wp(7)} color="#aaa" />
          </View>
          <Text style={styles.scanTitle}>Scan New Document</Text>
          <Text style={styles.scanSub}>RC / Insurance / Bills / Warranty</Text>
        </TouchableOpacity>

        {/* Category Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipScroll}
          contentContainerStyle={styles.chipContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              activeOpacity={0.85}
              style={[styles.chip, activeFilter === cat && styles.chipActive]}
              onPress={() => setActiveFilter(cat)}
            >
              <Text style={[styles.chipText, activeFilter === cat && styles.chipTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading */}
        {loading && documents.length === 0 && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#FFBF00" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        )}

        {/* Vehicle Documents Section */}
        <Text style={styles.sectionTitle}>
          {activeFilter === 'All' ? 'Vehicle Documents' : `${activeFilter} Documents`}
        </Text>

        {activeFilter === 'All' ? (
          <View style={styles.gridWrap}>
            {filteredGridCards.map((card) => (
              <TouchableOpacity
                key={card.type}
                activeOpacity={0.85}
                style={styles.gridCard}
                onPress={() => {
                  if (card.hasDoc) {
                    navigation.navigate('DocumentDetail', { documentId: card.id });
                  } else {
                    navigation.navigate('UploadDocument');
                  }
                }}
              >
                <View style={styles.gridCardIconWrap}>
                  <Icon name="file-alt" size={wp(6)} color="#aaa" />
                </View>
                <Text style={styles.gridCardLabel}>{card.label}</Text>
                <View style={styles.gridCardExpiryRow}>
                  {card.hasDoc ? (
                    <>
                      {card.status === 'expiring' && (
                        <Icon name="exclamation-triangle" size={wp(3)} color="#FFA000" style={{ marginRight: wp(1) }} />
                      )}
                      {card.status === 'expired' && (
                        <Icon name="times-circle" size={wp(3)} color="#F44336" style={{ marginRight: wp(1) }} />
                      )}
                      {card.status === 'verified' && (
                        <Icon name="check-circle" size={wp(3)} color="#4CAF50" style={{ marginRight: wp(1) }} />
                      )}
                      <Text style={[styles.gridCardExpiry, { color: statusColor(card.status) }]}>
                        {card.expiry && card.expiry !== 'N/A' && card.expiry !== 'Not uploaded' ? (
                          card.status === 'expired' ? `Expired: ${card.expiry}` :
                            card.status === 'verified' ? `Valid up to: ${card.expiry}` :
                              `Expiring: ${card.expiry}`
                        ) : (
                          card.status === 'expired' ? 'Expired' : card.expiry === 'Not uploaded' ? 'Not uploaded' : 'Valid'
                        )}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.gridCardNoDoc}>Not uploaded</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.listWrap}>
            {filteredDocs.length > 0 ? (
              filteredDocs.map((doc) => (
                <TouchableOpacity
                  key={doc.id}
                  activeOpacity={0.85}
                  style={styles.docRow}
                  onPress={() => navigation.navigate('DocumentDetail', { documentId: doc.id })}
                >
                  <View style={styles.docRowIcon}>
                    <Icon name="file-alt" size={wp(6)} color="#FFBF00" />
                  </View>
                  <View style={styles.docRowInfo}>
                    <Text style={styles.docRowName}>{DOC_TYPE_LABELS[doc.type] || doc.type}</Text>
                    <Text style={styles.docRowVehicle}>{doc.vehicle}</Text>
                    <View style={styles.docRowStatusRow}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor(doc.status as DocStatus) }]} />
                      <Text style={[styles.docRowStatus, { color: statusColor(doc.status as DocStatus) }]}>
                        {statusLabel(doc.status as DocStatus)}
                      </Text>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.docRowExpiry}>
                      {doc.expiryDate ? formatExpiry(doc.expiryDate) : 'N/A'}
                    </Text>
                    <Icon name="chevron-right" size={wp(3.5)} color="#444" style={{ marginTop: hp(0.5) }} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Icon name="file-alt" size={wp(10)} color="#333" />
                <Text style={styles.emptyStateText}>No documents found for {activeFilter}</Text>
                <TouchableOpacity
                  style={[styles.chip, { marginTop: hp(2), backgroundColor: '#111' }]}
                  onPress={() => navigation.navigate('UploadDocument')}
                >
                  <Text style={styles.chipText}>Upload Now</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.quickAction}
          onPress={handleDownloadAll}
        >
          <View style={[styles.quickActionIcon, { borderColor: '#2196F3' }]}>
            <Icon name="download" size={wp(5)} color="#2196F3" />
          </View>
          <Text style={styles.quickActionText}>Download All</Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.quickAction}
          onPress={handleShareAll}
        >
          <View style={[styles.quickActionIcon, { borderColor: '#4CAF50' }]}>
            <Icon name="share-alt" size={wp(5)} color="#4CAF50" />
          </View>
          <Text style={styles.quickActionText}>Share Documents</Text>
        </TouchableOpacity>

        <View style={{ height: hp(12) }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
  },
  backBtn: { padding: wp(2) },
  headerCenter: { flex: 1, marginLeft: wp(2) },
  headerTitle: { fontSize: wp(6), fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: wp(3.5), color: '#888', marginTop: hp(0.2) },
  searchBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },

  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    marginHorizontal: wp(4),
    marginBottom: hp(1.5),
    paddingHorizontal: wp(3),
    height: hp(5.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchBarIcon: { marginRight: wp(2) },
  searchBarInput: {
    flex: 1,
    fontSize: wp(3.8),
    color: '#fff',
    padding: 0,
  },
  searchBarClear: { padding: wp(1.5) },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingTop: hp(1.5) },

  digilockerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(180,180,180,0.25)',
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  digilockerIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(3),
    backgroundColor: 'rgba(200,200,200,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  digilockerInfo: { flex: 1 },
  digilockerTitle: { fontSize: wp(4.5), fontWeight: '700', color: '#fff' },
  digilockerSub: { fontSize: wp(3.2), color: '#bbb', marginTop: hp(0.3) },

  scanCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    paddingVertical: hp(4),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scanIconWrap: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
  },
  scanTitle: { fontSize: wp(4.5), fontWeight: '700', color: '#fff' },
  scanSub: { fontSize: wp(3.3), color: '#888', marginTop: hp(0.5) },

  chipScroll: { marginBottom: hp(2) },
  chipContainer: { paddingRight: wp(4), gap: wp(2) },
  chip: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(0.9),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  chipActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  chipText: { fontSize: wp(3.5), color: '#aaa' },
  chipTextActive: { color: '#000', fontWeight: '600' },

  sectionTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.8),
    marginTop: hp(1),
  },

  loadingWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(4),
  },
  loadingText: {
    fontSize: wp(3.5),
    color: '#888',
    marginTop: hp(1),
  },

  listWrap: {
    marginBottom: hp(1),
  },

  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: hp(1),
  },
  gridCard: {
    width: '48%',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gridCardIconWrap: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(3),
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
  },
  gridCardLabel: {
    fontSize: wp(4),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(0.5),
  },
  gridCardExpiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gridCardExpiry: { fontSize: wp(3.2) },
  gridCardNoDoc: { fontSize: wp(3.2), color: '#666' },

  docRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3.5),
    padding: wp(4),
    marginBottom: hp(1.2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  docRowIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(3),
    backgroundColor: 'rgba(255,191,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  docRowInfo: { flex: 1 },
  docRowName: { fontSize: wp(4), fontWeight: '600', color: '#fff' },
  docRowVehicle: { fontSize: wp(3.3), color: '#888', marginTop: hp(0.2) },
  docRowStatusRow: { flexDirection: 'row', alignItems: 'center', marginTop: hp(0.4) },
  statusDot: { width: wp(2), height: wp(2), borderRadius: wp(1), marginRight: wp(1.5) },
  docRowStatus: { fontSize: wp(3.2), fontWeight: '500' },
  docRowExpiry: { fontSize: wp(3), color: '#666', marginTop: hp(0.2) },

  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3.5),
    padding: wp(4),
    marginBottom: hp(1.2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  quickActionIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(6),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  quickActionText: { fontSize: wp(4), fontWeight: '600', color: '#fff' },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(4),
    marginBottom: hp(2),
  },
  emptyStateText: {
    fontSize: wp(3.5),
    color: '#666',
    marginTop: hp(1.5),
  },
});
