import React, { useCallback } from 'react';
import { Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { styles } from '../homeStyles';

type SocialSlideProps = {
  bannerWidth: number;
};

export const SocialSlide = React.memo(function SocialSlide({
  bannerWidth,
}: SocialSlideProps) {
  const handleInstagramPress = useCallback(() => {
    void Linking.openURL('https://www.instagram.com/gupio.in/');
  }, []);

  const handleWebsitePress = useCallback(() => {
    void Linking.openURL('https://gupio.in/');
  }, []);

  return (
    <View style={[styles.slideFull, { width: bannerWidth }]}>
      <View style={styles.promoSlide}>
        <View style={styles.promoLeft}>
          <Text style={styles.promoSubtitle}>Stay Connected</Text>
          <Text style={styles.promoTitle}>Follow Us on Instagram</Text>
          <View style={styles.promoButtons}>
            <TouchableOpacity
              style={styles.promoBtn}
              onPress={handleInstagramPress}
            >
              <Icon name="instagram" size={14} color="#000" />
              <Text style={styles.promoBtnText}>Instagram</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.promoBtn, { backgroundColor: '#333' }]}
              onPress={handleWebsitePress}
            >
              <MaterialIcon name="earth" size={14} color="#fff" />
              <Text style={[styles.promoBtnText, { color: '#fff' }]}>
                Website
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.promoRight}>
          <Image
            source={
              require('../../../assets/images/insta&website_AD.png') as any
            }
            style={styles.adImage}
            resizeMode="contain"
          />
        </View>
      </View>
    </View>
  );
});
