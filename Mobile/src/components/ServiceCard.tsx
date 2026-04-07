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
  SERVICE: { icon: 'wrench', accent: '#FBBF24', label: 'Service' },
  FULL_SERVICE: { icon: 'car-wrench', accent: '#FBBF24', label: 'Full Service' },
  REPAIR: { icon: 'tools', accent: '#FB923C', label: 'Repair' },
  PART_REPLACEMENT: { icon: 'cogs', accent: '#38BDF8', label: 'Part Replacement' },
  INSPECTION: { icon: 'clipboard-check', accent: '#34D399', label: 'Inspection' },
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
      <MaterialIcon name={icon} size={wp(4)} color="#A3A3A3" />
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
      <LinearGradient
        colors={['#171717', '#101010']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <View style={styles.titleRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: `${theme.accent}1C`, borderColor: `${theme.accent}4A` },
              ]}
            >
              <MaterialIcon
                name={theme.icon}
                size={wp(5.1)}
                color={theme.accent}
              />
            </View>

            <View style={styles.titleBlock}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.serviceType, { color: theme.accent }]}>
                {serviceLabel}
              </Text>
            </View>
          </View>

          {item.date ? (
            <View style={styles.datePill}>
              <MaterialIcon name="calendar" size={wp(3.6)} color="#9A9A9A" />
              <Text style={styles.dateText}>{item.date}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.detailsWrap}>
          <DetailRow icon="map-marker" value={item.garage || '-'} />

          {item.odometer ? (
            <DetailRow icon="speedometer" value={item.odometer} />
          ) : null}

          {item.parts ? (
            <DetailRow icon="cogs" value={`Parts: ${item.parts}`} />
          ) : null}
        </View>

        {item.nextService ? (
          <LinearGradient
            colors={['rgba(255,191,0,0.22)', 'rgba(255,191,0,0.08)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.nextServicePill}
          >
            <MaterialIcon
              name="calendar-clock"
              size={wp(3.8)}
              color="#FFBF00"
            />
            <Text style={styles.nextText}>{item.nextService}</Text>
          </LinearGradient>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: hp(1.8),
    borderRadius: wp(5.2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 10,
  },
  card: {
    borderRadius: wp(5.2),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: wp(4.2),
    paddingVertical: hp(1.6),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: hp(1.2),
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
    borderRadius: wp(3.2),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    marginRight: wp(3),
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: wp(4.25),
    fontFamily: 'Outfit-Bold',
    marginBottom: hp(0.3),
  },
  serviceType: {
    fontSize: wp(3.15),
    fontFamily: 'Outfit-SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: wp(3.8),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    paddingHorizontal: wp(2.8),
    paddingVertical: hp(0.6),
    gap: wp(1),
  },
  dateText: {
    color: '#BBBBBB',
    fontSize: wp(3),
    fontFamily: 'Outfit-Medium',
  },
  detailsWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.07)',
    paddingTop: hp(1.2),
    gap: hp(0.8),
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(2),
  },
  detailText: {
    flex: 1,
    color: '#C3C3C3',
    fontSize: wp(3.35),
    fontFamily: 'Outfit-Regular',
    lineHeight: hp(2.2),
  },
  nextServicePill: {
    marginTop: hp(1.25),
    borderRadius: wp(3.5),
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.3)',
    paddingHorizontal: wp(3),
    paddingVertical: hp(0.75),
    flexDirection: 'row',
    alignItems: 'center',
    gap: wp(1.8),
  },
  nextText: {
    color: '#F8DA7B',
    fontSize: wp(3.15),
    fontFamily: 'Outfit-SemiBold',
  },
});
