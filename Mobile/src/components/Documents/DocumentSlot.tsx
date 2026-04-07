import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { Plus } from 'lucide-react-native';
import type { DocumentItem } from '../../store/slices/documentsSlice';
import { getDocumentStatusMeta } from './documentUtils';

const { width } = Dimensions.get('window');

type DocumentSlotProps = {
  label: string;
  document?: DocumentItem | null;
  onPress: () => void;
};

export default function DocumentSlot({ label, document, onPress }: DocumentSlotProps) {
  const statusMeta = getDocumentStatusMeta(document);

  return (
    <View style={styles.slotContainer}>
      <TouchableOpacity style={styles.slotBox} onPress={onPress}>
        {document ? (
          <View style={styles.imageWrapper}>
            <Image
              source={{ uri: document.imageUri }}
              style={styles.slotImage}
              resizeMode="cover"
              onError={(e) => console.log('Image Load Error:', e.nativeEvent.error)}
            />
          </View>
        ) : (
          <Plus size={24} color="#333" />
        )}
      </TouchableOpacity>
      <Text style={styles.slotLabel}>{label}</Text>
      <View style={[styles.slotStatusBadge, { backgroundColor: statusMeta.bg, borderColor: statusMeta.border }]}>
        <Text style={[styles.slotStatusText, { color: statusMeta.tone }]}>{statusMeta.label}</Text>
      </View>
      <Text style={styles.slotHint}>{statusMeta.caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slotContainer: { width: (width - 72) / 3, gap: 12 },
  slotBox: { width: '100%', aspectRatio: 1, backgroundColor: '#0A0A0A', borderRadius: 14, borderWidth: 1, borderColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center' },
  imageWrapper: { width: '100%', height: '100%', borderRadius: 14, overflow: 'hidden' },
  slotImage: { width: '100%', height: '100%', backgroundColor: '#1A1A1A' },
  slotLabel: { fontSize: 11, fontFamily: 'Outfit-Medium', color: '#8E8E93', textTransform: 'lowercase', textAlign: 'center' },
  slotStatusBadge: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginTop: -4,
  },
  slotStatusText: {
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  slotHint: {
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    textAlign: 'center',
    marginTop: -6,
    lineHeight: 14,
  },
});
