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
import { vehicleService } from '../../services/vehicleService';

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
    isPrimary: true,
    variant: '',
    registrationDate: '',
    engineNumber: '',
  });

  const [errors, setErrors] = useState<{
    plate?: string;
    model?: string;
    brand?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const DatePickerModal = ({ visible, onClose, onSelect, currentDate }: any) => {
    const defaultDate = currentDate ? new Date(currentDate) : new Date();
    const initDate = isNaN(defaultDate.getTime()) ? new Date() : defaultDate;

    const [viewDate, setViewDate] = useState(initDate);
    const [mode, setMode] = useState<'date' | 'month' | 'year'>('date');

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();

    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const fullMonthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    const pad = (n: number) => n < 10 ? '0' + n : n;

    const renderContent = () => {
      if (mode === 'month') {
        return (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', paddingBottom: hp(2) }}>
            {monthNames.map((m, i) => (
              <TouchableOpacity
                key={i}
                style={{ width: '30%', height: hp(6), alignItems: 'center', justifyContent: 'center', backgroundColor: month === i ? '#FFBF00' : '#121212', borderRadius: 12, marginBottom: hp(1.5), borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
                onPress={() => {
                  setViewDate(new Date(year, i, 1));
                  setMode('date');
                }}
              >
                <Text style={{ color: month === i ? '#000' : '#fff', fontWeight: 'bold' }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      }

      if (mode === 'year') {
        const currentYear = new Date().getFullYear();
        const startYear = currentYear - 30;
        const years = Array.from({ length: 32 }, (_, i) => startYear + i).reverse();

        return (
          <View style={{ height: hp(35) }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hp(2) }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {years.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={{ width: '30%', height: hp(6), alignItems: 'center', justifyContent: 'center', backgroundColor: year === y ? '#FFBF00' : '#121212', borderRadius: 12, marginBottom: hp(1.5), borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' }}
                    onPress={() => {
                      setViewDate(new Date(y, month, 1));
                      setMode('date');
                    }}
                  >
                    <Text style={{ color: year === y ? '#000' : '#fff', fontWeight: 'bold' }}>{y}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        );
      }

      return (
        <View style={{ paddingBottom: hp(2) }}>
          <View style={{ flexDirection: 'row', marginBottom: hp(1) }}>
            {weekDays.map(wd => <Text key={wd} style={{ color: '#888', width: '14.28%', textAlign: 'center', fontWeight: 'bold' }}>{wd}</Text>)}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {days.map((d, i) => {
              const dateStr = d ? `${year}-${pad(month + 1)}-${pad(d)}` : '';
              const isSelected = currentDate === dateStr;
              return (
                <View key={i} style={{ width: '14.28%', height: wp(10), alignItems: 'center', justifyContent: 'center', marginBottom: hp(1) }}>
                  {d ? (
                    <TouchableOpacity
                      style={{ width: wp(9), height: wp(9), borderRadius: wp(4.5), backgroundColor: isSelected ? '#FFBF00' : 'transparent', alignItems: 'center', justifyContent: 'center' }}
                      onPress={() => {
                        onSelect(dateStr);
                        onClose();
                        setMode('date');
                      }}
                    >
                      <Text style={{ color: isSelected ? '#000' : '#fff', fontWeight: 'bold' }}>{d}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              )
            })}
          </View>
        </View>
      );
    };

    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <Pressable style={styles.modalOverlay} onPress={() => { setMode('date'); onClose(); }}>
          <Pressable style={[styles.modalContent, { paddingHorizontal: wp(5) }]}>
            <View style={styles.modalHandle} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: hp(2) }}>
              <TouchableOpacity
                onPress={() => {
                  if (mode === 'date') setViewDate(new Date(year, month - 1, 1));
                  else if (mode === 'month') setViewDate(new Date(year - 1, month, 1));
                }}
                style={{ padding: 10, opacity: mode === 'year' ? 0 : 1 }}
                disabled={mode === 'year'}
              >
                <FontAwesome5 name="chevron-left" size={wp(4)} color="#fff" />
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: wp(2) }}>
                <TouchableOpacity onPress={() => setMode(mode === 'month' ? 'date' : 'month')}>
                  <Text style={{ color: mode === 'month' ? '#FFBF00' : '#fff', fontSize: wp(4.5), fontWeight: 'bold' }}>{fullMonthNames[month]}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode(mode === 'year' ? 'date' : 'year')}>
                  <Text style={{ color: mode === 'year' ? '#FFBF00' : '#fff', fontSize: wp(4.5), fontWeight: 'bold' }}>{year}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  if (mode === 'date') setViewDate(new Date(year, month + 1, 1));
                  else if (mode === 'month') setViewDate(new Date(year + 1, month, 1));
                }}
                style={{ padding: 10, opacity: mode === 'year' ? 0 : 1 }}
                disabled={mode === 'year'}
              >
                <FontAwesome5 name="chevron-right" size={wp(4)} color="#fff" />
              </TouchableOpacity>
            </View>

            {renderContent()}
          </Pressable>
        </Pressable>
      </Modal>
    );
  };

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

  const mapType = (type: string) => {
    switch (type) {
      case 'Car': return 'SEDAN';
      case 'Bike': return 'BIKE';
      case 'SUV': return 'SUV';
      case 'Truck': return 'TRUCK';
      case 'Van': return 'LUV';
      default: return 'OTHER';
    }
  };

  const mapFuel = (fuel: string) => {
    switch (fuel) {
      case 'Petrol': return 'PETROL';
      case 'Diesel': return 'DIESEL';
      case 'Electric': return 'EV';
      case 'CNG': return 'CNG';
      case 'Hybrid': return 'HYBRID';
      default: return 'OTHER';
    }
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      let parsedDate: string | undefined;
      if (form.registrationDate) {
        const d = new Date(form.registrationDate);
        if (!isNaN(d.getTime())) {
          parsedDate = d.toISOString();
        }
      }

      const payload: any = {
        registrationNumber: form.plate.toUpperCase(),
        make: form.brand,
        model: form.model,
        year: form.year ? parseInt(form.year, 10) : undefined,
        vehicleType: mapType(form.type),
        fuelType: mapFuel(form.fuel),
        variant: form.variant || undefined,
        registrationDate: parsedDate,
        engineNumber: form.engineNumber || undefined,
      };

      const res = await vehicleService.addVehicle(payload);

      if (form.isPrimary) {
        await vehicleService.setPrimaryVehicle(res.id).catch(console.error);
      }

      const newVehicle = {
        id: res.id,
        plate: res.registrationNumber,
        brand: res.make || form.brand,
        model: res.model || form.model,
        year: res.year?.toString() || form.year,
        type: form.type,
        fuel: form.fuel,
        variant: res.variant || form.variant,
        registrationDate: res.registrationDate || form.registrationDate,
        engineNumber: res.engineNumber || form.engineNumber,
        isPrimary: form.isPrimary,
        healthScore: 100,
        addedAt: new Date().toISOString(),
      };

      Alert.alert('Success!', 'Vehicle added successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('VehicleList', { newVehicle }),
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to save vehicle. Please try again.');
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
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.85}>
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
            <Text style={styles.sectionTitle}>Vehicle Number</Text>

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
            <Text style={styles.sectionTitle}>Vehicle Details</Text>

            <View style={styles.card}>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: wp(1.5) }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Vehicle Type</Text>
                    <View style={{ flexDirection: 'row', gap: wp(2) }}>
                      <TouchableOpacity
                        style={[styles.typeBtnSmall, form.type === 'Car' && styles.typeBtnSmallActive]}
                        onPress={() => updateForm('type', 'Car')}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="car" size={wp(3.5)} color={form.type === 'Car' ? '#000' : '#888'} />
                        <Text style={[styles.typeBtnTextSmall, form.type === 'Car' && styles.typeBtnTextSmallActive]}>Car</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.typeBtnSmall, form.type === 'Bike' && styles.typeBtnSmallActive]}
                        onPress={() => updateForm('type', 'Bike')}
                        activeOpacity={0.7}
                      >
                        <FontAwesome5 name="motorcycle" size={wp(3.5)} color={form.type === 'Bike' ? '#000' : '#888'} />
                        <Text style={[styles.typeBtnTextSmall, form.type === 'Bike' && styles.typeBtnTextSmallActive]}>Bike</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
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
            <Text style={styles.sectionTitle}>Additional Details</Text>

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
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Variant (Optional)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. VXI"
                        placeholderTextColor="#3a3a3a"
                        value={form.variant}
                        onChangeText={val => updateForm('variant', val)}
                      />
                    </View>
                  </View>
                </View>
              </View>

              <View style={[styles.row, { marginTop: hp(1.5) }]}>
                <View style={{ flex: 1, marginRight: wp(1.5) }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Reg. Date (Optional)</Text>
                    <TouchableOpacity
                      style={styles.dropdown}
                      onPress={() => setShowDatePicker(true)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownText, !form.registrationDate && { color: '#3a3a3a' }]}>
                        {form.registrationDate || 'YYYY-MM-DD'}
                      </Text>
                      <FontAwesome5 name="calendar-alt" size={wp(3.5)} color="#666" />
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={{ flex: 1, marginLeft: wp(1.5) }}>
                  <View style={styles.fieldContainer}>
                    <Text style={styles.fieldLabel}>Engine No. (Optional)</Text>
                    <View style={styles.inputWrapper}>
                      <TextInput
                        style={styles.input}
                        placeholder="Engine Number"
                        placeholderTextColor="#3a3a3a"
                        value={form.engineNumber}
                        onChangeText={val => updateForm('engineNumber', val)}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
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
        <DatePickerModal
          visible={showDatePicker}
          onClose={() => setShowDatePicker(false)}
          onSelect={(date: string) => updateForm('registrationDate', date)}
          currentDate={form.registrationDate}
        />
      </KeyboardAvoidingView>
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  keyboardView: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(4),
    paddingVertical: hp(2),
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
  headerCenter: { flex: 1, marginLeft: wp(2) },
  headerRight: { width: 44 },
  headerTitle: { fontSize: wp(6), fontWeight: '700', color: '#fff' },
  headerSubtitle: { fontSize: wp(3.5), color: '#888', marginTop: hp(0.2) },

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(6) },
  section: { marginTop: hp(3) },
  sectionTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.8),
    marginTop: hp(1),
  },

  card: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  plateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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
    backgroundColor: '#000000',
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

  typeBtnSmall: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: hp(1.4),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    gap: wp(1.5),
  },
  typeBtnSmallActive: {
    backgroundColor: '#FFBF00',
    borderColor: '#FFBF00',
  },
  typeBtnTextSmall: {
    color: '#888',
    fontSize: wp(3.5),
    fontWeight: '600',
  },
  typeBtnTextSmallActive: {
    color: '#000',
    fontWeight: 'bold',
  },

  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: hp(3),
    padding: wp(4),
    backgroundColor: '#121212',
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
