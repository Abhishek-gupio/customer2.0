import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { styles } from '../homeStyles';

type ExpenseSlideProps = {
  bannerWidth: number;
  onPress: () => void;
};

export const ExpenseSlide = React.memo(function ExpenseSlide({
  bannerWidth,
  onPress,
}: ExpenseSlideProps) {
  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.promoSlide}>
          <View style={styles.promoLeft}>
            <Text style={[styles.promoSubtitle, { color: '#FFBF00' }]}>
              Smart Tracking
            </Text>
            <Text style={styles.promoTitle}>Expense Tracker</Text>
            <Text style={styles.promoDesc}>
              Monitor your fuel, service and other vehicle costs easily.
            </Text>
            <View style={styles.promoAction}>
              <Text style={styles.promoActionText}>Try Now</Text>
              <MaterialIcon name="chevron-right" size={18} color="#FFBF00" />
            </View>
          </View>
          <View style={styles.promoRight}>
            <Image
              source={require('../../../assets/images/expense_AD.png') as any}
              style={styles.adImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
});
