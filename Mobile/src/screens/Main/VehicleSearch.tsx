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
  Keyboard,
  TouchableWithoutFeedback,
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

  const handleDLVerification = () => {
    navigation.navigate('DLVerification');
  };

  const handleFastag = () => {
    navigation.navigate('Fastag');
  };

  const isValidPlate = searchQuery.length >= 6;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        
        {/* Header Section */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Search & Services</Text>
        </View>

        {/* Dynamic Search Bar Section */}
        <View style={styles.searchSection}>
          <View style={styles.searchBarContainer}>
            <View style={styles.flagContainer}>
              <View style={styles.flagIcon}>
                <View style={styles.flagBlueDot} />
                <Text style={styles.indText}>IND</Text>
              </View>
            </View>
            
            <TextInput
              style={styles.searchInput}
              placeholder="Enter Vehicle Number"
              placeholderTextColor="rgba(0,0,0,0.4)"
              value={searchQuery}
              onChangeText={(t) => setSearchQuery(t.toUpperCase())}
              autoCapitalize="characters"
              placeholderStyle={{ fontFamily: 'Outfit-Medium' }}
            />
            
            <TouchableOpacity 
              style={[styles.searchActionBtn, { opacity: isValidPlate ? 1 : 0.5 }]} 
              disabled={!isValidPlate}
              onPress={() => {}}
            >
              <MaterialIcon name="magnify" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
          <Text style={styles.searchHint}>e.g. MH01AB1234, DL3C1234</Text>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Main Services Grid - Always Visible */}
          <Text style={styles.sectionTitle}>Essential Services</Text>
          <View style={styles.servicesGrid}>
            <TouchableOpacity style={styles.serviceCard} onPress={handleDLVerification}>
              <View style={[styles.serviceIconContainer, { backgroundColor: 'rgba(255, 191, 0, 0.1)' }]}>
                <MaterialIcon name="card-account-details-star-outline" size={32} color="#FFBF00" />
              </View>
              <Text style={styles.serviceTitle}>DL Verification</Text>
              <Text style={styles.serviceDesc}>Verify your DL instantly</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.serviceCard} onPress={handleFastag}>
              <View style={[styles.serviceIconContainer, { backgroundColor: 'rgba(0, 200, 255, 0.1)' }]}>
                <MaterialIcon name="tag-outline" size={32} color="#00C8FF" />
              </View>
              <Text style={styles.serviceTitle}>FASTag Services</Text>
              <Text style={styles.serviceDesc}>Check balance & recharge</Text>
            </TouchableOpacity>
          </View>

          {/* Vehicle Specific Actions - Context Sensitive */}
          <Text style={styles.sectionTitle}>Vehicle Actions</Text>
          <View style={styles.actionsContainer}>
             <TouchableOpacity 
               style={[styles.actionRow, !isValidPlate && styles.disabledAction]} 
               onPress={handleCheckChallan}
               disabled={!isValidPlate}
             >
                <View style={[styles.smallIconBox, { backgroundColor: '#1A1A1A' }]}>
                   <MaterialIcon name="file-document-outline" size={24} color={isValidPlate ? "#00c3ff" : "#444"} />
                </View>
                <View style={styles.actionTextContainer}>
                   <Text style={[styles.actionTitle, !isValidPlate && styles.disabledText]}>Check Challans</Text>
                   <Text style={styles.actionSubtitle}>Check traffic violations for this vehicle</Text>
                </View>
                {isValidPlate && <Ionicons name="chevron-forward" size={20} color="#666" />}
             </TouchableOpacity>

             <TouchableOpacity 
               style={[styles.actionRow, !isValidPlate && styles.disabledAction]} 
               onPress={handleRCVerification}
               disabled={!isValidPlate}
             >
                <View style={[styles.smallIconBox, { backgroundColor: '#1A1A1A' }]}>
                   <MaterialIcon name="card-search-outline" size={24} color={isValidPlate ? "#00ff88" : "#444"} />
                </View>
                <View style={styles.actionTextContainer}>
                   <Text style={[styles.actionTitle, !isValidPlate && styles.disabledText]}>RC Verification</Text>
                   <Text style={styles.actionSubtitle}>Verify RC details & ownership</Text>
                </View>
                {isValidPlate && <Ionicons name="chevron-forward" size={20} color="#666" />}
             </TouchableOpacity>
          </View>

          {!isValidPlate && (
             <View style={styles.infoBanner}>
                <MaterialIcon name="information-outline" size={20} color="#666" />
                <Text style={styles.infoBannerText}>Enter a valid vehicle number to unlock vehicle actions</Text>
             </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </TouchableWithoutFeedback>
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
    paddingHorizontal: wp(5),
    paddingTop: hp(2),
    paddingBottom: hp(1),
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
  },
  searchSection: {
    paddingHorizontal: wp(5),
    paddingVertical: hp(2),
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 64,
    overflow: 'hidden',
    shadowColor: "#FFBF00",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  flagContainer: {
    backgroundColor: '#003399',
    width: 48,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flagIcon: {
    alignItems: 'center',
  },
  flagBlueDot: {
    width: 6,
    height: 6,
    backgroundColor: '#FFBF00',
    borderRadius: 3,
    marginBottom: 4,
  },
  indText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
    fontFamily: 'Outfit-Bold',
  },
  searchInput: {
    flex: 1,
    color: '#000',
    fontSize: wp(5),
    fontFamily: 'Outfit-Bold',
    paddingHorizontal: 16,
    letterSpacing: 1.5,
  },
  searchActionBtn: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#000',
    marginRight: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHint: {
    color: '#555',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
    marginTop: 10,
    marginLeft: 4,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: wp(5),
    paddingBottom: hp(5),
  },
  sectionTitle: {
    color: '#888',
    fontSize: wp(3.5),
    fontFamily: 'Outfit-Bold',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: hp(3),
    marginBottom: hp(2),
    marginLeft: 4,
  },
  servicesGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  serviceCard: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    padding: wp(4),
    alignItems: 'flex-start',
  },
  serviceIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  serviceTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
    marginBottom: 4,
  },
  serviceDesc: {
    color: '#666',
    fontSize: wp(3),
    fontFamily: 'Outfit-Regular',
  },
  actionsContainer: {
    backgroundColor: '#0D0D0D',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#1A1A1A',
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  disabledAction: {
    opacity: 0.5,
  },
  smallIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionTextContainer: {
    flex: 1,
  },
  actionTitle: {
    color: '#fff',
    fontSize: wp(4),
    fontFamily: 'Outfit-Bold',
  },
  disabledText: {
    color: '#666',
  },
  actionSubtitle: {
    color: '#555',
    fontSize: wp(3),
    fontFamily: 'Outfit-Regular',
    marginTop: 2,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,191,0,0.05)',
    padding: 16,
    borderRadius: 16,
    marginTop: hp(4),
    gap: 10,
  },
  infoBannerText: {
    color: '#666',
    fontSize: wp(3.2),
    fontFamily: 'Outfit-Medium',
  },
});
