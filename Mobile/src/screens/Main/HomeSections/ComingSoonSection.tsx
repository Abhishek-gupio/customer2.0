import React from 'react';
import { Image, Text, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { styles } from '../homeStyles';

export const ComingSoonSection = React.memo(function ComingSoonSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitleCenter}>Coming Soon</Text>
      <View style={styles.featureRow}>
        <View style={styles.featureCard}>
          <MaterialIcon name="car-electric" size={wp(8)} color="#555" />
          <Text style={styles.featureTitle}>EV Charging</Text>
        </View>
        <View style={styles.featureCard}>
          <MaterialIcon name="car-wash" size={wp(8)} color="#555" />
          <Text style={styles.featureTitle}>Car Wash</Text>
        </View>
        <View style={styles.featureCard}>
          <MaterialIcon name="tow-truck" size={wp(8)} color="#555" />
          <Text style={styles.featureTitle}>Emergency</Text>
        </View>
      </View>
      <Image
        source={require('../../../assets/images/coming_soon.png') as any}
        style={styles.comingSoonBadge}
        resizeMode="contain"
      />
    </View>
  );
});
