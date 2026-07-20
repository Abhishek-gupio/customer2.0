import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText, Trash2, X, Share2, Download } from 'lucide-react-native';
import type { DocumentItem } from '../../store/slices/documentsSlice';
import type { Vehicle } from '../../services/vehicleService';

type DocumentViewerModalProps = {
  visible: boolean;
  document: DocumentItem | null;
  vehicle: Vehicle | null;
  onClose: () => void;
  onDelete: (doc: DocumentItem) => void;
  onShare: (doc: DocumentItem) => void;
  onDownload: (doc: DocumentItem) => void;
};

export default function DocumentViewerModal({
  visible,
  document,
  vehicle,
  onClose,
  onDelete,
  onShare,
  onDownload,
}: DocumentViewerModalProps) {
  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.viewerContainer}>
        <View style={styles.viewerHeader}>
          <View style={styles.viewerHeaderLeft}>
            <Text style={styles.viewerTitle}>{document?.type || 'Document'}</Text>
            <Text style={styles.viewerSubtitle}>{vehicle?.registrationNumber}</Text>
          </View>
          <View style={styles.viewerHeaderRight}>
            <TouchableOpacity
              style={styles.viewerHeaderIcon}
              onPress={() => {
                if (document) {
                  onDelete(document);
                  onClose();
                }
              }}
            >
              <Trash2 size={22} color="#FF453A" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.viewerHeaderIcon, styles.viewerCloseIcon]} onPress={onClose}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.viewerContent}
          centerContent
          showsVerticalScrollIndicator={false}
        >
          {document?.imageUri ? (
            <Image
              source={{ uri: document.imageUri }}
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
          <TouchableOpacity
            style={styles.viewerActionBtn}
            onPress={() => {
              if (document) onShare(document);
            }}
          >
            <Share2 size={20} color="#FFF" />
            <Text style={styles.viewerActionText}>Share as PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewerActionBtn, styles.viewerActionBtnOutline]}
            onPress={() => {
              if (document) onDownload(document);
            }}
          >
            <Download size={20} color="#FFF" />
            <Text style={styles.viewerActionText}>Download PDF</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewerContainer: { flex: 1, backgroundColor: '#000' },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  viewerHeaderLeft: { flex: 1 },
  viewerHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  viewerTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Bold', textTransform: 'lowercase' },
  viewerSubtitle: { color: '#8E8E93', fontSize: 12, fontFamily: 'Outfit-Medium', marginTop: 2, textTransform: 'uppercase' },
  viewerHeaderIcon: { padding: 4 },
  viewerCloseIcon: { marginLeft: 16 },
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
    borderTopColor: '#1A1A1A',
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
    borderColor: '#333',
  },
  viewerActionBtnOutline: {
    backgroundColor: 'transparent',
    borderColor: '#333',
  },
  viewerActionText: { color: '#FFF', fontSize: 15, fontFamily: 'Outfit-Bold' },
});
