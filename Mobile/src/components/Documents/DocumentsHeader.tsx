import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BackButton from '../BackButton';

type DocumentsHeaderProps = {
  totalDocs: number;
  maxDocs: number;
  progressPercent: number;
  onBackPress: () => void;
};

export default function DocumentsHeader({
  totalDocs,
  maxDocs,
  progressPercent,
  onBackPress,
}: DocumentsHeaderProps) {
  return (
    <View style={styles.header}>
      <BackButton onPress={onBackPress} />
      <View style={styles.headerTitleContainer}>
        <Text style={styles.headerTitle}>glovebox</Text>
        {totalDocs > 0 ? (
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressTextLeft}>{totalDocs} out of {maxDocs} documents stored</Text>
            <Text style={styles.progressTextRight}>{progressPercent}% COMPLETE</Text>
          </View>
        ) : (
          <Text style={styles.headerSubtitle}>one place for all your vehicle documents</Text>
        )}
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 24,
  },
  headerTitleContainer: {
    marginLeft: 16,
    justifyContent: 'center',
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Outfit-Bold',
    color: '#FFF',
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    textTransform: 'lowercase',
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
    color: '#666',
    marginTop: 1,
    textTransform: 'lowercase',
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  progressTextLeft: {
    fontSize: 11,
    fontFamily: 'Outfit-Regular',
    color: '#8E8E93',
    textTransform: 'lowercase',
  },
  progressTextRight: {
    fontSize: 10,
    fontFamily: 'Outfit-Bold',
    color: '#FF9800',
    letterSpacing: 1,
  },
  headerSpacer: {
    width: 44,
  },
});
