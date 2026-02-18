import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

interface ManualEntryOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function ManualEntryOverlay({ visible, onClose }: ManualEntryOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.panel} onPress={() => {}}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Add Manual Entry</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          <Label text="Category" />
          <Input value="Fuel" icon="chevron-down" />

          <Label text="Amount" />
          <Input placeholder="₹ 0" />

          <Label text="Description" />
          <Input placeholder="Enter description" />

          <Label text="Date" />
          <Input placeholder="dd-mm-yyyy" icon="calendar-outline" />

          <TouchableOpacity style={styles.saveBtn} disabled>
            <Text style={styles.saveText}>Save Entry</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const Label = ({ text }: { text: string }) => (
  <Text style={{ color: "#aaa", marginBottom: 6 }}>{text}</Text>
);

const Input = ({ placeholder, value, icon }: { placeholder?: string; value?: string; icon?: string }) => (
  <View style={styles.input}>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#666"
      value={value}
      style={{ color: "#fff", flex: 1 }}
    />
    {icon && <Ionicons name={icon} size={18} color="#aaa" />}
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  panel: {
    backgroundColor: "rgba(28,28,28,0.95)",
    borderRadius: 28,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 16,
  },
  saveBtn: {
    marginTop: 10,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#555",
    justifyContent: "center",
    alignItems: "center",
    opacity: 0.5,
  },
  saveText: {
    color: "#aaa",
    fontSize: 16,
  },
});
