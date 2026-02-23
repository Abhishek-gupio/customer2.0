import React, { useEffect, useState } from 'react';
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
import { removeDocumentAsync, fetchDocumentById } from '../../store/slices/documentsSlice';

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

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
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

  if (!doc) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-left" size={wp(5)} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Document</Text>
          <View style={{ width: wp(10) }} />
        </View>
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color="#FFBF00" />
          <Text style={styles.emptyStateText}>Loading document...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const imageUri = doc.imageUri;
  const isImage = imageUri && !imageUri.toLowerCase().endsWith('.pdf');

  // Ensure expiry date is used from dates array if expiryDate is not set
  let expiryDate = doc.expiryDate;
  if (!expiryDate && doc.dates && Array.isArray(doc.dates) && doc.dates.length > 1) {
    expiryDate = doc.dates[1];
  }

  const fields: { label: string; value: string }[] = [];
  if (doc.documentNumber) fields.push({ label: 'Doc Number', value: doc.documentNumber });
  if (doc.issueDate) fields.push({ label: 'Issue Date', value: formatDate(doc.issueDate) });
  if (expiryDate) fields.push({ label: 'Expiry', value: formatDate(expiryDate) });
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
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <Icon name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
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
        <View style={styles.previewCard}>
          {isImage ? (
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
              <Icon name="file-alt" size={wp(14)} color="#555" />
              <Text style={styles.previewText}>No Preview</Text>
            </View>
          )}
        </View>

        {/* Status & Source */}
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
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Source</Text>
            <View style={styles.sourceBadge}>
              <Icon
                name={doc.source === 'DIGILOCKER' ? 'link' : 'cloud-upload-alt'}
                size={wp(3.5)}
                color="#aaa"
                style={{ marginRight: wp(1.5) }}
              />
              <Text style={styles.sourceText}>{doc.source}</Text>
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
