import React, { useMemo } from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';

type ExpenseSlideProps = {
  bannerWidth: number;
  onPress: () => void;
};

export const ExpenseSlide = React.memo(function ExpenseSlide({
  bannerWidth,
  onPress,
}: ExpenseSlideProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <TouchableOpacity
        style={styles.slideFull}
        activeOpacity={0.9}
        onPress={onPress}
      >
        <View style={styles.promoSlide}>
          <View style={styles.promoLeft}>
            <Text style={[styles.promoSubtitle, { color: '#5F9EA0' }]}>
              Smart Tracking
            </Text>
            <Text style={styles.promoTitle}>Expense Tracker</Text>
            <Text style={styles.promoDesc}>
              Monitor your fuel, service and other vehicle costs easily.
            </Text>
            <View style={styles.promoAction}>
              <Text style={styles.promoActionText}>Try Now</Text>
              <MaterialIcon name="chevron-right" size={18} color="#5F9EA0" />
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
