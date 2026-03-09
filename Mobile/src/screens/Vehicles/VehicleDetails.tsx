import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
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
  Alert,
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const VehicleDetails = ({ navigation, route }: any) => {
  const vehicle = route.params?.vehicle || {
    plate: 'DL 01 AB 1234',
    brand: 'Maruti Suzuki',
    model: 'Swift',
    year: '2022',
    healthScore: 85,
    photo:
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
  };

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
  const animatedValue = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  const healthScore = vehicle.healthScore || 85;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

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
      useNativeDriver: true,
    }).start();
  }, [animatedValue, healthScore]);

  useEffect(() => {
    startHealthAnimation();
  }, [startHealthAnimation]);

  const handleRecalculate = () => {
    setIsRecalculating(true);
    spinValue.setValue(0);
    animatedValue.setValue(0);

    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    setTimeout(() => {
      setIsRecalculating(false);
      startHealthAnimation();
    }, 1500);
  };

  const spinRotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const handleUpdateOdometer = async () => {
    Alert.alert(
      'Update Odometer',
      'This feature requires camera permission to capture odometer reading.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Camera',
          onPress: async () => {
            try {
              const result: any = await launchCamera({
                mediaType: 'photo',
                quality: 0.8,
              });
              console.log('Camera result:', result);
            } catch (error) {
              console.log('Camera error:', error);
            }
          },
        },
      ],
    );
  };

  const handleInvite = async (phone: string, role: 'Editor' | 'Viewer') => {
    setIsSharingLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
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
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setAccessList(prev => prev.filter(user => user.id !== userId));
      Alert.alert('Success', 'Access revoked successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to revoke access');
    }
  };

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

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
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionLabel}>Health Score</Text>
            <View style={styles.sectionLine} />
          </View>

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

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <FontAwesome5 name="calendar-alt" size={wp(4)} color="#666" />
                <Text style={styles.statSmallLabel}>Age</Text>
                <Text style={styles.statValue}>
                  90 <Text style={styles.unitText}>days</Text>
                </Text>
              </View>
              <View style={styles.statBox}>
                <FontAwesome5 name="wrench" size={wp(4)} color="#666" />
                <Text style={styles.statSmallLabel}>Service</Text>
                <Text style={styles.statValue}>
                  80 <Text style={styles.unitText}>%</Text>
                </Text>
              </View>
              <View style={styles.statBox}>
                <FontAwesome5 name="tachometer-alt" size={wp(4)} color="#666" />
                <Text style={styles.statSmallLabel}>Mileage</Text>
                <Text style={styles.statValue}>
                  18.5 <Text style={styles.unitText}>km/l</Text>
                </Text>
              </View>
            </View>

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
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionLabel}>Vehicle Info</Text>
            <View style={styles.sectionLine} />
          </View>

          <View style={styles.infoCard}>
            {[
              { icon: 'car', l: 'Make', v: vehicle.brand || vehicle.make },
              { icon: 'model', l: 'Model', v: vehicle.model },
              { icon: 'calendar', l: 'Year', v: vehicle.year },
              { icon: 'gas-pump', l: 'Fuel', v: vehicle.fuel || 'Petrol' },
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

            <TouchableOpacity
              style={styles.updateBtn}
              onPress={handleUpdateOdometer}
              activeOpacity={0.7}
            >
              <FontAwesome5 name="camera" size={wp(4)} color="#FFBF00" />
              <Text style={styles.updateBtnText}>Update Odometer</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLine} />
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.sectionLine} />
          </View>

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
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

  scrollContent: { paddingHorizontal: wp(4), paddingBottom: hp(5) },
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

  heroCard: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    borderRadius: 24,
    padding: wp(5),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    backgroundColor: '#0a0a0a',
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

  infoCard: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    borderRadius: 24,
    padding: wp(4),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#0a0a0a',
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
});

export default VehicleDetails;
