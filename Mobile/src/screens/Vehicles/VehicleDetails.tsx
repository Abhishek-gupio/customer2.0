import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  Easing,
} from 'react-native';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const VehicleDetails = ({ navigation, route }: any) => {
  // Get vehicle data from navigation params
  const vehicle = route.params?.vehicle || {
    plate: 'DL 01 AB 1234',
    brand: 'Maruti Suzuki',
    model: 'Swift',
    year: '2022',
    healthScore: 85,
    photo:
      'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=400',
  };

  // Animation and State
  const [isRecalculating, setIsRecalculating] = useState(false);
  const animatedValue = useRef(new Animated.Value(0)).current;
  const spinValue = useRef(new Animated.Value(0)).current;

  const healthScore = vehicle.healthScore || 85;
  const radius = 68;
  const circumference = 2 * Math.PI * radius;

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

    // Spin icon animation
    Animated.timing(spinValue, {
      toValue: 1,
      duration: 1500,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();

    // Reset health progress after a delay to simulate calculation
    setTimeout(() => {
      setIsRecalculating(false);
      startHealthAnimation();
    }, 1500);
  };

  const spinRotation = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 100],
    outputRange: [circumference, 0],
  });

  const ActionBox = ({ icon, label }: { icon: string; label: string }) => (
    <TouchableOpacity style={styles.actionCard} activeOpacity={0.5}>
      <View style={styles.actionIcon}>
        <FontAwesome5 name={icon} size={wp(5)} color="#888" />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <FontAwesome5 name="arrow-left" size={wp(5)} color="#fff" />
        </TouchableOpacity>
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

        <View style={styles.healthContainer}>
          <Text style={styles.sectionTitleGreen}>Health Score</Text>

          <View style={styles.gaugeContainer}>
            <Svg width={wp(45)} height={wp(45)} viewBox="0 0 160 160">
              <Defs>
                <LinearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <Stop offset="0%" stopColor="#10b981" />
                  <Stop offset="100%" stopColor="#34d399" />
                </LinearGradient>
              </Defs>
              <Circle
                cx="80"
                cy="80"
                r={radius}
                stroke="rgba(16, 185, 129, 0.05)"
                strokeWidth="10"
                fill="transparent"
              />
              <AnimatedCircle
                cx="80"
                cy="80"
                r={radius}
                stroke="url(#grad)"
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
              <Text style={styles.scoreMax}>/ 100</Text>
              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>Excellent</Text>
              </View>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statSmallLabel}>Age</Text>
              <Text style={styles.statValue}>
                90 <Text style={styles.unitText}>days</Text>
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statSmallLabel}>Maintenance</Text>
              <Text style={styles.statValue}>
                80 <Text style={styles.unitText}>%</Text>
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statSmallLabel}>Mileage</Text>
              <Text style={styles.statValue}>
                18.5 <Text style={styles.unitText}>km/l</Text>
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.recalcBtn, isRecalculating && { opacity: 0.6 }]}
            onPress={handleRecalculate}
            disabled={isRecalculating}
          >
            <Animated.View
              style={{ transform: [{ rotate: spinRotation }], marginRight: 10 }}
            >
              <FontAwesome5 name="redo-alt" size={wp(3.5)} color="#666" />
            </Animated.View>
            <Text style={styles.recalcText}>
              {isRecalculating ? 'Recalculating...' : 'Recalculate'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.sectionTitle}>Info</Text>
          {[
            { l: 'Make', v: vehicle.brand || vehicle.make },
            { l: 'Model', v: vehicle.model },
            { l: 'Year', v: vehicle.year },
            { l: 'Fuel', v: vehicle.fuel || 'Petrol' },
            { l: 'Odometer', v: vehicle.odometer || '23,450 km' },
          ].map((item, i) => (
            <View key={i} style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.l}</Text>
              <Text style={styles.infoValue}>{item.v}</Text>
            </View>
          ))}
          <TouchableOpacity style={styles.updateBtn}>
            <Text style={styles.updateBtnText}>Update Odometer</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actionCardContainer}>
          <View style={styles.actionHeader}>
            <FontAwesome5 name="chevron-up" size={wp(3)} color="#666" />
            <Text style={styles.actionsTitle}>Actions</Text>
          </View>
          <View style={styles.quickActionsGrid}>
            <ActionBox icon="file-alt" label="Docs" />
            <ActionBox icon="wrench" label="Service" />
            <ActionBox icon="history" label="History" />
            <ActionBox icon="share-alt" label="Share" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { paddingHorizontal: wp(6), paddingVertical: hp(1) },
  backBtn: { width: wp(10), height: wp(10), justifyContent: 'center' },
  scrollContent: { paddingHorizontal: wp(5), paddingBottom: hp(5) },
  heroCard: {
    backgroundColor: '#121212',
    borderRadius: 24,
    padding: wp(4),
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(2),
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
  heroText: { marginLeft: wp(4), flex: 1 },
  plateText: { color: '#fff', fontSize: wp(4.8), fontWeight: 'bold' },
  modelText: { color: '#888', fontSize: wp(3.4), marginTop: 2 },
  yearText: { color: '#555', fontSize: wp(3), marginTop: 2 },
  healthContainer: {
    backgroundColor: '#0e1612',
    borderRadius: 32,
    padding: wp(6),
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
    marginBottom: hp(2),
  },
  sectionTitleGreen: {
    color: '#10b981',
    fontSize: wp(3.5),
    fontWeight: 'bold',
    marginBottom: hp(2),
  },
  gaugeContainer: { alignItems: 'center', justifyContent: 'center' },
  gaugeCenterText: { position: 'absolute', alignItems: 'center' },
  scoreText: { color: '#fff', fontSize: wp(10), fontWeight: 'bold' },
  scoreMax: { color: '#555', fontSize: wp(3.2) },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    marginTop: 8,
  },
  statusText: {
    color: '#10b981',
    fontSize: wp(2.5),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: hp(3.5),
  },
  statBox: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: wp(25),
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statSmallLabel: {
    color: '#444',
    fontSize: wp(2.2),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  statValue: {
    color: '#fff',
    fontSize: wp(3.5),
    fontWeight: 'bold',
    marginTop: 4,
  },
  unitText: { color: '#666', fontSize: wp(2.5), fontWeight: 'normal' },
  recalcBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: hp(3),
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: hp(1.8),
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  recalcText: { color: '#777', fontSize: wp(3.5), fontWeight: '600' },
  infoCard: {
    backgroundColor: '#121212',
    borderRadius: 28,
    padding: wp(6),
    marginBottom: hp(2),
  },
  sectionTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: 'bold',
    marginBottom: hp(2.5),
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: hp(2.2),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
    paddingBottom: hp(1),
  },
  infoLabel: { color: '#666', fontSize: wp(3.6) },
  infoValue: { color: '#fff', fontSize: wp(3.6), fontWeight: '600' },
  updateBtn: {
    width: '100%',
    paddingVertical: hp(2),
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    marginTop: hp(1),
  },
  updateBtnText: { color: '#fff', fontSize: wp(3.5), fontWeight: 'bold' },
  actionCardContainer: {
    backgroundColor: '#121212',
    borderRadius: 28,
    padding: wp(6),
    marginBottom: hp(2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: hp(1),
  },
  actionsTitle: {
    color: '#fff',
    fontSize: wp(4.5),
    fontWeight: 'bold',
    marginBottom: 0,
    marginLeft: wp(2),
  },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  actionCard: {
    backgroundColor: '#121212',
    width: wp(21),
    paddingVertical: wp(4.5),
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  actionIcon: { marginBottom: 10 },
  actionLabel: {
    color: '#555',
    fontSize: wp(2.4),
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});

export default VehicleDetails;
