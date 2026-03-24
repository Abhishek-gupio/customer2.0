import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

export default function VehicleSearch() {
  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleBack = () => navigation.goBack();

  const handleRCVerification = () => {
    if (searchQuery.length >= 6) {
      navigation.navigate('AddVehicle', { registrationNumber: searchQuery });
    }
  };

  const handleCheckChallan = () => {
    if (searchQuery.length >= 6) {
      navigation.navigate('Challans', { vehicle: { registrationNumber: searchQuery } });
    }
  };

  const isValidPlate = searchQuery.length >= 6;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* Header with Search Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.searchBarContainer}>
          <View style={styles.flagContainer}>
            <View style={styles.flagIcon}>
              <View style={styles.flagBlueDot} />
              <Text style={styles.indText}>IND</Text>
            </View>
          </View>
          
          <TextInput
            style={styles.searchInput}
            placeholder="UP 80 CJ 4222"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={(t) => setSearchQuery(t.toUpperCase())}
            autoFocus
            autoCapitalize="characters"
          />
          
          <TouchableOpacity style={styles.searchIconContainer} onPress={() => {}}>
            <MaterialIcon name="magnify" size={26} color="#000" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isValidPlate && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>Quick Actions for {searchQuery}</Text>
            <View style={styles.actionsGrid}>
              <TouchableOpacity style={styles.actionButton} onPress={handleCheckChallan}>
                <View style={[styles.actionIconContainer, { backgroundColor: '#111' }]}>
                  <MaterialIcon name="file-document-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionText}>Check Challan</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.actionButton} onPress={handleRCVerification}>
                <View style={[styles.actionIconContainer, { backgroundColor: '#111' }]}>
                  <MaterialIcon name="card-account-details-outline" size={28} color="#fff" />
                </View>
                <Text style={styles.actionText}>RC Verification</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: hp(4),
    paddingBottom: hp(2),
  },
  backButton: {
    marginRight: 12,
  },
  searchBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 56,
    paddingLeft: 0,
    overflow: 'hidden',
  },
  flagContainer: {
    backgroundColor: '#003399',
    width: 44,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagIcon: {
    alignItems: 'center',
  },
  flagBlueDot: {
    width: 5,
    height: 5,
    backgroundColor: '#8BC34A',
    borderRadius: 2.5,
    marginBottom: 4,
  },
  indText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: 22,
    fontWeight: '900',
    paddingHorizontal: 16,
    letterSpacing: 2,
  },
  searchIconContainer: {
    paddingRight: 16,
  },
  content: {
    flex: 1,
  },
  resultsContainer: {
    padding: 24,
    marginTop: hp(2),
  },
  resultsTitle: {
    color: '#666',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 20,
    textAlign: 'center',
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#222',
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
