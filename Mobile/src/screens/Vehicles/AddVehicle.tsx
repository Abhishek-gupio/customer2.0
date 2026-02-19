import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
  Pressable,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const VEHICLE_TYPES = ['Car', 'Bike'];

const BRANDS = [
  'Maruti Suzuki',
  'Hyundai',
  'Honda',
  'Toyota',
  'Kia',
  'Tata',
  'Mahindra',
  'Ford',
  'Volkswagen',
  'Renault',
];

const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic'];

const AddVehicle = ({ navigation }: any) => {
  const updateForm = (key: string, value: string) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };
  const [form, setForm] = useState({
    plate: '',
    model: '',
    brand: 'Maruti Suzuki',
    year: '',
    type: 'Car',
    fuel: 'Petrol',
    transmission: 'Manual',
    isPrimary: true,
  });

  const [errors, setErrors] = useState<{ plate?: string; model?: string }>({});

  const validateForm = () => {
    const newErrors: { plate?: string; model?: string } = {};
    if (!form.plate.trim()) newErrors.plate = 'Vehicle number is required';
    if (!form.model.trim()) newErrors.model = 'Model is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (!validateForm()) return;
    navigation.navigate('VehicleList', {
      newVehicle: {
        plate: form.plate,
        model: form.model,
        year: form.year || '2024',
      },
    });
  };

  const DropdownField = ({
    label,
    value,
    options,
    onSelect,
  }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (val: string) => void;
  }) => {
    const [modalVisible, setModalVisible] = useState(false);
    return (
      <View style={styles.inputContainer}>
        <Text style={styles.label}>{label}</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.dropdownText}>{value}</Text>
          <FontAwesome5 name="chevron-down" size={wp(3)} color="#666" />
        </TouchableOpacity>
        <Modal
          visible={modalVisible}
          transparent
          animationType="slide"
          onRequestClose={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalOverlay}
            onPress={() => setModalVisible(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{label}</Text>
              <FlatList
                data={options}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.modalItem,
                      item === value && styles.modalItemSelected,
                    ]}
                    onPress={() => {
                      onSelect(item);
                      setModalVisible(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.modalItemText,
                        item === value && styles.modalItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
              />
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={Platform.OS === 'android' ? '#0a0a0a' : undefined}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.85}
        >
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add New Vehicle</Text>
          <Text style={styles.headerSub}>Register your vehicle details</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Vehicle Number Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Number *</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="e.g. DL 01 AB 1234"
              placeholderTextColor="#666"
              value={form.plate}
              onChangeText={val => updateForm('plate', val)}
              autoCapitalize="characters"
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => updateForm('plate', form.plate)}
            >
              <FontAwesome5 name="search" size={wp(4)} color="#FFBF00" />
            </TouchableOpacity>
          </View>
          {errors.plate && <Text style={styles.errorText}>{errors.plate}</Text>}
          <Text style={styles.helperText}>
            Enter vehicle number and click search to auto-fill details
          </Text>
        </View>

        {/* Photo Upload Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Photo</Text>
          <TouchableOpacity style={styles.photoUpload} activeOpacity={0.7}>
            <View style={styles.cameraCircle}>
              <FontAwesome5 name="camera" size={wp(6)} color="#666" />
            </View>
            <Text style={styles.uploadMain}>Upload Vehicle Photo</Text>
            <Text style={styles.uploadSub}>Tap to take photo or upload</Text>
          </TouchableOpacity>
        </View>

        {/* Vehicle Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Vehicle Details</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: wp(2) }}>
              <DropdownField
                label="Vehicle Type"
                value={form.type}
                options={VEHICLE_TYPES}
                onSelect={val => setForm({ ...form, type: val })}
              />
            </View>
            <View style={{ flex: 1, marginLeft: wp(2) }}>
              <DropdownField
                label="Brand"
                value={form.brand}
                options={BRANDS}
                onSelect={val => setForm({ ...form, brand: val })}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: wp(2) }}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Model *</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Swift"
                    placeholderTextColor="#666"
                    value={form.model}
                    onChangeText={val => updateForm('model', val)}
                  />
                </View>
                {errors.model && (
                  <Text style={styles.errorText}>{errors.model}</Text>
                )}
              </View>
            </View>
            <View style={{ flex: 1, marginLeft: wp(2) }}>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Year *</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2022"
                    placeholderTextColor="#666"
                    value={form.year}
                    onChangeText={val => updateForm('year', val)}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Additional Details Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Additional Details</Text>
          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: wp(2) }}>
              <DropdownField
                label="Fuel Type"
                value={form.fuel}
                options={FUEL_TYPES}
                onSelect={val => setForm({ ...form, fuel: val })}
              />
            </View>
            <View style={{ flex: 1, marginLeft: wp(2) }}>
              <DropdownField
                label="Transmission"
                value={form.transmission}
                options={TRANSMISSIONS}
                onSelect={val => setForm({ ...form, transmission: val })}
              />
            </View>
          </View>
        </View>

        {/* Set as Primary Checkbox UI */}
        <TouchableOpacity
          style={styles.checkboxContainer}
          activeOpacity={0.8}
          onPress={() => setForm({ ...form, isPrimary: !form.isPrimary })}
        >
          <View
            style={[styles.checkbox, form.isPrimary && styles.checkboxActive]}
          >
            {form.isPrimary && (
              <FontAwesome5 name="check" size={wp(3)} color="#000" />
            )}
          </View>
          <Text style={styles.checkboxLabel}>Set as Primary Vehicle</Text>
        </TouchableOpacity>

        {/* Bottom Save Button */}
        <TouchableOpacity
          style={styles.saveBtn}
          activeOpacity={0.8}
          onPress={handleSave}
        >
          <Text style={styles.saveText}>Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  backBtn: {
    padding: wp(2),
    width: wp(10),
    height: wp(10),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: wp(2.5),
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: { flex: 1, marginLeft: wp(3) },
  headerTitle: {
    color: '#fff',
    fontSize: wp(5.5),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSub: { color: '#666', fontSize: wp(3.2), marginTop: hp(0.3) },
  searchBtn: {
    width: wp(12),
    height: wp(12),
    borderRadius: wp(3),
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: wp(1),
  },
  scrollContent: {
    paddingHorizontal: wp(4),
    paddingBottom: hp(6),
    paddingTop: hp(2.5),
  },
  card: {
    backgroundColor: '#141414',
    borderRadius: 24,
    padding: wp(5),
    marginBottom: hp(2.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  cardTitle: {
    color: '#fff',
    fontSize: wp(4.2),
    fontWeight: '600',
    marginBottom: hp(2),
    letterSpacing: 0.3,
  },
  inputContainer: { marginBottom: hp(1.5) },
  label: {
    color: '#777',
    fontSize: wp(3),
    fontWeight: '500',
    marginBottom: hp(1),
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f0f0f',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  input: {
    flex: 1,
    color: '#fff',
    padding: wp(4),
    fontSize: wp(3.6),
    fontWeight: '500',
  },
  inputIcon: { position: 'absolute', right: wp(4.5) },
  errorText: {
    color: '#FF5252',
    fontSize: wp(2.8),
    marginTop: 6,
    fontWeight: '500',
  },
  helperText: { color: '#444', fontSize: wp(2.6), marginTop: 8 },
  photoUpload: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    borderRadius: 20,
    padding: wp(6),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0c0c0c',
  },
  cameraCircle: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  uploadMain: { color: '#e0e0e0', fontSize: wp(3.8), fontWeight: '600' },
  uploadSub: { color: '#555', fontSize: wp(2.8), marginTop: 6 },
  sectionTitle: {
    color: '#fff',
    fontSize: wp(4.8),
    fontWeight: 'bold',
    marginBottom: hp(2.5),
    marginTop: hp(1),
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: -wp(1),
  },
  dropdown: {
    backgroundColor: '#0f0f0f',
    borderRadius: 16,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  dropdownText: { color: '#fff', fontSize: wp(3.6), fontWeight: '500' },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(1),
    marginBottom: hp(3.5),
    paddingVertical: hp(1.5),
    paddingHorizontal: wp(3),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  checkbox: {
    width: wp(5),
    height: wp(5),
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#444',
    marginRight: wp(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  checkboxLabel: {
    color: '#aaa',
    fontSize: wp(3.4),
    fontWeight: '500',
    flex: 1,
  },
  saveBtn: {
    backgroundColor: '#FFBF00',
    paddingVertical: hp(1.9),
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  saveText: {
    color: '#0a0a0a',
    fontSize: wp(4),
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#151515',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: hp(5),
    maxHeight: hp(65),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: '600',
    textAlign: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  modalItem: {
    paddingVertical: hp(2.2),
    paddingHorizontal: wp(6),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  modalItemSelected: { backgroundColor: 'rgba(255,191,0,0.1)' },
  modalItemText: { color: '#ccc', fontSize: wp(4), fontWeight: '500' },
  modalItemTextSelected: { color: '#FFBF00', fontWeight: '700' },
});

export default AddVehicle;
