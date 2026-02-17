import React from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import { removeDocument } from '../../store/slices/documentsSlice';

type DetailNavProp = NativeStackNavigationProp<RootStackParamList, 'DocumentDetail'>;

const DEFAULT_DETAILS: Record<string, {
  type: string; vehicle: string; status: string; source: string;
  docNumber: string; issueDate: string; expiry: string; issuer: string;
}> = {
  default_RC: {
    type: 'RC', vehicle: 'MH12AB1234', status: 'verified', source: 'Upload',
    docNumber: 'MH12 20200012345', issueDate: '01 Jan 2022', expiry: '15 Dec 2028', issuer: 'RTO Pune',
  },
  default_Insurance: {
    type: 'Insurance', vehicle: 'ICICI Lombard', status: 'expiring', source: 'Upload',
    docNumber: 'POL-2024-789456', issueDate: '01 Mar 2024', expiry: '28 Mar 2026', issuer: 'ICICI Lombard',
  },
  default_PUC: {
    type: 'PUC', vehicle: 'MH12AB1234', status: 'expired', source: 'Upload',
    docNumber: 'PUC-2023-654321', issueDate: '10 Aug 2023', expiry: '10 Aug 2025', issuer: 'Govt. Testing Center',
  },
  default_DL: {
    type: 'DL', vehicle: '', status: 'verified', source: 'DigiLocker',
    docNumber: 'MH03 20190078901', issueDate: '15 Jun 2019', expiry: '01 Jan 2030', issuer: 'RTO Mumbai',
  },
};

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

interface Props {
  route: RouteProp<RootStackParamList, 'DocumentDetail'>;
}

export default function DocumentDetail({ route }: Props) {
  const navigation = useNavigation<DetailNavProp>();
  const dispatch = useAppDispatch();
  const { documentId } = route.params;
  const documents = useAppSelector((state: RootState) => state.documents.documents);
  const doc = documents.find((d) => d.id === documentId);
  const defaultDoc = DEFAULT_DETAILS[documentId];

  const handleDelete = () => {
    if (!doc) {
      navigation.goBack();
      return;
    }
    Alert.alert('Delete Document', 'Are you sure you want to delete this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          dispatch(removeDocument(documentId));
          navigation.goBack();
        },
      },
    ]);
  };

  if (!doc && !defaultDoc) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={wp(5)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document not found</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>This document may have been deleted.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const displayType = doc?.type ?? defaultDoc!.type;
  const displayVehicle = doc?.vehicle ?? defaultDoc!.vehicle;
  const displayStatus = doc?.status ?? defaultDoc!.status;
  const displaySource = doc ? 'Upload' : (defaultDoc!.source ?? 'Upload');
  const imageUri = doc?.imageUri ?? null;
  const ocr = doc
    ? doc.ocrData
    : {
        docNumber: defaultDoc!.docNumber,
        issueDate: defaultDoc!.issueDate,
        expiry: defaultDoc!.expiry,
        issuer: defaultDoc!.issuer,
        vehicleNumber: defaultDoc!.vehicle || undefined,
      };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      {/* ─── Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayType} – {displayVehicle || 'Document'}
        </Text>
        <TouchableOpacity
          onPress={handleDelete}
          style={styles.deleteBtn}
          activeOpacity={0.85}
        >
          <Icon name="trash-alt" size={wp(4.5)} color="#F44336" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Document Preview ─── */}
        <View style={styles.previewCard}>
          {imageUri && !imageUri.toLowerCase().endsWith('.pdf') ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : imageUri ? (
            <View style={styles.previewPlaceholder}>
              <Icon name="file-pdf" size={wp(14)} color="#FFBF00" />
              <Text style={styles.previewText}>PDF Document</Text>
            </View>
          ) : (
            <View style={styles.previewPlaceholder}>
              <Icon name="file-pdf" size={wp(14)} color="#555" />
              <Text style={styles.previewText}>Document Preview</Text>
            </View>
          )}
        </View>

        {/* ─── Status & Source ─── */}
        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Status</Text>
            <View style={styles.statusBadge}>
              <View
                style={[styles.statusDot, { backgroundColor: statusColor(displayStatus) }]}
              />
              <Text style={[styles.statusText, { color: statusColor(displayStatus) }]}>
                {statusLabel(displayStatus)}
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Source</Text>
            <View style={styles.sourceBadge}>
              <Icon
                name={displaySource === 'DigiLocker' ? 'link' : 'cloud-upload-alt'}
                size={wp(3.5)}
                color="#aaa"
                style={{ marginRight: wp(1.5) }}
              />
              <Text style={styles.sourceText}>{displaySource.toUpperCase()}</Text>
            </View>
          </View>
        </View>

        {/* ─── Extracted Fields (OCR) ─── */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Icon name="magic" size={wp(4)} color="#FFBF00" style={{ marginRight: wp(2) }} />
            <Text style={styles.sectionTitle}>Extracted Fields (OCR)</Text>
          </View>

          <View style={styles.fieldCard}>
            {(
              [
                ocr.docNumber && { label: 'Doc Number', value: ocr.docNumber },
                ocr.issueDate && { label: 'Issue Date', value: ocr.issueDate },
                ocr.expiry && { label: 'Expiry', value: ocr.expiry },
                ocr.issuer && { label: 'Issuer', value: ocr.issuer },
                ocr.vehicleNumber && { label: 'Vehicle', value: ocr.vehicleNumber },
              ] as ({ label: string; value: string } | false)[]
            )
              .filter((f): f is { label: string; value: string } => Boolean(f))
              .map((f, i, arr) => (
                <FieldRow
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  last={i === arr.length - 1}
                />
              ))}
            {!ocr.docNumber && !ocr.issueDate && !ocr.expiry && !ocr.issuer && !ocr.vehicleNumber && (
              <View style={styles.noOcrRow}>
                <Text style={styles.noOcrText}>No OCR data extracted</Text>
              </View>
            )}
          </View>
        </View>

        {/* ─── Action Buttons ─── */}
        <View style={styles.actionsRow}>
          <TouchableOpacity activeOpacity={0.85} style={styles.verifyBtn}>
            <Icon name="check-circle" size={wp(4.5)} color="#000" style={{ marginRight: wp(2) }} />
            <Text style={styles.verifyBtnText}>Verify</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.85} style={styles.downloadBtn}>
            <Icon name="download" size={wp(4.5)} color="#fff" style={{ marginRight: wp(2) }} />
            <Text style={styles.downloadBtnText}>Download</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ── Extracted Field Row ── */
function FieldRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.fieldRow, !last && styles.fieldRowBorder]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

/* ════════════════════ Styles ════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { padding: wp(2) },
  headerTitle: {
    flex: 1,
    fontSize: wp(4.5),
    fontWeight: '700',
    color: '#fff',
    marginLeft: wp(2),
  },
  deleteBtn: { padding: wp(2) },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingTop: hp(2), paddingBottom: hp(4) },

  /* Preview */
  previewCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    overflow: 'hidden',
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  previewPlaceholder: {
    height: hp(28),
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: hp(28),
  },
  previewText: {
    fontSize: wp(3.5),
    color: '#666',
    marginTop: hp(1.5),
  },

  /* Empty state */
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: wp(5),
  },
  emptyStateText: { fontSize: wp(4), color: '#888' },

  /* Info row */
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

  /* Section */
  section: { marginBottom: hp(3) },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1.5),
  },
  sectionTitle: { fontSize: wp(4.5), fontWeight: '700', color: '#fff' },

  /* Fields */
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
  fieldValue: { fontSize: wp(3.8), color: '#fff', fontWeight: '500' },
  noOcrRow: { padding: wp(4) },
  noOcrText: { fontSize: wp(3.5), color: '#666' },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    gap: wp(3),
  },
  verifyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
  },
  verifyBtnText: { fontSize: wp(4), fontWeight: '700', color: '#000' },
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
});
