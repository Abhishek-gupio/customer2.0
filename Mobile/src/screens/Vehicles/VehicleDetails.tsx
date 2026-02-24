import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView } from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const VehicleDetails = ({ navigation, route }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Details</Text>
        <TouchableOpacity style={styles.editBtn}>
          <FontAwesome5 name="edit" size={wp(4.5)} color="#aaa" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: wp(6), paddingTop: hp(2) }}>
        <View style={styles.heroCard}>
          <View style={styles.placeholderImg}>
            <FontAwesome5 name="car" size={wp(15)} color="#333" />
          </View>
          <Text style={styles.plateLarge}>DL 01 AB 1234</Text>
          <Text style={styles.modelSub}>Maruti Suzuki Swift • 2022</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Component Health</Text>
          <View style={styles.healthGrid}>
            <View style={styles.healthCard}>
              <FontAwesome5 name="battery-full" size={wp(6)} color="#4ade80" />
              <Text style={styles.healthLabel}>Battery</Text>
              <Text style={styles.healthVal}>92%</Text>
            </View>
            <View style={styles.healthCard}>
              <FontAwesome5 name="oil-can" size={wp(6)} color="#fbbf24" />
              <Text style={styles.healthLabel}>Engine Oil</Text>
              <Text style={styles.healthVal}>74%</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: wp(6), paddingVertical: hp(2) },
  backBtn: { width: wp(10), height: wp(10), justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: wp(4.5), fontWeight: 'bold' },
  editBtn: { width: wp(10), height: wp(10), justifyContent: 'center', alignItems: 'flex-end' },
  heroCard: { alignItems: 'center', marginVertical: hp(2) },
  placeholderImg: { width: wp(80), height: hp(20), backgroundColor: '#1a1a1a', borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  plateLarge: { color: '#fff', fontSize: wp(6), fontWeight: 'bold', marginTop: hp(3) },
  modelSub: { color: '#777', fontSize: wp(3.5), marginTop: 4 },
  section: { marginTop: hp(4) },
  sectionTitle: { color: '#fff', fontSize: wp(4.5), fontWeight: 'bold', marginBottom: hp(2) },
  healthGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  healthCard: { backgroundColor: '#1a1a1a', width: wp(42), padding: wp(5), borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  healthLabel: { color: '#777', fontSize: wp(3.2), marginTop: hp(1) },
  healthVal: { color: '#fff', fontSize: wp(5), fontWeight: 'bold', marginTop: 4 }
});

export default VehicleDetails;