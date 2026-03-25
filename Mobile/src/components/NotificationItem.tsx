import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialCommunityIcons from "react-native-vector-icons/MaterialCommunityIcons";
import { NotificationItem } from "../screens/Main/notifiData";
import { Swipeable, RectButton } from 'react-native-gesture-handler';

interface Props {
  item: NotificationItem;
  onRemove: (id: string) => void;
  onPress?: () => void;
  onLongPress?: () => void;
  onSwipeDelete?: () => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
}

const iconConfig = {
  insurance: { icon: "shield-outline", color: "#FFC107" },
  service: { icon: "build-outline", color: "#00E676" },
  expense: { icon: "wallet-outline", color: "#3B82F6" },
  maintenance: { icon: "construct-outline", color: "#8B5CF6" },
  parking: { icon: "car-outline", color: "#06B6D4" },
  fuel: { icon: "water-outline", color: "#22C55E" },
  alert: { icon: "warning-outline", color: "#EF4444" },
  odometer: { icon: "speedometer-outline", color: "#F59E0B" },
};

const NotificationCard: React.FC<Props> = ({
  item,
  onRemove,
  onPress,
  onLongPress,
  onSwipeDelete,
  isSelectionMode = false,
  isSelected = false,
}) => {
  const config = iconConfig[item.type] ?? iconConfig.alert;

  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>, dragX: Animated.AnimatedInterpolation<number>) => {
    const trans = dragX.interpolate({
      inputRange: [-100, 0],
      outputRange: [0, 100],
    });
    return (
      <RectButton style={styles.deleteAction} onPress={onSwipeDelete}>
        <Ionicons name="trash-outline" size={24} color="#fff" />
      </RectButton>
    );
  };

  const cardContent = (
    <TouchableOpacity
      activeOpacity={0.7}
      style={[styles.card, isSelectionMode && isSelected ? styles.cardSelected : null]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
    >
      <View style={styles.container}>
        <View style={[styles.iconContainer, { backgroundColor: `${config.color}15` }]}>
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>

        <View style={styles.contentColumn}>
          <View style={styles.contentHeader}>
            <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
            {item.pinned ? (
              <View style={styles.pinBadge}>
                <MaterialCommunityIcons name="pin-outline" size={14} color="#FFBF00" />
              </View>
            ) : null}
          </View>
          
          <Text style={styles.description} numberOfLines={3}>
            {item.description}
          </Text>

          <View style={styles.bottomRow}>
            <Text style={styles.time}>{item.time}</Text>
          </View>
        </View>

        {isSelectionMode ? (
          <View style={styles.selectionMarker}>
            <MaterialCommunityIcons
              name={isSelected ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
              size={22}
              color={isSelected ? '#FFBF00' : 'rgba(255,255,255,0.35)'}
            />
          </View>
        ) : item.unread ? (
          <View style={styles.dot} />
        ) : null}
      </View>
    </TouchableOpacity>
  );

  if (isSelectionMode) {
    return cardContent;
  }

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={onSwipeDelete}
    >
      {cardContent}
    </Swipeable>
  );
};

export default NotificationCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#000',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  cardSelected: {
    backgroundColor: 'rgba(255,191,0,0.08)',
  },
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
    marginTop: 2,
  },
  contentColumn: {
    flex: 1,
    gap: 4,
  },
  contentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    color: "#fff",
    fontSize: 15,
    fontFamily: 'Outfit-Bold',
    lineHeight: 20,
    flex: 1,
  },
  pinBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255,191,0,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,191,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  description: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
    lineHeight: 18,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  time: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 10,
    fontFamily: 'Outfit-Regular',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFBF00",
    marginLeft: 12,
    marginTop: 6,
  },
  selectionMarker: {
    marginLeft: 12,
    marginTop: 2,
  },
  deleteAction: {
    backgroundColor: '#ff4444',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
});
