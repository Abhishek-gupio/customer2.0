import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert, SafeAreaView, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { useRoute, useNavigation } from '../../lib/react-navigation-native';
import { X } from 'lucide-react-native';
import { api } from '../../services/api';
import { useAppDispatch } from '../../store/hooks';
import { fetchDocuments } from '../../store/slices/documentsSlice';

export default function DigiLockerKYC() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);

  // Extract and validate URL rigorously to prevent Render Error
  const params = route.params || {};
  const rawUrl = params.url;
  const client_id = params.client_id;
  
  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';

  useEffect(() => {
    if (!url) {
       console.error('[DigiLocker] No URL provided to KYC screen');
    }
  }, [url]);

  const handleNavigationStateChange = async (navState: any) => {
    // Detect redirect to success page
    if (navState.url && navState.url.includes('/api/v1/documents/digilocker/success')) {
      setLoading(true);
      try {
        await api.post('/v1/documents/digilocker/sync', { client_id });
        dispatch(fetchDocuments());
        navigation.goBack();
        Alert.alert('Success', 'Verified successfully!');
      } catch (error: any) {
        Alert.alert('Sync Failed', error.message || 'Failed to sync');
        navigation.goBack();
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Verification</Text>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
          <X size={24} color="#FFF" />
        </TouchableOpacity>
      </View>
      
      {url ? (
        <View style={{ flex: 1 }}>
          <WebView
            source={{ uri: url }}
            onNavigationStateChange={handleNavigationStateChange}
            onLoadEnd={() => setLoading(false)}
            onError={(e) => {
              setLoading(false);
              Alert.alert('Error', 'Verification page failed to load.');
            }}
            // Most stable props for Android
            javaScriptEnabled={true}
            domStorageEnabled={true}
            startInLoadingState={true}
            scalesPageToFit={true}
          />
        </View>
      ) : (
        <View style={styles.errorContainer}>
           <Text style={styles.errorText}>Invalid verification link.</Text>
           <TouchableOpacity onPress={() => navigation.goBack()} style={{marginTop: 20}}>
             <Text style={{color: '#FFC107'}}>Go Back</Text>
           </TouchableOpacity>
        </View>
      )}

      {loading && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color="#FFC107" />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: '#222' 
  },
  title: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  closeBtn: { position: 'absolute', right: 16 },
  loaderOverlay: { 
    ...StyleSheet.absoluteFillObject, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center',
    zIndex: 999
  },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { color: '#FFF', fontSize: 16, textAlign: 'center' }
});
