import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { ArrowRight, FileText } from 'lucide-react-native';

type DigiLockerBannerProps = {
  hasDocuments: boolean;
  onPress: () => void;
};

export default function DigiLockerBanner({ hasDocuments, onPress }: DigiLockerBannerProps) {
  return (
    <View style={styles.digiBanner}>
      <View style={styles.digiRow}>
        <View style={styles.digiContentLeft}>
          <Text style={styles.digiTitle}>
            {hasDocuments
              ? 'add your official driving license to your glovebox'
              : 'accepted as official documents by traffic police everywhere'}
          </Text>

          <TouchableOpacity style={styles.digiBtn} onPress={onPress}>
            <View style={styles.digiBtnContent}>
              <View style={styles.digiLogoPlaceholder}>
                <FileText size={14} color="#FFF" />
              </View>
              <Text style={styles.digiBtnText}>Link to Digilocker</Text>
            </View>
            <ArrowRight size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
        <View style={styles.digiGraphic}>
          <Image
            source={require('../../assets/images/document.png') as any}
            style={styles.digiImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  digiBanner: { backgroundColor: '#FFF', borderRadius: 16, padding: 24, marginTop: 32 },
  digiRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  digiContentLeft: { flex: 1, paddingRight: 16 },
  digiTitle: { fontSize: 16, fontFamily: 'Outfit-Bold', color: '#000', lineHeight: 22, fontWeight: '700', marginBottom: 12 },
  digiGraphic: { width: 75, alignItems: 'flex-end', justifyContent: 'flex-start', marginTop: -10, marginRight: -4 },
  digiImage: { width: 75, height: 75 },
  digiBtn: { backgroundColor: '#111', borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, alignSelf: 'flex-start' },
  digiBtnContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  digiLogoPlaceholder: { width: 20, height: 20, borderRadius: 4, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' },
  digiBtnText: { color: '#FFF', fontSize: 12, fontFamily: 'Outfit-Bold', fontWeight: '600', marginRight: 12 },
});
