import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { styles } from '../homeStyles';
import type { HomeFuelPrices } from '../types/home';

type FuelPricesSectionProps = {
  fuelPrices: HomeFuelPrices | null;
  fuelLoading: boolean;
  selectedState: string;
  userLocationDisplay: string;
  locationLoading: boolean;
  onStateModalOpen: () => void;
};

export const FuelPricesSection = React.memo(function FuelPricesSection({
  fuelPrices,
  fuelLoading,
  selectedState,
  userLocationDisplay,
  locationLoading,
  onStateModalOpen,
}: FuelPricesSectionProps) {
  return (
    <View style={styles.fuelSection}>
      <View style={styles.fuelHeaderBanner}>
        <View style={styles.fuelHeaderLeft}>
          <Text style={styles.fuelHeaderTitle}>Current Fuel Prices in</Text>
          <View style={styles.locationTrackRow}>
            <Ionicons name="location" size={wp(3)} color="#333" />
            <Text style={styles.locationTrackText} numberOfLines={1}>
              {locationLoading ? 'Detecting...' : userLocationDisplay}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.stateButton} onPress={onStateModalOpen}>
          <Text style={styles.stateButtonText}>
            {selectedState ? selectedState.split(' ')[0] : 'Detecting...'}
          </Text>
          <MaterialIcon name="chevron-down" size={14} color="#0a0a0a" />
        </TouchableOpacity>
      </View>

      {fuelLoading ? (
        <View style={styles.fuelContentCard}>
          <ActivityIndicator
            size="large"
            color="#fff"
            style={styles.fuelLoader}
          />
        </View>
      ) : fuelPrices ? (
        <View style={styles.fuelContentCard}>
          <View style={styles.fuelInlineContainer}>
            <View style={styles.fuelInlineItem}>
              <Text style={styles.fuelInlineLabel}>Petrol:</Text>
              <Text style={styles.fuelInlineValue}>
                {'\u20B9'} {fuelPrices.petrol}
              </Text>
            </View>
            <View style={styles.fuelInlineSpacer} />
            <View style={styles.fuelInlineItem}>
              <Text style={styles.fuelInlineLabel}>Diesel:</Text>
              <Text style={styles.fuelInlineValue}>
                {'\u20B9'} {fuelPrices.diesel}
              </Text>
            </View>
            {fuelPrices.cng ? (
              <>
                <View style={styles.fuelInlineSpacer} />
                <View style={styles.fuelInlineItem}>
                  <Text style={styles.fuelInlineLabel}>CNG:</Text>
                  <Text style={styles.fuelInlineValue}>
                    {'\u20B9'} {fuelPrices.cng}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={styles.fuelContentCard}>
          <Text style={styles.loadingText}>
            {selectedState === 'Detecting...'
              ? 'Finding your city...'
              : `No fuel data for ${selectedState || 'current state'}`}
          </Text>
        </View>
      )}
    </View>
  );
});
