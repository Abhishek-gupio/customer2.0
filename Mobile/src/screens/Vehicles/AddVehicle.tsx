import React from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const AddVehicle = ({ navigation }: any) => {
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Register New Vehicle</Text>
          <Text style={styles.subtitle}>Enter your vehicle details to get started with maintenance tracking.</Text>

          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Text style={styles.label}>License Plate</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. DL 01 AB 1234" 
                placeholderTextColor="#444"
                autoCapitalize="characters"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.label}>Vehicle Model</Text>
              <TextInput 
                style={styles.input} 
                placeholder="e.g. Maruti Suzuki Swift" 
                placeholderTextColor="#444"
              />
            </View>

            <TouchableOpacity style={styles.submitBtn} activeOpacity={0.8} onPress={() => navigation.goBack()}>
              <Text style={styles.submitText}>Save Vehicle</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: wp(6), paddingTop: hp(2) },
  backBtn: { width: wp(10), height: wp(10), justifyContent: 'center' },
  content: { paddingHorizontal: wp(8), marginTop: hp(4) },
  title: { color: '#fff', fontSize: wp(7), fontWeight: 'bold' },
  subtitle: { color: '#666', fontSize: wp(3.8), marginTop: hp(1), lineHeight: 22 },
  form: { marginTop: hp(6) },
  inputWrapper: { marginBottom: hp(3) },
  label: { color: '#aaa', fontSize: wp(3.2), fontWeight: 'bold', marginBottom: hp(1.5), textTransform: 'uppercase', letterSpacing: 1 },
  input: { 
    backgroundColor: '#161616', 
    color: '#fff', 
    padding: wp(4.5), 
    borderRadius: 15, 
    fontSize: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)'
  },
  submitBtn: { 
    backgroundColor: '#fff', 
    paddingVertical: hp(2), 
    borderRadius: 18, 
    alignItems: 'center', 
    marginTop: hp(4),
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 5
  },
  submitText: { color: '#000', fontWeight: 'bold', fontSize: wp(4.2) }
});

export default AddVehicle;