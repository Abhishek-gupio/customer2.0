import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
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

type DocListNavProp = NativeStackNavigationProp<RootStackParamList>;

/* ── filter categories ── */
const CATEGORIES = ['All', 'RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];

/* ── mock documents ── */
type DocStatus = 'verified' | 'expiring' | 'expired';
interface VehicleDoc {
  id: string;
  name: string;
  type: string;
  vehicle: string;
  expiry: string;
  status: DocStatus;
}

const MOCK_DOCS: VehicleDoc[] = [
  { id: '1', name: 'Registration (RC)', type: 'RC', vehicle: 'MH12AB1234', expiry: '15 Mar 2030', status: 'verified' },
  { id: '2', name: 'Insurance', type: 'Insurance', vehicle: 'ICICI Lombard', expiry: '28 Feb 2026', status: 'expiring' },
  { id: '3', name: 'PUC Certificate', type: 'PUC', vehicle: 'MH12AB1234', expiry: '10 Aug 2025', status: 'expired' },
  { id: '4', name: 'Driving License', type: 'DL', vehicle: '', expiry: '01 Jan 2030', status: 'verified' },
];

/* ── grid card data for screenshot‑style layout ── */
interface GridCard {
  id: string;
  label: string;
  expiry: string;
  status: DocStatus;
}
const GRID_CARDS: GridCard[] = [
  { id: '1', label: 'RC Book', expiry: 'Dec 2028', status: 'verified' },
  { id: '2', label: 'Insurance', expiry: 'Mar 2026', status: 'expiring' },
  { id: '3', label: 'PUC Certificate', expiry: 'Aug 2025', status: 'expired' },
  { id: '4', label: 'Driving License', expiry: 'Jan 2030', status: 'verified' },
];

/* ── helpers ── */
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

export default function DocumentList() {
  const navigation = useNavigation<DocListNavProp>();
  const [activeFilter, setActiveFilter] = useState('All');

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
        <TouchableOpacity style={styles.searchBtn} activeOpacity={0.85}>
          <Icon name="search" size={wp(4.5)} color="#fff" />
        </TouchableOpacity>
      </View>

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
        <TouchableOpacity activeOpacity={0.85} style={styles.scanCard}>
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

        {/* ─── Vehicle Documents ─── */}
        <Text style={styles.sectionTitle}>Vehicle Documents</Text>

        <View style={styles.gridWrap}>
          {GRID_CARDS.map((card) => (
            <TouchableOpacity
              key={card.id}
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

        {/* ─── Document List (wireframe style) ─── */}
        <Text style={styles.sectionTitle}>All Documents</Text>

        {MOCK_DOCS.filter(
          (d) => activeFilter === 'All' || d.type === activeFilter,
        ).map((doc) => (
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
              <Text style={styles.docRowName}>{doc.name}</Text>
              {doc.vehicle ? <Text style={styles.docRowVehicle}>{doc.vehicle}</Text> : null}
              <View style={styles.docRowStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: statusColor(doc.status) }]} />
                <Text style={[styles.docRowStatus, { color: statusColor(doc.status) }]}>
                  {statusLabel(doc.status)}
                </Text>
              </View>
              <Text style={styles.docRowExpiry}>Exp: {doc.expiry}</Text>
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

      {/* ─── Bottom Buttons ─── */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.uploadBtn}
          onPress={() => navigation.navigate('UploadDocument')}
        >
          <Icon name="cloud-upload-alt" size={wp(4.5)} color="#000" style={{ marginRight: wp(2) }} />
          <Text style={styles.uploadBtnText}>Upload</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.85} style={styles.digiLBtn}>
          <Icon name="link" size={wp(4.5)} color="#fff" style={{ marginRight: wp(2) }} />
          <Text style={styles.digiLBtnText}>DigiLocker</Text>
        </TouchableOpacity>
      </View>
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

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: wp(4), paddingTop: hp(1.5) },

  /* DigiLocker */
  digilockerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: wp(4),
    padding: wp(4),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  digilockerIcon: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(3),
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(3),
  },
  digilockerInfo: { flex: 1 },
  digilockerTitle: { fontSize: wp(4), fontWeight: '600', color: '#fff' },
  digilockerSub: { fontSize: wp(3.2), color: '#888', marginTop: hp(0.3) },

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

  /* Bottom */
  bottomBar: {
    flexDirection: 'row',
    paddingHorizontal: wp(4),
    paddingBottom: hp(2),
    paddingTop: hp(1),
    gap: wp(3),
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  uploadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(1.8),
    borderRadius: wp(3.5),
  },
  uploadBtnText: { fontSize: wp(4), fontWeight: '700', color: '#000' },
  digiLBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
    paddingVertical: hp(1.8),
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  digiLBtnText: { fontSize: wp(4), fontWeight: '700', color: '#fff' },
});
