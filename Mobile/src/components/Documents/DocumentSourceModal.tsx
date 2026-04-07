import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { Camera, Image as ImageIcon, FileUp, X } from 'lucide-react-native';

type DocumentSourceModalProps = {
  visible: boolean;
  onClose: () => void;
  onTakePhoto: () => void;
  onPickImage: () => void;
  onPickDocument: () => void;
};

export default function DocumentSourceModal({
  visible,
  onClose,
  onTakePhoto,
  onPickImage,
  onPickDocument,
}: DocumentSourceModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Choose Source</Text>
                <TouchableOpacity onPress={onClose}>
                  <X size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalOptions}>
                <TouchableOpacity style={styles.modalOption} onPress={onTakePhoto}>
                  <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(255, 193, 7, 0.1)' }]}>
                    <Camera size={22} color="#FFC107" />
                  </View>
                  <Text style={styles.modalOptionText}>Take Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={onPickImage}>
                  <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(33, 150, 243, 0.1)' }]}>
                    <ImageIcon size={22} color="#2196F3" />
                  </View>
                  <Text style={styles.modalOptionText}>From Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modalOption} onPress={onPickDocument}>
                  <View style={[styles.modalOptionIcon, { backgroundColor: 'rgba(76, 175, 80, 0.1)' }]}>
                    <FileUp size={22} color="#4CAF50" />
                  </View>
                  <Text style={styles.modalOptionText}>Choose File (PDF)</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.modalCancelBtn} onPress={onClose}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    borderWidth: 1,
    borderColor: '#222',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  modalOptions: {
    gap: 12,
    marginBottom: 24,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    padding: 18,
    borderRadius: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  modalOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#fff',
  },
  modalCancelBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
  },
  modalCancelText: {
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
    color: '#888',
  },
});
