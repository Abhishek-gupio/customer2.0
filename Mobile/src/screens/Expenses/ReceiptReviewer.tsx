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
  Alert,
  ActivityIndicator,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { api } from "../../services/api";
import { parse } from "date-fns";
import { setExpenseListNeedsRefresh } from "../../utils/refreshManager";
import { vehicleService, type Vehicle } from "../../services/vehicleService";

export interface ReceiptReviewerData {
  amount?: string;
  category?: string;
  description?: string;
  date?: string;
  receiptUrl?: string;
  mimeType?: string;
}

interface ReceiptReviewerProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: ReceiptReviewerData | null;
  /** Save expense with this source: RECEIPT (scan) or VOICE */
  source: "RECEIPT" | "VOICE";
}

export default function ReceiptReviewer({
  visible,
  onClose,
  onSuccess,
  initialData,
  source,
}: ReceiptReviewerProps) {
  const [category, setCategory] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchVehicles = async () => {
    try {
      const data = await vehicleService.getVehicles();
      setVehicles(data);
      if (data.length > 0) {
        const primary = data.find(v => v.isPrimary) || data[0];
        setSelectedVehicleId(primary.id);
      }
    } catch (err) {
      console.error("Failed to fetch vehicles:", err);
    }
  };

  React.useEffect(() => {
    if (visible) {
      fetchVehicles();
    }
  }, [visible]);

  React.useEffect(() => {
    if (visible && initialData) {
      if (initialData.amount) setAmount(initialData.amount);
      if (initialData.category) {
        const cat =
          initialData.category.charAt(0).toUpperCase() +
          initialData.category.slice(1).toLowerCase();
        setCategory(cat);
      }
      if (initialData.description) setDescription(initialData.description);
      if (initialData.date) setDate(initialData.date);
      if (initialData.receiptUrl) setReceiptUrl(initialData.receiptUrl);
      if (initialData.mimeType) setMimeType(initialData.mimeType);
    }
  }, [visible, initialData]);

  React.useEffect(() => {
    if (!visible) return;
    let mounted = true;
    (async () => {
      try {
        const res = await vehicleService.getVehicles();
        const list = Array.isArray(res) ? res : Array.isArray((res as any)?.data) ? (res as any).data : [];
        const primary = list.find((v: any) => v?.isPrimary) || list[0];
        const primaryId = primary?.id ?? null;
        if (mounted) {
          setVehicleId(primaryId);
          setSelectedVehicleId(primaryId);
        }
      } catch {
        if (mounted) {
          setVehicleId(null);
          setSelectedVehicleId(null);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [visible]);

  const categories = [
    "Fuel",
    "Toll",
    "Parking",
    "Service",
    "Repair",
    "Insurance",
    "Challan",
    "Emi",
    "Other",
  ];
  const numAmount = parseFloat(String(amount).replace(/,/g, ""));
  const isValid = amount.trim().length > 0 && !isNaN(numAmount) && numAmount > 0;

  const handleSave = async () => {
    if (!isValid) {
      Alert.alert("Invalid amount", "Please enter a valid positive amount.");
      return;
    }

    setLoading(true);
    try {
      let parsedDate: string | undefined;
      if (date) {
        try {
          const d = parse(date, "dd-MM-yyyy", new Date());
          if (!isNaN(d.getTime())) parsedDate = d.toISOString();
        } catch (_) { }
      }

      const payload = {
        amount: numAmount,
        category: category.toUpperCase(),
        vehicleId: selectedVehicleId ?? vehicleId ?? undefined,
        notes: description.trim() || undefined,
        date: parsedDate,
        source,
        receiptUrl: receiptUrl ?? undefined,
        mimeType: mimeType ?? undefined,
      };

      await api.post("/v1/expenses", payload);
      setExpenseListNeedsRefresh();

      setCategory("Fuel");
      setAmount("");
      setDescription("");
      setDate("");
      setReceiptUrl(null);
      setMimeType(null);

      onClose();
      setTimeout(() => {
        Alert.alert("Success", "Expense saved successfully");
        if (onSuccess) onSuccess();
      }, 300);
    } catch (error: any) {
      console.error("ReceiptReviewer save error:", error);
      Alert.alert(
        "Error",
        error?.error?.message ?? error?.message ?? "Failed to save expense",
      );
    } finally {
      setLoading(false);
    }
  };

  const title =
    source === "VOICE" ? "Review voice expense" : "Review receipt";

  return (
    <>
      <Modal transparent visible={visible} animationType="fade">
        <Pressable style={styles.backdrop} onPress={onClose}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.panel} onPress={() => { }}>
              <View style={styles.header}>
                <Text style={styles.title}>{title}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <Label text="Vehicle" />
              <TouchableOpacity onPress={() => setShowVehiclePicker(true)}>
                <Input
                  value={vehicles.find(v => v.id === selectedVehicleId)?.registrationNumber || "Select Vehicle"}
                  icon="chevron-down"
                  editable={false}
                />
              </TouchableOpacity>

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
                style={[
                  styles.saveBtn,
                  isValid && !loading ? styles.saveBtnActive : {},
                ]}
                disabled={!isValid || loading}
                onPress={handleSave}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text
                    style={[styles.saveText, isValid && styles.saveTextActive]}
                  >
                    Save
                  </Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <Modal transparent visible={showVehiclePicker} animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowVehiclePicker(false)}
        >
          <Pressable style={styles.categoryPanel} onPress={() => { }}>
            {vehicles.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.categoryItem}
                onPress={() => {
                  setSelectedVehicleId(item.id);
                  setShowVehiclePicker(false);
                }}
              >
                <Text style={styles.categoryText}>{item.registrationNumber} {item.isPrimary ? "(Primary)" : ""}</Text>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        transparent
        visible={showCategoryPicker}
        animationType="fade"
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowCategoryPicker(false)}
        >
          <Pressable style={styles.categoryPanel} onPress={() => { }}>
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
    {icon && <Ionicons name={icon as any} size={18} color="#aaa" />}
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
    backgroundColor: "#4CAF50",
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
