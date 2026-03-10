import React from "react";
import { View, Text, StyleSheet, TouchableOpacity} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { NotificationItem } from "../screens/Main/notifiData";

interface Props {
  item: NotificationItem;
  onRemove: (id: string) => void;
}

const iconConfig = {
  insurance: {
    icon: "alert-circle-outline",
    color: "#FFC107",
  },
  service: {
    icon: "checkmark-circle-outline",
    color: "#00E676",
  },
  expense: {
    icon: "wallet-outline",
    color: "#3B82F6",
  },
  maintenance: {
    icon: "construct-outline",
    color: "#8B5CF6",
  },
  parking: {
    icon: "car-outline",
    color: "#06B6D4",
  },
  fuel: {
    icon: "water-outline",
    color: "#22C55E",
  },
  alert: {
    icon: "warning-outline",
    color: "#EF4444",
  },
};

const NotificationCard: React.FC<Props> = ({ item, onRemove}) => {
  const config = iconConfig[item.type];


  return (
    <View style={styles.card}>
      {/* Icon */}
      <View style={[styles.iconContainer, { borderColor: config.color }]}>
        <Ionicons name={config.icon} size={24} color={config.color} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.description}>{item.description}</Text>

        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={14} color="#aaa" />
          <Text style={styles.time}>{item.time}</Text>
        </View>
      </View>

      {/* Unread Dot */}
      {item.unread && <View style={styles.dot} />}

      <TouchableOpacity onPress={() => onRemove(item.id)}>
        <Ionicons name="trash-outline" size={20} color="#999" />
      </TouchableOpacity>


    </View>
  );
};

export default NotificationCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#0b0f19",
    padding: 16,
    borderRadius: 20,
    marginBottom: 14,
    alignItems: "center",
  },

  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },

  content: {
    flex: 1,
  },

  title: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },

  description: {
    color: "#9CA3AF",
    fontSize: 14,
    marginTop: 3,
  },

  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  time: {
    color: "#9CA3AF",
    fontSize: 12,
    marginLeft: 4,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFC107",
  },
});