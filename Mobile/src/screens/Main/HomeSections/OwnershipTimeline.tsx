import React, { useCallback, useMemo } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import { createStyles } from '../homeStyles';
import { useTheme } from '../../../theme/ThemeContext';
import type { TimelineItem } from '../types/home';

const FlashListAny = FlashList as any;

type OwnershipTimelineProps = {
  items: TimelineItem[];
  recommendedId?: string;
  entranceAnim: Animated.Value;
};

export const OwnershipTimeline = React.memo(function OwnershipTimeline({
  items,
  recommendedId,
  entranceAnim,
}: OwnershipTimelineProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const renderItem = useCallback(
    ({ item, index }: { item: TimelineItem; index: number }) => (
      <Animated.View
        style={{
          opacity: entranceAnim.interpolate({
            inputRange: [0, 0.35 + index * 0.1, 1],
            outputRange: [0, 0, 1],
            extrapolate: 'clamp',
          }),
          transform: [
            {
              translateY: entranceAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [16 + index * 2, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          style={[
            styles.timelineCard,
            item.priority === 'urgent'
              ? styles.timelineCardUrgent
              : item.priority === 'good'
                ? styles.timelineCardGood
                : undefined,
          ]}
          onPress={item.onPress}
        >
          <LinearGradient
            colors={[`${item.accent}2A`, 'rgba(255,255,255,0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.timelineCardGlow}
          />
          <View style={styles.timelineCardInner}>
            <View style={styles.timelineMainContent}>
              <View style={styles.timelineCardTopRow}>
                <View
                  style={[
                    styles.timelineIconWrap,
                    { backgroundColor: `${item.accent}20` },
                  ]}
                >
                  {item.iconSet === 'fa' ? (
                    <Icon name={item.icon} size={wp(4.8)} color={item.accent} />
                  ) : item.iconSet === 'ion' ? (
                    <Ionicons
                      name={item.icon as any}
                      size={wp(5.2)}
                      color={item.accent}
                    />
                  ) : (
                    <MaterialIcon
                      name={item.icon}
                      size={wp(5.2)}
                      color={item.accent}
                    />
                  )}
                </View>
                <View style={styles.timelineTopChips}>
                  <View
                    style={[
                      styles.timelineBadge,
                      {
                        borderColor: `${item.accent}55`,
                        backgroundColor: `${item.accent}14`,
                      },
                    ]}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.timelineBadgeText, { color: item.accent }]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                </View>
              </View>
              <View style={styles.timelineMetaRow}>
                <Text numberOfLines={1} style={styles.timelineEyebrow}>
                  {item.eyebrow}
                </Text>
                <View
                  style={[
                    styles.timelineStagePill,
                    item.stage === 'Now'
                      ? styles.timelineStageNow
                      : item.stage === 'Next'
                        ? styles.timelineStageNext
                        : styles.timelineStageLater,
                  ]}
                >
                  <Text numberOfLines={1} style={styles.timelineStageText}>
                    {item.id === recommendedId ? 'Now \u2022 Top' : item.stage}
                  </Text>
                </View>
              </View>
              <View style={styles.timelineBody}>
                <Text numberOfLines={2} style={styles.timelineCardTitle}>
                  {item.title}
                </Text>
                <Text numberOfLines={2} style={styles.timelineDescription}>
                  {item.description}
                </Text>
              </View>
            </View>
            <View style={styles.timelineActionRow}>
              <View
                style={[
                  styles.timelineActionPill,
                  { borderColor: `${item.accent}80` },
                ]}
              >
                <Text numberOfLines={1} style={styles.timelineActionText}>
                  {item.cta}
                </Text>
                <MaterialIcon
                  name="chevron-right"
                  size={16}
                  color={item.accent}
                />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    ),
    [entranceAnim, recommendedId],
  );

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>Ownership Timeline</Text>
          <Text style={styles.sectionSubtitle}>
            Suggested next actions for your vehicle.
          </Text>
        </View>
      </View>
      <FlashListAny
        horizontal
        data={items}
        estimatedItemSize={300}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.timelineScrollContent}
        keyExtractor={(item: TimelineItem) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
});
