import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import type { DocumentItem } from '../../store/slices/documentsSlice';

type DocumentSummaryItem = Pick<DocumentItem, 'type'> & {
  label: string;
  document?: DocumentItem;
};

type DocumentHealthSectionProps = {
  healthyCount: number;
  reviewCount: number;
  missingItems: DocumentSummaryItem[];
  reviewItems: DocumentSummaryItem[];
  onPrimaryAction: () => void;
  onSecondaryAction: () => void;
};

export default function DocumentHealthSection({
  healthyCount,
  reviewCount,
  missingItems,
  reviewItems,
  onPrimaryAction,
  onSecondaryAction,
}: DocumentHealthSectionProps) {
  const hasMissing = missingItems.length > 0;
  const hasReviewItems = reviewItems.length > 0;

  return (
    <>
      <View style={styles.trustBadge}>
        <ShieldCheck size={14} color="#00C853" />
        <Text style={styles.trustText}>100% safe and secure</Text>
      </View>

      <View style={styles.healthOverviewRow}>
        <View style={styles.healthMetricCard}>
          <Text style={styles.healthMetricValue}>{healthyCount}</Text>
          <Text style={styles.healthMetricLabel}>Ready now</Text>
        </View>
        <View style={styles.healthMetricCard}>
          <Text style={[styles.healthMetricValue, styles.healthMetricWarning]}>{reviewCount}</Text>
          <Text style={styles.healthMetricLabel}>Need review</Text>
        </View>
        <View style={styles.healthMetricCard}>
          <Text style={styles.healthMetricValue}>{missingItems.length}</Text>
          <Text style={styles.healthMetricLabel}>Missing</Text>
        </View>
      </View>

      <View style={styles.nextActionCard}>
        <View style={styles.nextActionHeader}>
          <Text style={styles.nextActionTitle}>Document health</Text>
          <Text style={styles.nextActionCaption}>
            {hasMissing
              ? `${missingItems.length} document${missingItems.length === 1 ? '' : 's'} still missing`
              : hasReviewItems
                ? 'A few documents need attention soon'
                : 'Your glovebox is in good shape'}
          </Text>
        </View>

        {hasMissing ? (
          <Text style={styles.nextActionBody}>
            Add {missingItems.slice(0, 2).map(item => item.label).join(' and ')} to complete your core document set.
          </Text>
        ) : hasReviewItems ? (
          <Text style={styles.nextActionBody}>
            Review expiry dates and keep renewal documents ready before your next drive.
          </Text>
        ) : (
          <Text style={styles.nextActionBody}>
            Everything important is stored. Linking DigiLocker can still make future refreshes easier.
          </Text>
        )}

        <View style={styles.nextActionButtons}>
          <TouchableOpacity style={styles.nextActionPrimaryBtn} onPress={onPrimaryAction}>
            <Text style={styles.nextActionPrimaryText}>
              {hasMissing
                ? `Add ${missingItems[0].label}`
                : hasReviewItems
                  ? 'Review document'
                  : 'Link DigiLocker'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextActionSecondaryBtn} onPress={onSecondaryAction}>
            <Text style={styles.nextActionSecondaryText}>Sync official docs</Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  trustBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  trustText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#00C853', fontWeight: '600' },
  healthOverviewRow: { flexDirection: 'row', gap: 10, marginTop: 18 },
  healthMetricCard: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1A1A1A',
  },
  healthMetricValue: {
    color: '#FFF',
    fontSize: 24,
    fontFamily: 'Outfit-Bold',
  },
  healthMetricWarning: {
    color: '#F59E0B',
  },
  healthMetricLabel: {
    marginTop: 4,
    color: '#8E8E93',
    fontSize: 11,
    fontFamily: 'Outfit-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  nextActionCard: {
    marginTop: 18,
    backgroundColor: '#0E1218',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1B2230',
  },
  nextActionHeader: {
    marginBottom: 10,
  },
  nextActionTitle: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  nextActionCaption: {
    marginTop: 4,
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: 'Outfit-Medium',
  },
  nextActionBody: {
    color: '#D1D5DB',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: 'Outfit-Regular',
  },
  nextActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  nextActionPrimaryBtn: {
    flex: 1,
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextActionPrimaryText: {
    color: '#111827',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
  nextActionSecondaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2B3648',
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  nextActionSecondaryText: {
    color: '#E5E7EB',
    fontSize: 13,
    fontFamily: 'Outfit-Bold',
  },
});
