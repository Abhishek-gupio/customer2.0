import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { styles } from '../homeStyles';

type NumberPlateSearchBarProps = {
  animatedPlaceholder: string;
  onPress: () => void;
};

export const NumberPlateSearchBar = React.memo(function NumberPlateSearchBar({
  animatedPlaceholder,
  onPress,
}: NumberPlateSearchBarProps) {
  return (
    <View style={styles.numberPlateSection}>
      <TouchableOpacity
        style={styles.numberPlateContainer}
        activeOpacity={0.8}
        onPress={onPress}
      >
        <View style={styles.indContainer}>
          <Text style={styles.flagEmoji}>🇮🇳</Text>
          <Text style={styles.indText}>IND</Text>
        </View>
        <View style={styles.numberPlatePlaceholderContainer}>
          <Text style={styles.numberPlatePlaceholderText}>
            {animatedPlaceholder || 'MH01CH4322'}
          </Text>
        </View>
        <View style={styles.searchButton}>
          <MaterialIcon name="magnify" size={22} color="#fff" />
        </View>
      </TouchableOpacity>
    </View>
  );
});
