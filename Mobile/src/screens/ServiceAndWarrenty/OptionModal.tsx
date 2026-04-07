import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import {
  serviceOptionItems,
  type ServiceHubId,
} from "../../config/servicesConfig";

interface ServiceOptionsOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (serviceId: ServiceHubId) => void;
}

export default function ServiceOptionsOverlay({
  visible,
  onClose,
  onSelect,
}: ServiceOptionsOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Panel */}
        <Pressable style={styles.panel} onPress={() => {}}>
          <View style={styles.header}>
            <Text style={styles.title}>Service Options</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={25} color="#fff" />
            </TouchableOpacity>
          </View>

          {serviceOptionItems.map((item) => (
            <TouchableOpacity
              key={item.serviceId}
              style={styles.optionRow}
              onPress={() => onSelect(item.serviceId)}
            >
              <Ionicons
                name={item.icon}
                size={22}
                color="#fff"
                style={styles.leftIcon}
              />
              <Text style={styles.optionText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color="#aaa" />
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    paddingHorizontal: "5%",
  },

  panel: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: "rgba(28,28,28,0.95)",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  title: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },

  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
  },

  leftIcon: {
    marginRight: 14,
  },

  optionText: {
    flex: 1,
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
});
