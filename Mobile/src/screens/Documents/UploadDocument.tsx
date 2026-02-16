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

type UploadDocNavProp = NativeStackNavigationProp<RootStackParamList, 'UploadDocument'>;

const DOC_TYPES = ['RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];
const VEHICLES = ['MH12AB1234', 'KA01CD5678', 'DL3EF9012'];

export default function UploadDocument() {
  const navigation = useNavigation<UploadDocNavProp>();
  const [docType, setDocType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);

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
        <Text style={styles.headerTitle}>Upload Document</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ─── Document Type ─── */}
        <Text style={styles.label}>
          Document Type <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.selectInput}
          onPress={() => {
            setShowTypeDropdown(!showTypeDropdown);
            setShowVehicleDropdown(false);
          }}
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

        {/* ─── Link to Vehicle ─── */}
        <Text style={styles.label}>Link to Vehicle</Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.selectInput}
          onPress={() => {
            setShowVehicleDropdown(!showVehicleDropdown);
            setShowTypeDropdown(false);
          }}
        >
          <Text style={vehicle ? styles.selectText : styles.selectPlaceholder}>
            {vehicle || 'Select vehicle (optional)'}
          </Text>
          <Icon
            name={showVehicleDropdown ? 'chevron-up' : 'chevron-down'}
            size={wp(3.5)}
            color="#888"
          />
        </TouchableOpacity>
        {showVehicleDropdown && (
          <View style={styles.dropdown}>
            {VEHICLES.map((v) => (
              <TouchableOpacity
                key={v}
                activeOpacity={0.85}
                style={[
                  styles.dropdownItem,
                  vehicle === v && styles.dropdownItemActive,
                ]}
                onPress={() => {
                  setVehicle(v);
                  setShowVehicleDropdown(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    vehicle === v && styles.dropdownItemTextActive,
                  ]}
                >
                  {v}
                </Text>
                {vehicle === v && (
                  <Icon name="check" size={wp(3.5)} color="#FFBF00" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ─── File Upload / Camera ─── */}
        <TouchableOpacity activeOpacity={0.85} style={styles.uploadArea}>
          <View style={styles.uploadIconWrap}>
            <Icon name="camera" size={wp(8)} color="#FFBF00" />
          </View>
          <Text style={styles.uploadTitle}>Tap to upload</Text>
          <Text style={styles.uploadSub}>or take a photo</Text>
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
        </TouchableOpacity>

        {/* ─── OCR Note ─── */}
        <View style={styles.ocrNote}>
          <Icon name="magic" size={wp(4.5)} color="#FFBF00" style={{ marginRight: wp(3) }} />
          <Text style={styles.ocrNoteText}>
            OCR will auto-extract document details
          </Text>
        </View>

        {/* ─── Upload Button ─── */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.submitBtn}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.submitBtnText}>Upload</Text>
          <Icon name="arrow-right" size={wp(4)} color="#000" />
        </TouchableOpacity>
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
    justifyContent: 'space-between',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  backBtn: { padding: wp(2) },
  headerTitle: { fontSize: wp(5), fontWeight: '700', color: '#fff' },
  headerRight: { width: wp(10) },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingTop: hp(3),
    paddingBottom: hp(4),
  },

  /* Labels */
  label: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#fff',
    marginBottom: hp(1),
  },
  required: { color: '#F44336' },

  /* Select */
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

  /* Dropdown */
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

  /* Upload area */
  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    paddingVertical: hp(5),
    marginBottom: hp(2),
    borderWidth: 2,
    borderColor: 'rgba(255,191,0,0.25)',
    borderStyle: 'dashed',
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

  /* OCR note */
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

  /* Submit */
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
    gap: wp(2),
  },
  submitBtnText: { fontSize: wp(4.5), fontWeight: '700', color: '#000' },
});
