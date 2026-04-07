import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Easing,
  StatusBar,
  Platform,
  PermissionsAndroid,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { launchCamera } from 'react-native-image-picker';
import Share, { VehicleUser } from './Share';
import { vehicleService } from '../../services/vehicleService';
import BackButton from '../../components/BackButton';
import LoaderButton from '../../components/Button';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const ActionBox = ({
  icon,
  label,
  onPress,
  color = '#FFBF00',
}: {
  icon: string;
  label: string;
  onPress?: () => void;
  color?: string;
}) => {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleValue, {
      toValue: 0.92,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
      <TouchableOpacity
        style={styles.actionCard}
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <View
          style={[styles.actionIconBg, { backgroundColor: `${color}15` }]}
        >
          <FontAwesome5 name={icon} size={wp(5)} color={color} />
        </View>
        <Text style={styles.actionLabel}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const VehicleDetails = ({ navigation, route }: any) => {
  const initialVehicle = route.params?.vehicle || {
    plate: 'DL 01 AB 1234',
    brand: 'Maruti Suzuki',
    model: 'Swift',
    year: '2022',
    healthScore: 85,
    photo:
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
  };

  const [vehicle, setVehicle] = useState(initialVehicle);

  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharingLoading, setIsSharingLoading] = useState(false);
  const [accessList, setAccessList] = useState<VehicleUser[]>([
    { id: 1, name: 'You', role: 'Owner', phone: '+91 98765XXXXX' },
    {
      id: 2,
      name: 'Priya',
      role: 'Viewer',
      phone: '+91 87654XXXXX',
      status: 'active',
    },
  ]);

  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isOdoModalVisible, setIsOdoModalVisible] = useState(false);
  const [isSavingOdometer, setIsSavingOdometer] = useState(false);
  const [odoInput, setOdoInput] = useState('');
  const [expandWhyScore, setExpandWhyScore] = useState(false);
  const [expandNextActions, setExpandNextActions] = useState(false);
  const [expandMoreDetails, setExpandMoreDetails] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  const healthDetail = vehicle.healthScoreDetail as {
    scoreChangeReason?: string;
    components?: { name: string; score: number | null; label: string }[];
    recommendations?: string[];
    explanations?: string[];
  } | null;

  const parseHealth = (val: any) => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseInt(val.replace('%', ''), 10) || 85;
    return 85;
  };

  const healthScore = vehicle.healthScore ? parseHealth(vehicle.healthScore) : parseHealth(vehicle.health);
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

  const fetchVehicleDetails = useCallback(async () => {
    if (!vehicle.id) return;
    try {
      const data = await vehicleService.getVehicleById(vehicle.id);
      setVehicle((prev: any) => ({
        ...prev,
        ...data,
        healthScore: data.healthScore?.overallScore ?? prev.healthScore ?? 0,
        healthScoreDetail: data.healthScore ?? null,
        odometer: data.currentOdometer ? `${data.currentOdometer.toLocaleString()} km` : prev.odometer,
        photo: data.imageUrl || data.photo || prev.photo || prev.img,
        chassisNumber: data.chassisNumber,
        engineNumber: data.engineNumber,
        rcVerified: data.rcVerified,
        registrationDate: data.registrationDate,
        variant: data.variant,
      }));
    } catch (e) {
      console.error(e);
    }
  }, [vehicle.id]);

  useEffect(() => {
    fetchVehicleDetails();
  }, [fetchVehicleDetails]);

  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: '#22c55e' };
    if (score >= 60) return { label: 'Good', color: '#f59e0b' };
    return { label: 'Poor', color: '#ef4444' };
  };

  const healthStatus = getHealthStatus(healthScore);

  const startHealthAnimation = useCallback(() => {
    Animated.timing(animatedValue, {
      toValue: healthScore,
      duration: 1500,
      easing: Easing.out(Easing.cubic),
      // Animated SVG props (strokeDashoffset) must run on JS driver.
      useNativeDriver: false,
    }).start();
  }, [animatedValue, healthScore]);

  useEffect(() => {
    startHealthAnimation();
  }, [startHealthAnimation]);

  const handleRecalculate = async () => {
    if (!vehicle.id) return;
    setIsRecalculating(true);
    spinValue.setValue(0);
    animatedValue.setValue(0);

    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    try {
      await vehicleService.recalculateHealth(vehicle.id);
      await fetchVehicleDetails();
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to recalculate view mapping');
    } finally {
      setIsRecalculating(false);
      startHealthAnimation();
    }
  };

  const spinRotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleManualOdometerSubmit = async () => {
    if (!vehicle.id || !odoInput || isSavingOdometer) return;
    setIsSavingOdometer(true);
    try {
      await vehicleService.addOdometer(vehicle.id, { reading: parseInt(odoInput, 10) });
      await fetchVehicleDetails();
      setOdoInput('');
      setIsOdoModalVisible(false);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update odometer manually');
    } finally {
      setIsSavingOdometer(false);
    }
  };

  const handleCameraOdometer = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Camera access is required to scan odometer reading.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
            buttonNeutral: 'Ask Me Later',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permission denied', 'Camera permission is required to continue.');
          return;
        }
      }

      const result: any = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
      });
      if (result?.didCancel) return;
      if (result?.errorCode) {
        Alert.alert('Camera error', result?.errorMessage || 'Could not open camera.');
        return;
      }
      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const fd = new FormData();
        fd.append('photo', {
          uri: Platform.OS === 'android' ? asset.uri : asset.uri?.replace('file://', ''),
          type: asset.type || 'image/jpeg',
          name: asset.fileName || `odometer-${Date.now()}.jpg`,
        } as any);

        setIsRecalculating(true);
        try {
          const extracted = await vehicleService.extractOdometerViaAI(vehicle.id, fd);
          setOdoInput(String(extracted.reading ?? ''));
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'Failed OCR check. Please try manual entry.');
        } finally {
          setIsRecalculating(false);
        }
      }
    } catch (error) {
      console.log('Camera error:', error);
    }
  };

  const handleInvite = async (phone: string, role: 'Editor' | 'Viewer' | 'Driver') => {
    if (isSharingLoading) return;
    setIsSharingLoading(true);
    try {
      const newUser: VehicleUser = {
        id: Date.now(),
        name: 'New User',
        role: role,
        phone: `+91 ${phone}`,
        status: 'pending',
      };
      setAccessList(prev => [...prev, newUser]);
      Alert.alert('Success', 'Invitation sent successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to send invitation');
    } finally {
      setIsSharingLoading(false);
    }
  };

  const handleRevoke = async (userId: number) => {
    if (isSharingLoading) return;
    setIsSharingLoading(true);
    try {
      setAccessList(prev => prev.filter(user => user.id !== userId));
      Alert.alert('Success', 'Access revoked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to revoke access');
    } finally {
      setIsSharingLoading(false);
    }
  };

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });



  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Trigger hot reload */}
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Vehicle Details</Text>
          <Text style={styles.headerSubtitle}>
            {vehicle.brand} {vehicle.model}
          </Text>
        </View>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.heroCard}>
          <View style={styles.carImgContainer}>
            <Image
              source={{
                uri:
                  vehicle.photo ||
                  vehicle.img ||
                  'https://via.placeholder.com/150',
              }}
              style={styles.carImg}
            />
          </View>
          <View style={styles.heroText}>
            <Text style={styles.plateText}>
              {vehicle.vehicleNumber || vehicle.plate}
            </Text>
            <Text style={styles.modelText}>
              {vehicle.brand || vehicle.make} {vehicle.model}
            </Text>
            <Text style={styles.yearText}>{vehicle.year}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Health Score</Text>

          <View style={styles.healthCard}>
            <View style={styles.gaugeContainer}>
              <Svg width={wp(42)} height={wp(42)} viewBox="0 0 160 160">
                <Defs>
                  <LinearGradient
                    id="healthGrad"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <Stop offset="0%" stopColor={healthStatus.color} />
                    <Stop offset="100%" stopColor={healthStatus.color} />
                  </LinearGradient>
                </Defs>
                <Circle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="10"
                  fill="transparent"
                />
                <AnimatedCircle
                  cx="80"
                  cy="80"
                  r={radius}
                  stroke="url(#healthGrad)"
                  strokeWidth="10"
                  fill="transparent"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                  rotation="-90"
                  origin="80, 80"
                />
              </Svg>
              <View style={styles.gaugeCenterText}>
                <Text style={styles.scoreText}>{healthScore}</Text>
                <Text style={styles.scoreMax}>/100</Text>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${healthStatus.color}20` },
                  ]}
                >
                  <Text
                    style={[styles.statusText, { color: healthStatus.color }]}
                  >
                    {healthStatus.label}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.healthBasedOnCard}>
              <Text style={styles.healthBasedOnTitle}>What this score is based on</Text>
              {healthDetail?.components?.some((c: { name: string; score: number | null }) => c.name === 'driving' && c.score != null) ? (
                <>
                  <Text style={styles.healthBasedOnItem}>• Compliance (20%) — Insurance & PUC documents</Text>
                  <Text style={styles.healthBasedOnItem}>• Maintenance (50%) — Parts, mileage & vehicle age</Text>
                  <Text style={styles.healthBasedOnItem}>• Driving (30%) — Last 20 trips safety score</Text>
                </>
              ) : (
                <>
                  <Text style={styles.healthBasedOnItem}>• Compliance (20%) — Insurance & PUC documents</Text>
                  <Text style={styles.healthBasedOnItem}>• Maintenance (80%) — Parts, mileage & vehicle age</Text>
                  <Text style={styles.healthBasedOnItem}>• Driving — Not used yet (no trips; add trips to include)</Text>
                </>
              )}
            </View>

            {healthDetail?.components && healthDetail.components.length > 0 && (
              <View style={styles.statsRow}>
                {healthDetail.components.map((c) => (
                  <View key={c.name} style={styles.statBox}>
                    <FontAwesome5
                      name={
                        c.name === 'maintenance' ? 'wrench' :
                        c.name === 'driving' ? 'car' :
                        c.name === 'age' ? 'calendar-alt' : 'tachometer-alt'
                      }
                      size={wp(4)}
                      color="#666"
                    />
                    <Text style={styles.statSmallLabel}>{c.label}</Text>
                    <Text style={styles.statValue}>
                      {c.score != null ? c.score : '—'}
                      <Text style={styles.unitText}>%</Text>
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {healthDetail?.scoreChangeReason && (
              <TouchableOpacity
                style={styles.whyScoreRow}
                onPress={() => setExpandWhyScore((v) => !v)}
                activeOpacity={0.7}
              >
                <FontAwesome5 name="info-circle" size={wp(4)} color="#FFBF00" />
                <Text style={styles.whyScoreLabel}>
                  Score changed because…
                </Text>
                <FontAwesome5
                  name={expandWhyScore ? 'chevron-up' : 'chevron-down'}
                  size={wp(3.5)}
                  color="#888"
                />
              </TouchableOpacity>
            )}
            {expandWhyScore && healthDetail?.scoreChangeReason && (
              <View style={styles.whyScoreBody}>
                <Text style={styles.whyScoreText}>{healthDetail.scoreChangeReason}</Text>
                {healthDetail.explanations && healthDetail.explanations.length > 1 && (
                  <View style={styles.explanationsList}>
                    {healthDetail.explanations.slice(1, 4).map((e: string, i: number) => (
                      <Text key={i} style={styles.explanationItem}>• {e}</Text>
                    ))}
                  </View>
                )}
              </View>
            )}

            {healthDetail?.recommendations && healthDetail.recommendations.length > 0 && (
              <>
                <TouchableOpacity
                  style={styles.whyScoreRow}
                  onPress={() => setExpandNextActions((v) => !v)}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 name="tasks" size={wp(4)} color="#FFBF00" />
                  <Text style={styles.whyScoreLabel}>What to do next</Text>
                  <FontAwesome5
                    name={expandNextActions ? 'chevron-up' : 'chevron-down'}
                    size={wp(3.5)}
                    color="#888"
                  />
                </TouchableOpacity>
                {expandNextActions && (
                  <View style={styles.nextActionsBody}>
                    {healthDetail.recommendations.map((r: string, i: number) => (
                      <TouchableOpacity
                        key={i}
                        style={styles.nextActionItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (r.toLowerCase().includes('insurance') || r.toLowerCase().includes('document')) navigation.navigate('DocumentList' as any);
                          else if (r.toLowerCase().includes('service') || r.toLowerCase().includes('puc')) navigation.navigate('ServiceHistory' as any);
                        }}
                      >
                        <FontAwesome5 name="chevron-right" size={wp(3)} color="#FFBF00" />
                        <Text style={styles.nextActionText}>{r}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={[
                styles.recalcBtn,
                isRecalculating && styles.recalcBtnDisabled,
              ]}
              onPress={handleRecalculate}
              disabled={isRecalculating}
              activeOpacity={0.7}
            >
              <Animated.View
                style={{
                  transform: [{ rotate: spinRotation }],
                  marginRight: wp(2),
                }}
              >
                <FontAwesome5 name="sync-alt" size={wp(4)} color="#FFBF00" />
              </Animated.View>
              <Text style={styles.recalcText}>
                {isRecalculating ? 'Calculating...' : 'Recalculate Health'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Info</Text>

          <View style={styles.infoCard}>
            {[
              { icon: 'car', l: 'Make', v: vehicle.brand || vehicle.make },
              { icon: 'model', l: 'Model', v: vehicle.model },
              { icon: 'tags', l: 'Variant', v: vehicle.variant || 'N/A' },
              { icon: 'calendar', l: 'Year', v: vehicle.year },
              { icon: 'gas-pump', l: 'Fuel', v: vehicle.fuel || 'Petrol' },
              { icon: 'calendar-check', l: 'Reg. Date', v: vehicle.registrationDate ? new Date(vehicle.registrationDate).toLocaleDateString() : 'N/A' },
              { icon: 'barcode', l: 'Chassis No.', v: vehicle.chassisNumber || 'N/A' },
              { icon: 'cogs', l: 'Engine No.', v: vehicle.engineNumber || 'N/A' },
              { icon: 'check-circle', l: 'RC Verified', v: vehicle.rcVerified ? 'Yes' : 'No' },
              {
                icon: 'tachometer-alt',
                l: 'Odometer',
                v: vehicle.odometer || '23,450 km',
              },
            ].map((item, i) => (
              <View key={i} style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <FontAwesome5
                    name={item.icon as any}
                    size={wp(4)}
                    color="#444"
                  />
                  <Text style={styles.infoLabel}>{item.l}</Text>
                </View>
                <Text style={styles.infoValue}>{item.v}</Text>
              </View>
            ))}

            {/* Extended Info (More Section) */}
            {[
              { key: 'ownerName', label: 'Owner Name', icon: 'user' },
              { key: 'rto', label: 'RTO Office', icon: 'building' },
              { key: 'vehicleClass', label: 'Vehicle Class', icon: 'car-side' },
              { key: 'fuelNorms', label: 'Fuel Norms', icon: 'leaf' },
              { key: 'rcStatus', label: 'RC Status', icon: 'info-circle' },
              { key: 'unloadedWeight', label: 'Unloaded Weight', icon: 'weight-hanging' },
              { key: 'fitnessUpto', label: 'Fitness Upto', icon: 'clipboard-check' },
              { key: 'insuranceUpto', label: 'Insurance Upto', icon: 'shield-alt' },
              { key: 'pollutionUpto', label: 'Pollution Upto', icon: 'smog' },
              { key: 'mileage', label: 'Mileage', icon: 'gas-pump' },
              { key: 'transmission', label: 'Transmission', icon: 'shift' },
              { key: 'color', label: 'Color', icon: 'palette' },
              { key: 'manufacturingMonthYear', label: 'Manufacturing Date', icon: 'calendar-day' },
              { key: 'vehicleType', label: 'Type', icon: 'car' },
              { key: 'presentAddress', label: 'Present Address', icon: 'map-marker-alt' },
            ].some(f => vehicle[f.key]) && (
              <>
                <TouchableOpacity
                  style={[styles.whyScoreRow, { marginTop: hp(1) }]}
                  onPress={() => setExpandMoreDetails(v => !v)}
                  activeOpacity={0.7}
                >
                  <FontAwesome5 name="list-ul" size={wp(4)} color="#FFBF00" />
                  <Text style={styles.whyScoreLabel}>More Details</Text>
                  <FontAwesome5
                    name={expandMoreDetails ? 'chevron-up' : 'chevron-down'}
                    size={wp(3.5)}
                    color="#888"
                  />
                </TouchableOpacity>

                {expandMoreDetails && (
                  <View style={{ marginTop: hp(1) }}>
                    {[
                      { key: 'ownerName', label: 'Owner Name', icon: 'user' },
                      { key: 'rto', label: 'RTO Office', icon: 'building' },
                      { key: 'vehicleClass', label: 'Vehicle Class', icon: 'car-side' },
                      { key: 'fuelNorms', label: 'Fuel Norms', icon: 'leaf' },
                      { key: 'rcStatus', label: 'RC Status', icon: 'info-circle' },
                      { key: 'unloadedWeight', label: 'Unloaded Weight', icon: 'weight-hanging' },
                      { key: 'fitnessUpto', label: 'Fitness Upto', icon: 'clipboard-check' },
                      { key: 'insuranceUpto', label: 'Insurance Upto', icon: 'shield-alt' },
                      { key: 'pollutionUpto', label: 'Pollution Upto', icon: 'smog' },
                      { key: 'mileage', label: 'Mileage', icon: 'gas-pump' },
                      { key: 'transmission', label: 'Transmission', icon: 'shift' },
                      { key: 'color', label: 'Color', icon: 'palette' },
                      { key: 'manufacturingMonthYear', label: 'Manufacturing Date', icon: 'calendar-day' },
                      { key: 'vehicleType', label: 'Type', icon: 'car' },
                      { key: 'presentAddress', label: 'Present Address', icon: 'map-marker-alt' },
                    ].map((f, i) => vehicle[f.key] ? (
                      <View key={i} style={styles.infoRow}>
                        <View style={styles.infoLeft}>
                          <FontAwesome5
                            name={f.icon as any}
                            size={wp(3.5)}
                            color="#444"
                          />
                          <Text style={styles.infoLabel}>{f.label}</Text>
                        </View>
                        <Text style={styles.infoValue}>{vehicle[f.key]}</Text>
                      </View>
                    ) : null)}
                  </View>
                )}
              </>
            )}

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={() => setIsOdoModalVisible(true)}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="camera" size={wp(4)} color="#FFBF00" />
              <Text style={styles.updateBtnText}>Update Odometer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>

          <View style={styles.actionsCard}>
            <View style={styles.actionsGrid}>
              <ActionBox icon="file-alt" label="Docs" color="#3b82f6" />
              <ActionBox icon="wrench" label="Service" color="#8b5cf6" />
              <ActionBox
                icon="receipt"
                label="Challans"
                color="#ef4444"
                onPress={() => navigation.navigate('Challans', { vehicle })}
              />
              <ActionBox
                icon="share-alt"
                label="Share"
                color="#FFBF00"
                onPress={() => setShowShareModal(true)}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <Share
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        vehicle={{
          vehicleNumber: vehicle.vehicleNumber || vehicle.plate,
          model: vehicle.model,
          brand: vehicle.brand,
        }}
        accessList={accessList}
        onInvite={handleInvite}
        onRevoke={handleRevoke}
        isLoading={isSharingLoading}
      />

      {/* Odometer Modal */}
      <Modal
        visible={isOdoModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSavingOdometer) {
            setIsOdoModalVisible(false);
          }
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!isSavingOdometer) {
              setIsOdoModalVisible(false);
            }
          }}
          disabled={isSavingOdometer}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboardView}
          >
            <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Update Odometer</Text>

              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>Enter Current Reading (km)</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g. 45000"
                  placeholderTextColor="#555"
                  keyboardType="numeric"
                  value={odoInput}
                  onChangeText={setOdoInput}
                  editable={!isSavingOdometer}
                />

                {isSavingOdometer ? (
                  <View style={styles.modalSavingRow}>
                    <ActivityIndicator size="small" color="#FFBF00" />
                    <Text style={styles.modalSavingText}>Updating odometer...</Text>
                  </View>
                ) : null}

                <LoaderButton
                  title="Update Odometer"
                  loading={isSavingOdometer}
                  loadingTitle="Updating..."
                  onPress={handleManualOdometerSubmit}
                  disabled={!odoInput}
                  style={[
                    styles.modalSubmitBtn,
                    !odoInput && styles.modalSubmitBtnDisabled,
                  ]}
                />

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.modalAiBtn,
                    isSavingOdometer && styles.modalAiBtnDisabled,
                  ]}
                  onPress={handleCameraOdometer}
                  disabled={isSavingOdometer}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="camera" size={wp(4)} color="#FFBF00" />
                  <Text style={styles.modalAiText}>Scan via Camera (AI)</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
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
  headerCenter: { flex: 1, marginLeft: wp(3) },
  headerRight: { width: 44 },
  headerTitle: { fontSize: wp(6), fontWeight: '700', color: '#fff' },
  headerSubtitle: { color: '#666', fontSize: wp(3.2), marginTop: 2 },

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(5) },
  section: { marginTop: hp(3) },
  sectionTitle: {
    fontSize: wp(4.8),
    fontWeight: '700',
    color: '#fff',
    marginBottom: hp(1.8),
    marginTop: hp(1),
  },

  heroCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  carImgContainer: {
    width: wp(24),
    height: wp(18),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  carImg: { width: '100%', height: '100%', opacity: 0.8 },
  heroText: { flex: 1, marginLeft: wp(4) },
  plateText: {
    color: '#fff',
    fontSize: wp(5),
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  modelText: { color: '#777', fontSize: wp(3.5), marginTop: 4 },
  yearText: { color: '#555', fontSize: wp(3), marginTop: 2 },

  healthCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(2),
  },
  gaugeCenterText: { position: 'absolute', alignItems: 'center' },
  scoreText: { color: '#fff', fontSize: wp(10), fontWeight: 'bold' },
  scoreMax: { color: '#555', fontSize: wp(3.2) },
  statusBadge: {
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.5),
    borderRadius: 10,
    marginTop: hp(1),
  },
  statusText: {
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(2),
  },
  statBox: {
    backgroundColor: '#000000',
    width: wp(26),
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statSmallLabel: {
    color: '#555',
    fontSize: wp(2.8),
    fontWeight: '600',
    marginTop: hp(1),
  },
  statValue: {
    color: '#fff',
    fontSize: wp(4),
    fontWeight: 'bold',
    marginTop: 4,
  },
  unitText: { color: '#666', fontSize: wp(2.5), fontWeight: 'normal' },

  recalcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(2.5),
    backgroundColor: 'rgba(255,191,0,0.1)',
    paddingVertical: hp(1.8),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  recalcBtnDisabled: { opacity: 0.5 },
  recalcText: { color: '#FFBF00', fontSize: wp(3.5), fontWeight: '600' },

  healthBasedOnCard: {
    backgroundColor: 'rgba(255,191,0,0.06)',
    borderRadius: 12,
    padding: wp(4),
    marginTop: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  healthBasedOnTitle: { fontSize: wp(3.2), fontWeight: '700', color: '#FFBF00', marginBottom: hp(1), textTransform: 'uppercase', letterSpacing: 0.5 },
  healthBasedOnItem: { fontSize: wp(3.2), color: '#aaa', marginTop: 4, lineHeight: 20 },

  whyScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
    marginTop: hp(2),
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(3),
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
  },
  whyScoreLabel: { flex: 1, color: '#ccc', fontSize: wp(3.8), fontWeight: '600' },
  whyScoreBody: {
    marginTop: hp(1),
    paddingHorizontal: wp(4),
    paddingVertical: hp(1.5),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#FFBF00',
  },
  whyScoreText: { color: '#ccc', fontSize: wp(3.6), lineHeight: 22 },
  explanationsList: { marginTop: hp(1.2) },
  explanationItem: { color: '#999', fontSize: wp(3.4), marginTop: 4 },

  nextActionsBody: {
    marginTop: hp(1),
    paddingHorizontal: wp(2),
    paddingVertical: hp(1),
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 10,
  },
  nextActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    paddingVertical: hp(1.2),
    paddingHorizontal: wp(2),
  },
  nextActionText: { flex: 1, color: '#ddd', fontSize: wp(3.6) },

  infoCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: hp(1.8),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: wp(3) },
  infoLabel: { color: '#666', fontSize: wp(3.5), fontWeight: '500' },
  infoValue: { color: '#fff', fontSize: wp(3.5), fontWeight: '600' },

  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    marginTop: hp(2),
    paddingVertical: hp(1.8),
    backgroundColor: 'rgba(255,191,0,0.1)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  updateBtnText: { color: '#FFBF00', fontSize: wp(3.5), fontWeight: '600' },

  actionsCard: {
    backgroundColor: '#121212',
    borderRadius: wp(4),
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#000000',
    width: wp(20),
    paddingVertical: hp(2),
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionIconBg: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: hp(1),
  },
  actionLabel: {
    color: '#888',
    fontSize: wp(2.8),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalKeyboardView: {
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#121212',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: hp(5),
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
  modalBody: {
    padding: wp(5),
  },
  modalLabel: {
    color: '#888',
    fontSize: wp(3.5),
    marginBottom: hp(1),
    fontWeight: '500',
  },
  modalInput: {
    backgroundColor: '#000000',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: wp(4),
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: '600',
  },
  modalSubmitBtn: {
    backgroundColor: '#FFBF00',
    borderRadius: 14,
    paddingVertical: hp(2),
    alignItems: 'center',
    marginTop: hp(2.5),
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#333',
  },
  modalSavingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(1.5),
    gap: wp(2),
  },
  modalSavingText: {
    color: '#FFBF00',
    fontSize: wp(3.6),
    fontWeight: '600',
  },
  modalSubmitText: {
    color: '#000',
    fontSize: wp(4),
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: hp(3),
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  dividerText: {
    color: '#666',
    marginHorizontal: wp(4),
    fontSize: wp(3),
    fontWeight: '600',
  },
  modalAiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: wp(2),
    backgroundColor: 'rgba(255,191,0,0.1)',
    borderRadius: 14,
    paddingVertical: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.2)',
  },
  modalAiBtnDisabled: {
    opacity: 0.5,
  },
  modalAiText: {
    color: '#FFBF00',
    fontSize: wp(4),
    fontWeight: '600',
  },
});

export default VehicleDetails;
