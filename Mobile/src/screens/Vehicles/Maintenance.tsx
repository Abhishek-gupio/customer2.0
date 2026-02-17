import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const Maintenance = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Service History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {[1, 2, 3].map((item) => (
          <View key={item} style={styles.logCard}>
            <View style={styles.logHeader}>
              <Text style={styles.logType}>Periodic Service</Text>
              <Text style={styles.logDate}>Oct 12, 2023</Text>
            </View>
            <View style={styles.divider} />
            <Text style={styles.logDetails}>Oil change, Air filter replacement, General checkup</Text>
            <Text style={styles.logPrice}>₹ 4,500</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: wp(6), paddingVertical: hp(2), flexDirection: 'row', alignItems: 'center' },
  backBtn: { marginRight: wp(4) },
  title: { color: '#fff', fontSize: wp(6), fontWeight: 'bold' },
  content: { paddingHorizontal: wp(6), paddingTop: hp(2) },
  logCard: { backgroundColor: '#1a1a1a', padding: wp(5), borderRadius: 20, marginBottom: hp(2), borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: hp(1) },
  logType: { color: '#fff', fontSize: wp(4), fontWeight: 'bold' },
  logDate: { color: '#666', fontSize: wp(3) },
  divider: { height: 1, backgroundColor: '#333', marginVertical: hp(1.5) },
  logDetails: { color: '#aaa', fontSize: wp(3.2), lineHeight: 20 },
  logPrice: { color: '#4ade80', fontSize: wp(4), fontWeight: 'bold', marginTop: hp(1.5), textAlign: 'right' }
});

export default Maintenance;