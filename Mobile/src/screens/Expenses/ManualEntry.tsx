import React, { useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";

interface ManualEntryOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function ManualEntryOverlay({ visible, onClose }: ManualEntryOverlayProps) {
  const [category, setCategory] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const categories = ['Other', 'Fuel', 'Service', 'Tolls', 'Insurance'];

  const isValid = amount.trim().length > 0;

  const handleSave = () => {
    console.log({ category, amount, description, date });
    setCategory("Fuel");
    setAmount("");
    setDescription("");
    setDate("");
    setShowCategoryPicker(false);
    onClose();
  };

  return (
    <>

      <Modal transparent visible={visible} animationType="fade">
        <Pressable style={styles.backdrop} onPress={onClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.panel} onPress={() => {}}>

              <View style={styles.header}>
                <Text style={styles.title}>Add Manual Entry</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <Label text="Category" />
              <TouchableOpacity onPress={() => setShowCategoryPicker(true)}>
                <Input value={category} icon="chevron-down" editable={false} />
              </TouchableOpacity>


              <Label text="Amount" />
              <Input
                placeholder="₹ 0"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />


              <Label text="Description" />
              <Input
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
              />


              <Label text="Date" />
              <Input
                placeholder="dd-mm-yyyy"
                value={date}
                onChangeText={setDate}
                icon="calendar-outline"
              />


              <TouchableOpacity
                style={[styles.saveBtn, isValid && styles.saveBtnActive]}
                disabled={!isValid}
                onPress={handleSave}
              >
                <Text style={[styles.saveText, isValid && styles.saveTextActive]}>
                  Save Entry
                </Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>


      <Modal transparent visible={showCategoryPicker} animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowCategoryPicker(false)}
        >
          <Pressable style={styles.categoryPanel} onPress={() => {}}>
            {categories.map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.categoryItem}
                onPress={() => {
                  setCategory(item);
                  setShowCategoryPicker(false);
                }}
              >
                <Text style={styles.categoryText}>{item}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const Label = ({ text }: { text: string }) => (
  <Text style={styles.label}>{text}</Text>
);

const Input = ({
  placeholder,
  value,
  icon,
  onChangeText,
  keyboardType,
  editable = true,
}: {
  placeholder?: string;
  value?: string;
  icon?: string;
  onChangeText?: (t: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
}) => (
  <View style={styles.input}>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#666"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      editable={editable}
      style={styles.inputText}
    />
    {icon && <Ionicons name={icon} size={18} color="#aaa" />}
  </View>
);

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  panel: {
    width: "100%",
    maxWidth: 420,
    marginHorizontal: 16,
    backgroundColor: "rgba(28,28,28,0.95)",
    borderRadius: 28,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "600",
  },
  label: {
    color: "#aaa",
    marginBottom: 6,
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
  inputText: {
    color: "#fff",
    flex: 1,
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
  saveBtnActive: {
    backgroundColor: '#ffbf00',
    opacity: 1,
  },
  saveText: {
    color: "#aaa",
    fontSize: 16,
  },
  saveTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  categoryPanel: {
    backgroundColor: "rgba(28,28,28,0.98)",
    borderRadius: 20,
    paddingVertical: 8,
    width: "80%",
  },
  categoryItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  categoryText: {
    color: "#fff",
    fontSize: 16,
  },
});
