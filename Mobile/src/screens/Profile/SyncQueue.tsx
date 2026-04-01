import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import BackButton from '../../components/BackButton';
import { flushQueuedDocumentUploads, flushQueuedExpenseCreates, getQueuedActionSummary } from '../../services/offlineMutationQueue';
import { getNetworkOnlineState } from '../../services/api';

type NavProp = NativeStackNavigationProp<RootStackParamList, 'SyncQueue'>;

export default function SyncQueueScreen() {
  const navigation = useNavigation<NavProp>();
  const [summary, setSummary] = useState(getQueuedActionSummary());
  const [syncing, setSyncing] = useState(false);
  const online = getNetworkOnlineState();

  const refreshSummary = () => setSummary(getQueuedActionSummary());

  useEffect(() => {
    const t = setInterval(refreshSummary, 2000);
    return () => clearInterval(t);
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const [docs, expenses] = await Promise.all([
        flushQueuedDocumentUploads(),
        flushQueuedExpenseCreates(),
      ]);
      refreshSummary();
      Alert.alert('Sync complete', `Uploaded ${docs.uploaded} documents and ${expenses.uploaded} expenses.`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <Text style={styles.title}>Sync Queue</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Queued actions</Text>
        <Text style={styles.row}>Document uploads: {summary.documentUploads}</Text>
        <Text style={styles.row}>Expense saves: {summary.expenseCreates}</Text>
        <Text style={[styles.status, online ? styles.online : styles.offline]}>
          {online ? 'Online' : 'Offline - waiting to sync'}
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (syncing || !online) && styles.buttonDisabled]}
        onPress={handleSync}
        disabled={syncing || !online}
      >
        <Text style={styles.buttonText}>{syncing ? 'Syncing...' : 'Sync now'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b', padding: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', marginLeft: 12 },
  card: { backgroundColor: '#18181b', borderRadius: 20, padding: 18, marginBottom: 20 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { color: '#d4d4d8', fontSize: 15, marginTop: 6 },
  status: { marginTop: 14, fontWeight: '700' },
  online: { color: '#4ade80' },
  offline: { color: '#f87171' },
  button: { backgroundColor: '#facc15', paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#111827', fontWeight: '800', fontSize: 16 },
});
