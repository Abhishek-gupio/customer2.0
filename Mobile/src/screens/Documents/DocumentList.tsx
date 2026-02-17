import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppSelector } from '../../store/hooks';
import type { RootState } from '../../store';
import type { DocumentItem } from '../../store/slices/documentsSlice';

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

/* ── filter categories ── */
const CATEGORIES = ['All', 'RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];

const DOC_TYPE_LABELS: Record<string, string> = {
  RC: 'RC Book',
  Insurance: 'Insurance',
  PUC: 'PUC Certificate',
  FASTag: 'FASTag',
  DL: 'Driving License',
  Other: 'Other',
};

/* Fixed grid: RC, Insurance, PUC, DL – always visible with defaults */
const FIXED_GRID_TYPES = ['RC', 'Insurance', 'PUC', 'DL'] as const;

/* ── helpers ── */
type DocStatus = 'verified' | 'expiring' | 'expired';

const DEFAULT_EXPIRY: Record<string, string> = {
  RC: 'Dec 2028',
  Insurance: 'Mar 2026',
  PUC: 'Aug 2025',
  DL: 'Jan 2030',
};
const DEFAULT_STATUS: Record<string, DocStatus> = {
  RC: 'verified',
  Insurance: 'expiring',
  PUC: 'expired',
  DL: 'verified',
};
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

function formatExpiry(ocrExpiry?: string): string {
  if (!ocrExpiry) return 'N/A';
  try {
    const d = new Date(ocrExpiry);
    return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  } catch {
    return ocrExpiry;
  }
}

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchText, setSearchText] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const searchRef = useRef<TextInput>(null);
  const documents = useAppSelector((state: RootState) => state.documents.documents);

  const gridCards = useMemo(() => {
    const byType = new Map<string, DocumentItem[]>();
    documents.forEach((d) => {
      const list = byType.get(d.type) ?? [];
      list.push(d);
      byType.set(d.type, list);
    });
    return FIXED_GRID_TYPES.map((type) => {
      const docs = byType.get(type) ?? [];
      const latest = docs[0];
      return {
        id: latest?.id ?? `default_${type}`,
        label: DOC_TYPE_LABELS[type] ?? type,
        expiry: latest ? formatExpiry(latest.ocrData.expiry) : DEFAULT_EXPIRY[type],
        status: latest?.status ?? DEFAULT_STATUS[type],
        type,
        hasDoc: !!latest,
      };
    });
  }, [documents]);

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
          (d.ocrData.docNumber ?? '').toLowerCase().includes(q),
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />

      {/* ─── Header ─── */}
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

      {/* ─── Search Bar (hidden until icon tapped) ─── */}
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
        {/* ─── Connect DigiLocker Banner ─── */}
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

        {/* ─── Scan New Document ─── */}
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

        {/* ─── Category Filter Chips ─── */}
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

        {/* ─── Vehicle Documents: RC, Insurance, PUC, DL ─── */}
        <Text style={styles.sectionTitle}>Vehicle Documents</Text>

        <View style={styles.gridWrap}>
          {filteredGridCards.map((card) => (
            <TouchableOpacity
              key={card.type}
              activeOpacity={0.85}
              style={styles.gridCard}
              onPress={() =>
                navigation.navigate('DocumentDetail', { documentId: card.id })
              }
            >
              <View style={styles.gridCardIconWrap}>
                <Icon name="file-alt" size={wp(6)} color="#aaa" />
              </View>
              <Text style={styles.gridCardLabel}>{card.label}</Text>
              <View style={styles.gridCardExpiryRow}>
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
                  {card.status === 'expired' ? 'Expired' : `Expires: ${card.expiry}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ─── Document List ─── */}
        <Text style={styles.sectionTitle}>All Documents</Text>

        {filteredDocs.map((doc) => (
          <TouchableOpacity
            key={doc.id}
            activeOpacity={0.85}
            style={styles.docRow}
            onPress={() =>
              navigation.navigate('DocumentDetail', { documentId: doc.id })
            }
          >
            <View style={styles.docRowIcon}>
              <Icon name="file-alt" size={wp(5)} color="#FFBF00" />
            </View>
            <View style={styles.docRowInfo}>
              <Text style={styles.docRowName}>{DOC_TYPE_LABELS[doc.type] ?? doc.type}</Text>
              {doc.vehicle ? <Text style={styles.docRowVehicle}>{doc.vehicle}</Text> : null}
              <View style={styles.docRowStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(doc.status) }]} />
                <Text style={[styles.docRowStatus, { color: statusColor(doc.status) }]}>
                  {statusLabel(doc.status)}
                </Text>
              </View>
              <Text style={styles.docRowExpiry}>
                Exp: {formatExpiry(doc.ocrData.expiry) || 'N/A'}
              </Text>
            </View>
            <Icon name="chevron-right" size={wp(4)} color="#555" />
          </TouchableOpacity>
        ))}

        {/* ─── Quick Actions ─── */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity activeOpacity={0.85} style={styles.quickAction}>
          <View style={[styles.quickActionIcon, { borderColor: '#2196F3' }]}>
            <Icon name="download" size={wp(5)} color="#2196F3" />
          </View>
          <Text style={styles.quickActionText}>Download All</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.85} style={styles.quickAction}>
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

/* ════════════════════ Styles ════════════════════ */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  /* Header */
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

  /* Search Bar */
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
  searchBarClear: {
    padding: wp(1.5),
  },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingTop: hp(1.5) },

  /* DigiLocker */
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

  /* Scan */
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

  /* Chips */
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

  /* Section */
  sectionTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.8),
    marginTop: hp(1),
  },

  /* Grid */
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
  gridCardExpiry: {
    fontSize: wp(3.2),
  },

  /* Doc rows */
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

  /* Quick Actions */
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

  /* Empty state */
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
