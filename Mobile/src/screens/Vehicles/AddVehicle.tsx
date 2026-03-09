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
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const VEHICLE_TYPES = ['Car', 'Bike', 'SUV', 'Truck', 'Van'];

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
  'MG',
  'Skoda',
  'BMW',
  'Mercedes',
  'Audi',
];

const FUEL_TYPES = ['Petrol', 'Diesel', 'Electric', 'CNG', 'Hybrid'];
const TRANSMISSIONS = ['Manual', 'Automatic', 'AMT', 'CVT'];

interface AddVehicleProps {
  navigation: any;
  route?: any;
}

const AddVehicle: React.FC<AddVehicleProps> = ({ navigation, route }) => {
  const [form, setForm] = useState({
    plate: '',
    model: '',
    brand: 'Maruti Suzuki',
    year: new Date().getFullYear().toString(),
    type: 'Car',
    fuel: 'Petrol',
    transmission: 'Manual',
    isPrimary: true,
  });

  const [errors, setErrors] = useState<{
    plate?: string;
    model?: string;
    brand?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
    if (errors[key as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [key]: undefined }));
    }
  };

  const validateForm = () => {
    const newErrors: typeof errors = {};
    if (!form.plate.trim()) {
      newErrors.plate = 'Vehicle number is required';
    } else if (form.plate.length < 4) {
      newErrors.plate = 'Please enter a valid vehicle number';
    }
    if (!form.model.trim()) {
      newErrors.model = 'Model is required';
    }
    if (!form.brand.trim()) {
      newErrors.brand = 'Brand is required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      const newVehicle = {
        id: Date.now().toString(),
        plate: form.plate.toUpperCase(),
        brand: form.brand,
        model: form.model,
        year: form.year || new Date().getFullYear().toString(),
        type: form.type,
        fuel: form.fuel,
        transmission: form.transmission,
        isPrimary: form.isPrimary,
        healthScore: Math.floor(Math.random() * 30) + 70,
        addedAt: new Date().toISOString(),
      };

      Alert.alert('Success!', 'Vehicle added successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('VehicleList', { newVehicle }),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save vehicle. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const DropdownField = ({
    label,
    value,
    options,
    onSelect,
    error,
  }: {
    label: string;
    value: string;
    options: string[];
    onSelect: (val: string) => void;
    error?: string;
  }) => {
    const [modalVisible, setModalVisible] = useState(false);
    return (
      <View style={styles.fieldContainer}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TouchableOpacity
          style={[styles.dropdown, error && styles.dropdownError]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.dropdownText}>{value}</Text>
          <FontAwesome5 name="chevron-down" size={wp(3.5)} color="#666" />
        </TouchableOpacity>
        {error && <Text style={styles.errorText}>{error}</Text>}
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
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.modalKeyboardView}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHandle} />
                <Text style={styles.modalTitle}>{label}</Text>
                <FlatList
                  data={options}
                  keyExtractor={item => item}
                  showsVerticalScrollIndicator={false}
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
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.modalItemText,
                          item === value && styles.modalItemTextSelected,
                        ]}
                      >
                        {item}
                      </Text>
                      {item === value && (
                        <FontAwesome5
                          name="check"
                          size={wp(4)}
                          color="#FFBF00"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                />
              </View>
            </KeyboardAvoidingView>
          </Pressable>
        </Modal>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />

      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Add New Vehicle</Text>
          <Text style={styles.headerSubtitle}>
            Register your vehicle details
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Vehicle Number</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.card}>
              <View style={styles.plateInputContainer}>
                <TextInput
                  style={styles.plateInput}
                  placeholder="DL 01 AB 1234"
                  placeholderTextColor="#3a3a3a"
                  value={form.plate}
                  onChangeText={val => updateForm('plate', val.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={15}
                />
                <TouchableOpacity style={styles.searchBtn} activeOpacity={0.7}>
                  <FontAwesome5 name="search" size={wp(4)} color="#FFBF00" />
                </TouchableOpacity>
              </View>
              {errors.plate && (
                <Text style={styles.errorText}>{errors.plate}</Text>
              )}
              <Text style={styles.helperText}>
                Enter vehicle number to auto-fetch details from RTO
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Vehicle Photo</Text>
              <View style={styles.sectionLine} />
            </View>

            <TouchableOpacity style={styles.photoCard} activeOpacity={0.7}>
              <View style={styles.cameraCircle}>
                <FontAwesome5 name="camera" size={wp(8)} color="#444" />
              </View>
              <Text style={styles.uploadMain}>Add Vehicle Photo</Text>
              <Text style={styles.uploadSub}>
                Tap to capture or upload from gallery
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Vehicle Details</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: wp(1.5) }}>
                  <DropdownField
                    label="Vehicle Type"
                    value={form.type}
                    options={VEHICLE_TYPES}
                    onSelect={val => updateForm('type', val)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: wp(1.5) }}>
                  <DropdownField
                    label="Brand"
                    value={form.brand}
                    options={BRANDS}
                    onSelect={val => updateForm('brand', val)}
                    error={errors.brand}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: wp(1.5) }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Model *</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.model && styles.inputError,
                      ]}
                    >
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Swift"
                        placeholderTextColor="#3a3a3a"
                        value={form.model}
                        onChangeText={val => updateForm('model', val)}
                      />
                    </View>
                    {errors.model && (
                      <Text style={styles.errorText}>{errors.model}</Text>
                    )}
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: wp(1.5) }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Year</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="2024"
                        placeholderTextColor="#3a3a3a"
                        value={form.year}
                        onChangeText={val => updateForm('year', val)}
                        keyboardType="numeric"
                        maxLength={4}
                      />
                    </View>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionLine} />
              <Text style={styles.sectionLabel}>Additional Details</Text>
              <View style={styles.sectionLine} />
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: wp(1.5) }}>
                  <DropdownField
                    label="Fuel Type"
                    value={form.fuel}
                    options={FUEL_TYPES}
                    onSelect={val => updateForm('fuel', val)}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: wp(1.5) }}>
                  <DropdownField
                    label="Transmission"
                    value={form.transmission}
                    options={TRANSMISSIONS}
                    onSelect={val => updateForm('transmission', val)}
                  />
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={styles.checkboxContainer}
            activeOpacity={0.8}
            onPress={() => updateForm('isPrimary', !form.isPrimary)}
          >
            <View
              style={[styles.checkbox, form.isPrimary && styles.checkboxActive]}
            >
              {form.isPrimary && (
                <FontAwesome5 name="check" size={wp(3)} color="#000" />
              )}
            </View>
            <View style={styles.checkboxTextContainer}>
              <Text style={styles.checkboxLabel}>Set as Primary Vehicle</Text>
              <Text style={styles.checkboxSubtext}>
                This vehicle will be shown first in your list
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
            activeOpacity={0.8}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <FontAwesome5 name="circle-notch" size={wp(5)} color="#000" />
            ) : (
              <>
                <FontAwesome5 name="plus" size={wp(5)} color="#000" />
                <Text style={styles.saveText}>Add Vehicle</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footerInfo}>
            <FontAwesome5 name="shield-alt" size={14} color="#555" />
            <Text style={styles.footerText}>
              Your vehicle data is secure and encrypted. We only share data with
              authorized RTO services.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerCenter: { flex: 1, marginLeft: wp(3) },
  headerRight: { width: 44 },
  headerTitle: { color: '#fff', fontSize: wp(5.5), fontWeight: 'bold' },
  headerSubtitle: { color: '#666', fontSize: wp(3.2), marginTop: 2 },

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(6) },
  section: { marginTop: hp(3) },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sectionLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: wp(3),
  },

  card: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  plateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  plateInput: {
    flex: 1,
    color: '#fff',
    padding: wp(4),
    fontSize: wp(4.5),
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  searchBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: 'rgba(255,191,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: wp(1),
  },
  errorText: {
    color: '#ef4444',
    fontSize: wp(2.8),
    marginTop: hp(0.5),
    fontWeight: '500',
  },
  helperText: { color: '#444', fontSize: wp(2.8), marginTop: hp(1) },

  photoCard: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: wp(6),
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    borderStyle: 'dashed',
  },
  cameraCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1.5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  uploadMain: { color: '#fff', fontSize: wp(4), fontWeight: '600' },
  uploadSub: { color: '#555', fontSize: wp(3), marginTop: hp(0.5) },

  row: { flexDirection: 'row', marginHorizontal: -wp(1.5) },
  fieldContainer: { marginBottom: hp(1) },
  fieldLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: hp(1),
    marginLeft: wp(1),
  },
  inputWrapper: {
    backgroundColor: '#0a0a0a',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  inputError: { borderColor: 'rgba(239,68,68,0.3)' },
  input: {
    color: '#fff',
    padding: wp(3.5),
    fontSize: wp(3.8),
    fontWeight: '500',
  },
  dropdown: {
    backgroundColor: '#0a0a0a',
    borderRadius: 14,
    padding: wp(3.5),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  dropdownError: { borderColor: 'rgba(239,68,68,0.3)' },
  dropdownText: { color: '#fff', fontSize: wp(3.8), fontWeight: '500' },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(3),
    padding: wp(4),
    backgroundColor: '#121212',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#FFBF00', borderColor: '#FFBF00' },
  checkboxTextContainer: { flex: 1, marginLeft: wp(3) },
  checkboxLabel: { color: '#fff', fontSize: wp(3.8), fontWeight: '600' },
  checkboxSubtext: { color: '#555', fontSize: wp(2.8), marginTop: 2 },

  saveBtn: {
    backgroundColor: '#FFBF00',
    borderRadius: 18,
    paddingVertical: hp(2.2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    marginTop: hp(3),
    shadowColor: '#FFBF00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnDisabled: { backgroundColor: '#333', shadowOpacity: 0 },
  saveText: { color: '#000', fontSize: wp(4.5), fontWeight: 'bold' },

  footerInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: wp(2),
    marginTop: hp(3),
    padding: wp(3),
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
  },
  footerText: { color: '#444', fontSize: wp(2.8), flex: 1, lineHeight: wp(4) },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalKeyboardView: { justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: hp(5),
    maxHeight: hp(65),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: hp(1.5),
    marginBottom: hp(1),
  },
  modalTitle: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: 'bold',
    textAlign: 'center',
    padding: wp(4),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: hp(2),
    paddingHorizontal: wp(5),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  modalItemSelected: { backgroundColor: 'rgba(255,191,0,0.1)' },
  modalItemText: { color: '#888', fontSize: wp(4), fontWeight: '500' },
  modalItemTextSelected: { color: '#FFBF00', fontWeight: '700' },
});

export default AddVehicle;
