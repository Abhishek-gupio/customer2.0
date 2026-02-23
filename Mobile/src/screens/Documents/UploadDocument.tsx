import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  ActionSheetIOS,
  PermissionsAndroid,
  InteractionManager,
  Image,
  ActivityIndicator,
} from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { pick as pickDocument, types as docTypes } from '@react-native-documents/picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { useAppDispatch } from '../../store/hooks';
import { addDocumentFromResponse, toDocItem } from '../../store/slices/documentsSlice';
import { uploadDocument } from '../../services/documentService';

type UploadDocNavProp = NativeStackNavigationProp<RootStackParamList, 'UploadDocument'>;

const DOC_TYPES = ['RC', 'Insurance', 'PUC', 'FASTag', 'DL', 'Other'];

interface FileInfo {
  uri: string;
  name: string;
  type: string;
}

export default function UploadDocument() {
  const navigation = useNavigation<UploadDocNavProp>();
  const dispatch = useAppDispatch();
  const [docType, setDocType] = useState('');
  const [vehicle, setVehicle] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [uploading, setUploading] = useState(false);

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
      const storage =
        Platform.Version >= 33
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

  const handleTapToUpload = () => {
    const options = ['Camera', 'Gallery', 'Choose File', 'Cancel'];
    const cancelIndex = 3;

    const runPicker = (fn: () => void) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(fn);
      } else {
        setTimeout(fn, 100);
      }
    };

    if (Platform.OS === 'ios' && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex },
        (buttonIndex) => {
          if (buttonIndex === 0) runPicker(handleTakePhoto);
          else if (buttonIndex === 1) runPicker(handlePickImage);
          else if (buttonIndex === 2) runPicker(handlePickDocument);
        },
      );
    } else {
      Alert.alert('Upload Document', 'Select source', [
        { text: 'Camera', onPress: () => runPicker(handleTakePhoto) },
        { text: 'Gallery', onPress: () => runPicker(handlePickImage) },
        { text: 'Choose File', onPress: () => runPicker(handlePickDocument) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handlePickDocument = async () => {
    try {
      const res = await pickDocument({
        type: [docTypes.pdf, docTypes.images],
        allowMultiSelection: false,
      });
      if (res?.[0]) {
        setFileInfo({
          uri: res[0].uri,
          name: res[0].name || `file_${Date.now()}`,
          type: res[0].type || 'application/octet-stream',
        });
      }
    } catch (e: unknown) {
      const err = e as { code?: string };
      if (err?.code !== 'DOCUMENT_PICKER_CANCELED') {
        Alert.alert('Error', 'Could not pick file');
      }
    }
  };

  const handlePickImage = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Camera and photo library access are required.');
        return;
      }
    }
    try {
      const res = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        setFileInfo({
          uri: asset.uri!,
          name: asset.fileName || `photo_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === 'android') {
      const hasPermission = await requestAndroidPermissions();
      if (!hasPermission) {
        Alert.alert('Permission needed', 'Camera access is required.');
        return;
      }
    }
    try {
      const res = await launchCamera({ mediaType: 'photo', quality: 0.8 });
      if (res?.assets?.[0]) {
        const asset = res.assets[0];
        setFileInfo({
          uri: asset.uri!,
          name: asset.fileName || `camera_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not take photo');
    }
  };

  const handleUpload = async () => {
    if (!docType) {
      Alert.alert('Required', 'Please select document type');
      return;
    }
    if (!fileInfo) {
      Alert.alert('Required', 'Please add a document (tap to upload)');
      return;
    }

    setUploading(true);
    try {
      const result = await uploadDocument({
        type: docType,
        fileUri: fileInfo.uri,
        fileName: fileInfo.name,
        mimeType: fileInfo.type,
        documentNumber: vehicle.trim() || undefined,
      });

      dispatch(addDocumentFromResponse(toDocItem(result)));
      Alert.alert('Success', 'Document uploaded successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Something went wrong');
    } finally {
      setUploading(false);
    }
  };

  const isImage = fileInfo?.type?.startsWith('image/');

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
        <Text style={styles.headerTitle}>Upload Document</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Document Type */}
        <Text style={styles.label}>
          Document Type <Text style={styles.required}>*</Text>
        </Text>
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.selectInput}
          onPress={() => setShowTypeDropdown(!showTypeDropdown)}
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

        {/* Link to Vehicle */}
        <Text style={styles.label}>Link to Vehicle</Text>
        <TextInput
          style={styles.textInput}
          placeholder="Enter vehicle number (e.g. MH12AB1234)"
          placeholderTextColor="#666"
          value={vehicle}
          onChangeText={setVehicle}
          autoCapitalize="characters"
        />

        {/* Tap to Upload / Preview */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.uploadArea}
          onPress={handleTapToUpload}
        >
          {fileInfo && isImage ? (
            <Image source={{ uri: fileInfo.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : fileInfo ? (
            <View style={styles.filePreview}>
              <Icon name="file-pdf" size={wp(10)} color="#FFBF00" />
              <Text style={styles.fileName} numberOfLines={2}>
                {fileInfo.name}
              </Text>
              <Text style={styles.uploadSub}>Tap to change</Text>
            </View>
          ) : (
            <>
              <View style={styles.uploadIconWrap}>
                <Icon name="cloud-upload-alt" size={wp(8)} color="#FFBF00" />
              </View>
              <Text style={styles.uploadTitle}>Tap to upload</Text>
              <Text style={styles.uploadSub}>Choose file or take a photo</Text>
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
            </>
          )}
        </TouchableOpacity>

        {/* File name display when image is shown */}
        {fileInfo && isImage && (
          <View style={styles.fileNameRow}>
            <Icon name="paperclip" size={wp(3.5)} color="#FFBF00" />
            <Text style={styles.fileNameSmall} numberOfLines={1}>{fileInfo.name}</Text>
            <TouchableOpacity onPress={() => setFileInfo(null)} activeOpacity={0.7}>
              <Icon name="times-circle" size={wp(4)} color="#666" />
            </TouchableOpacity>
          </View>
        )}

        {/* OCR Note */}
        <View style={styles.ocrNote}>
          <Icon name="magic" size={wp(4.5)} color="#FFBF00" style={{ marginRight: wp(3) }} />
          <Text style={styles.ocrNoteText}>
            AI will auto-extract document details after upload
          </Text>
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          activeOpacity={0.85}
          style={[styles.submitBtn, uploading && styles.submitBtnDisabled]}
          onPress={handleUpload}
          disabled={uploading}
        >
          {uploading ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <>
              <Text style={styles.submitBtnText}>Upload</Text>
              <Icon name="arrow-right" size={wp(4)} color="#000" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

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

  label: {
    fontSize: wp(3.8),
    fontWeight: '600',
    color: '#fff',
    marginBottom: hp(1),
  },
  required: { color: '#F44336' },

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

  textInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    height: hp(6.5),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    fontSize: wp(4),
    color: '#fff',
  },

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

  uploadArea: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(4),
    paddingVertical: hp(3),
    marginBottom: hp(1.5),
    borderWidth: 2,
    borderColor: 'rgba(255,191,0,0.25)',
    borderStyle: 'dashed',
    overflow: 'hidden',
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

  previewImage: {
    width: '100%',
    height: hp(25),
    borderRadius: wp(2),
  },
  filePreview: {
    alignItems: 'center',
    paddingVertical: hp(2),
  },
  fileName: {
    fontSize: wp(3.8),
    color: '#fff',
    marginTop: hp(1),
    textAlign: 'center',
    paddingHorizontal: wp(4),
  },

  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: wp(2.5),
    paddingHorizontal: wp(3),
    paddingVertical: hp(1),
    marginBottom: hp(1.5),
    gap: wp(2),
  },
  fileNameSmall: {
    flex: 1,
    fontSize: wp(3.3),
    color: '#ccc',
  },

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

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFBF00',
    paddingVertical: hp(2),
    borderRadius: wp(3.5),
    gap: wp(2),
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { fontSize: wp(4.5), fontWeight: '700', color: '#000' },
});
