import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { vehicleService, type Vehicle } from '../../services/vehicleService';

let Geolocation: any = null;
try {
  const geoModule = require('@react-native-community/geolocation') as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation, useRoute } from '../../lib/react-navigation-native';
import { supportApi } from '../../api/support';

const CATEGORIES = [
  { label: 'Vehicle', value: 'VEHICLE', icon: 'car' },
  { label: 'Documents', value: 'DOCUMENTS', icon: 'file-invoice' },
  { label: 'Valet', value: 'VALET', icon: 'concierge-bell' },
  { label: 'AI Assistant', value: 'AI_ASSISTANT', icon: 'robot' },
  { label: 'Billing', value: 'BILLING', icon: 'credit-card' },
  { label: 'Account', value: 'ACCOUNT', icon: 'user-cog' },
  { label: 'Technical', value: 'TECHNICAL', icon: 'microchip' },
  { label: 'Other', value: 'OTHER', icon: 'ellipsis-h' },
];

const PRIORITIES = [
  { label: 'Low', value: 'LOW', color: '#4CAF50', desc: 'General question' },
  { label: 'Medium', value: 'MEDIUM', color: '#FF9800', desc: 'Issue needs fix' },
  { label: 'High', value: 'HIGH', color: '#F44336', desc: 'Affecting workflow' },
  { label: 'Urgent', value: 'URGENT', color: '#D32F2F', desc: 'Critical blocker' },
];

export default function ContactSupport() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(route.params?.category || 'VEHICLE');
  const [priority, setPriority] = useState('LOW');
  const [loading, setLoading] = useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [fetchingVehicles, setFetchingVehicles] = useState(false);

  React.useEffect(() => {
    const loadVehicles = async () => {
      setFetchingVehicles(true);
      try {
        const list = await vehicleService.getVehicles();
        setVehicles(list);
        const primary = list.find(v => v.isPrimary) || list[0];
        if (primary) setSelectedVehicleId(primary.id);
      } catch (err) {
        console.log('Failed to load vehicles in Support:', err);
      } finally {
        setFetchingVehicles(false);
      }
    };
    loadVehicles();
  }, []);

  const getCurrentLocation = (): Promise<{ lat: number; lon: number } | null> => {
    return new Promise((resolve) => {
      if (!Geolocation) return resolve(null);
      Geolocation.getCurrentPosition(
        (pos: any) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 5000 }
      );
    });
  };

  const handleSubmit = async () => {
    if (!subject || !description) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const location = await getCurrentLocation();
      const resp = await supportApi.createTicket({ 
        subject, 
        description, 
        category,
        priority,
        vehicleId: selectedVehicleId || undefined,
        metadata: {
          location,
          platform: Platform.OS,
          vehicleId: selectedVehicleId,
        }
      } as any);
      if (resp.success) {
        Alert.alert('Success', 'Ticket raised successfully!', [
          { text: 'View Tickets', onPress: () => navigation.replace('TicketHistory') },
          { text: 'OK', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (err: any) {
      const errorObj = err.response?.data?.error;
      const msg = typeof errorObj === 'string' 
        ? errorObj 
        : (errorObj?.message || 'Failed to submit ticket. Please try again.');
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={wp(4.5)} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Contact Support</Text>
          <Text style={styles.headerSubtitle}>Tell us what's going on</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: hp(4) }}>
        <View style={styles.form}>
          <Text style={styles.label}>Category <Text style={{color: '#F44336'}}>*</Text></Text>
          <View style={styles.categoriesGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.value}
                style={[styles.catBtn, category === cat.value && styles.catBtnActive]}
                onPress={() => setCategory(cat.value)}
              >
                <Icon name={cat.icon} size={wp(3.5)} color={category === cat.value ? '#4CAF50' : '#666'} />
                <Text style={[styles.catText, category === cat.value && styles.catTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {fetchingVehicles ? (
            <ActivityIndicator color="#4CAF50" style={{ marginBottom: hp(2) }} />
          ) : (
            vehicles.length > 0 && (
              <>
                <Text style={styles.label}>Select Vehicle</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vehicleScroll} contentContainerStyle={{ paddingRight: wp(5) }}>
                  {vehicles.map((v) => (
                    <TouchableOpacity
                      key={v.id}
                      style={[
                        styles.vehicleCard,
                        selectedVehicleId === v.id && styles.vehicleCardActive
                      ]}
                      onPress={() => setSelectedVehicleId(v.id)}
                    >
                      <View style={[styles.vehicleIcon, selectedVehicleId === v.id && { backgroundColor: '#4CAF50' }]}>
                        <Icon name="car" size={wp(3)} color={selectedVehicleId === v.id ? '#000' : '#888'} />
                      </View>
                      <Text style={[styles.vehicleLabel, selectedVehicleId === v.id && styles.vehicleLabelActive]}>
                        {v.registrationNumber}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.vehicleCard,
                      selectedVehicleId === null && styles.vehicleCardActive
                    ]}
                    onPress={() => setSelectedVehicleId(null)}
                  >
                    <View style={[styles.vehicleIcon, selectedVehicleId === null && { backgroundColor: '#4CAF50' }]}>
                      <Icon name="times" size={wp(3)} color={selectedVehicleId === null ? '#000' : '#888'} />
                    </View>
                    <Text style={[styles.vehicleLabel, selectedVehicleId === null && styles.vehicleLabelActive]}>
                      None
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )
          )}

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Subject <Text style={{color: '#F44336'}}>*</Text></Text>
            <Text style={styles.counter}>{subject.length}/150</Text>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Brief summary of your issue"
            placeholderTextColor="#555"
            value={subject}
            onChangeText={(text) => text.length <= 150 && setSubject(text)}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Description <Text style={{color: '#F44336'}}>*</Text></Text>
            <Text style={styles.counter}>{description.length}/5000</Text>
          </View>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Describe your issue in detail..."
            placeholderTextColor="#555"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            value={description}
            onChangeText={(text) => text.length <= 5000 && setDescription(text)}
          />
          <Text style={styles.hint}>Describe your issue in detail</Text>

          <Text style={styles.label}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => (
              <TouchableOpacity
                key={p.value}
                style={[
                  styles.priorityBtn, 
                  priority === p.value && { borderColor: p.color, backgroundColor: p.color + '15' }
                ]}
                onPress={() => setPriority(p.value)}
              >
                <View style={[styles.priorityDot, { backgroundColor: p.color }]} />
                <Text style={[styles.priorityText, { color: p.color }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.priorityDesc}>
            Selected: <Text style={{ color: PRIORITIES.find(p => p.value === priority)?.color }}>{priority}</Text> — {PRIORITIES.find(p => p.value === priority)?.desc}
          </Text>

          <View style={styles.infoBox}>
            <Icon name="info-circle" size={wp(4)} color="#888" />
            <Text style={styles.infoBoxText}>
              Mon–Sun, 9AM–9PM IST. Reply sent to your registered email within 24 hrs.
            </Text>
          </View>

          <TouchableOpacity 
            style={styles.submitBtn} 
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <View style={styles.submitBtnContent}>
                <Icon name="paper-plane" size={wp(4)} color="#000" style={{ marginRight: wp(2) }} />
                <Text style={styles.submitText}>Submit Ticket</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(5),
    paddingTop: hp(1.5),
    paddingBottom: hp(2.5),
  },
  backBtn: {
    width: wp(10),
    height: wp(10),
    borderRadius: wp(5),
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    marginLeft: wp(4),
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: wp(5.5),
    fontWeight: '800',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: wp(3),
    color: '#888',
    marginTop: hp(0.2),
  },
  content: { flex: 1, paddingHorizontal: wp(5) },
  form: { marginTop: hp(1) },
  label: { fontSize: wp(4), fontWeight: '700', color: '#fff', marginBottom: hp(1.5) },
  categoriesGrid: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: hp(2.5), marginHorizontal: -wp(1) },
  catBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: wp(3),
    paddingVertical: hp(1.2),
    borderRadius: wp(2.5),
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#121212',
    margin: wp(1),
    width: wp(30), // 3 columns approx
  },
  catBtnActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.08)' },
  catText: { fontSize: wp(3.3), color: '#888', marginLeft: wp(2) },
  catTextActive: { color: '#4CAF50', fontWeight: '600' },
  
  vehicleScroll: { marginBottom: hp(2.5), marginHorizontal: -wp(1) },
  vehicleCard: {
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.2),
    borderRadius: wp(5),
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#121212',
    marginHorizontal: wp(1),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  vehicleCardActive: { borderColor: '#4CAF50', backgroundColor: 'rgba(76, 175, 80, 0.1)' },
  vehicleIcon: { width: wp(6), height: wp(6), borderRadius: wp(3), backgroundColor: '#1a1a1a', alignItems: 'center', justifyContent: 'center' },
  vehicleLabel: { fontSize: wp(3.2), color: '#888', fontWeight: '500' },
  vehicleLabelActive: { color: '#4CAF50', fontWeight: '700' },
  
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  counter: { fontSize: wp(3), color: '#444' },
  input: {
    backgroundColor: '#121212',
    borderRadius: wp(3),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.8),
    color: '#fff',
    fontSize: wp(4),
    marginBottom: hp(1),
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  textArea: { height: hp(18) },
  hint: { fontSize: wp(3), color: '#444', marginBottom: hp(3) },

  priorityRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: hp(1.5) },
  priorityBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: hp(1.2),
    borderRadius: wp(3),
    borderWidth: 1,
    borderColor: '#1a1a1a',
    marginHorizontal: wp(1),
    backgroundColor: '#121212',
  },
  priorityDot: { width: wp(2), height: wp(2), borderRadius: wp(1), marginRight: wp(1.5) },
  priorityText: { fontSize: wp(3.2), fontWeight: '700' },
  priorityDesc: { fontSize: wp(3.2), color: '#555', marginBottom: hp(4), paddingLeft: wp(1) },

  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#121212',
    padding: wp(4),
    borderRadius: wp(4),
    borderWidth: 1,
    borderColor: '#1a1a1a',
    marginBottom: hp(4),
    alignItems: 'center',
  },
  infoBoxText: { flex: 1, fontSize: wp(3.2), color: '#666', marginLeft: wp(3), lineHeight: wp(4.5) },

  submitBtn: {
    backgroundColor: '#4CAF50',
    borderRadius: wp(8),
    height: hp(7.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnContent: { flexDirection: 'row', alignItems: 'center' },
  submitText: { fontSize: wp(4.5), fontWeight: '800', color: '#000' },
});
