import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from 'react-native-responsive-screen';

type ServiceCardItem = {
  id: string;
  title: string;
  serviceType?: string;
  serviceLabel?: string;
  garage?: string;
  date?: string;
  odometer?: string;
  parts?: string;
  nextService?: string;
};

const SERVICE_THEME: Record<string, { icon: string; accent: string; label: string }> = {
  SERVICE: { icon: 'wrench', accent: '#fff', label: 'Service' },
  FULL_SERVICE: { icon: 'car-wrench', accent: '#fff', label: 'Full Service' },
  REPAIR: { icon: 'tools', accent: '#fff', label: 'Repair' },
  PART_REPLACEMENT: { icon: 'cogs', accent: '#fff', label: 'Part Replacement' },
  INSPECTION: { icon: 'clipboard-check', accent: '#fff', label: 'Inspection' },
};

const getServiceTheme = (serviceType?: string) => {
  if (!serviceType) {
    return SERVICE_THEME.SERVICE;
  }
  return SERVICE_THEME[serviceType] || SERVICE_THEME.SERVICE;
};

function DetailRow({ icon, value }: { icon: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <MaterialIcon name={icon} size={wp(3.8)} color="#444" />
      <Text style={styles.detailText} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

export default function ServiceCard({ item }: { item: ServiceCardItem }) {
  const theme = getServiceTheme(item.serviceType);
  const serviceLabel = item.serviceLabel || theme.label;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View style={styles.iconWrap}>
              <MaterialIcon
                name={theme.icon}
                size={wp(5)}
                color="#fff"
              />
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={styles.serviceType}>
                {serviceLabel}
              </Text>
            </View>
          </View>

          {item.date ? (
            <View style={styles.datePill}>
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailsWrap}>
          <DetailRow icon="map-marker-radius" value={item.garage || '-'} />
          {item.odometer ? (
            <DetailRow icon="speedometer-slow" value={item.odometer} />
          ) : null}
          {item.parts ? (
            <DetailRow icon="application-cog-outline" value={item.parts} />
          ) : null}
        </View>

        {item.nextService ? (
          <View style={styles.nextServicePill}>
            <MaterialIcon
              name="calendar-refresh"
              size={wp(4)}
              color="#000"
            />
            <Text style={styles.nextText}>{item.nextService}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: hp(1.8),
  },
  card: {
    backgroundColor: '#050505',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#111',
    padding: wp(4.5),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: hp(1.8),
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: wp(2),
  },
  iconWrap: {
    width: wp(11),
    height: wp(11),
    borderRadius: 14,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#111',
    marginRight: wp(3.5),
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: '#FFF',
    fontSize: wp(4.2),
    fontFamily: 'Outfit-Bold',
    marginBottom: 2,
  },
  serviceType: {
    fontSize: wp(2.6),
    fontFamily: 'Outfit-Black',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  datePill: {
    backgroundColor: '#fff',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.6),
    borderRadius: 10,
  },
  dateText: {
    color: '#000',
    fontSize: wp(2.8),
    fontFamily: 'Outfit-Black',
  },
  detailsWrap: {
    backgroundColor: '#030303',
    borderRadius: 20,
    padding: wp(3.5),
    gap: hp(1),
    marginBottom: hp(1.5),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2.5),
  },
  detailText: {
    flex: 1,
    color: '#666',
    fontSize: wp(3.1),
    fontFamily: 'Outfit-Medium',
  },
  nextServicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
    backgroundColor: '#fff',
    paddingHorizontal: wp(4),
    paddingVertical: hp(1),
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  nextText: {
    color: '#000',
    fontSize: wp(3),
    fontFamily: 'Outfit-Black',
  },
});
