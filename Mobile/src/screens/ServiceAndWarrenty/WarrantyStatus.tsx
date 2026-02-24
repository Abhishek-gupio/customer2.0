import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { vehicleParts } from './data';
import { PartStatusCard } from '../../components/PartsStatusScreen';
import { WarrantySummary } from '../../components/WarrentySummary';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import { useNavigation } from '../../lib/react-navigation-native';
import { Text, TouchableOpacity } from 'react-native';

import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';
import { SafeAreaView } from 'react-native-safe-area-context';

export const WarrantyStatus = () => {
  const hasCritical = vehicleParts.some(p => p.critical || p.percentage === 0);
  const navigation = useNavigation();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
            <LinearGradient colors={['rgb(62, 59, 59)', 'rgba(27, 26, 26, 0.95)']} style={styles.shader}>
              <View style={styles.header}>
                <View style={styles.subHeder}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                  <Icon name="arrow-left" size={wp(5)} color="#fff" />
                </TouchableOpacity>
        
                    <Text style={styles.headerTitle}>Warranty Status</Text>
                </View>
              </View>
              <WarrantySummary active={5} expired={1} />
            </LinearGradient>

    <FlatList
      data={vehicleParts}
      keyExtractor={item => item.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.container}
      renderItem={({ item }) => <PartStatusCard {...item} />}
        // ListHeaderComponent={<WarrantySummary active={4} expired={2} />}
        // ListHeaderComponentStyle={{ marginBottom: hp(3) }}
      style={{ backgroundColor: '#000', marginTop: -hp(1), borderTopLeftRadius: wp(8), borderTopRightRadius: wp(8) }}
    />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: hp(2),
  },
    header: {
    paddingHorizontal: wp(6),
    paddingVertical: hp(2),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: '#fff', fontSize: wp(6), fontWeight: '700' },
  subHeder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(5),
  },
    shader: {
    borderBottomLeftRadius: wp(9),
    borderBottomRightRadius: wp(9),
    paddingBottom: hp(5),
  },
});