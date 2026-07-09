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
  ScrollView,
} from "react-native";
import StatusModal from "../../components/common/Modals/StatusModal";
import Ionicons from "react-native-vector-icons/Ionicons";
import { api } from "../../services/api";
import { parse } from "date-fns";
import { useExpenseStore } from "../../store/expenseStore";
import { vehicleService, type Vehicle } from "../../services/vehicleService";
import { queueExpenseCreate } from "../../services/offlineMutationQueue";
import { getNetworkOnlineState } from '../../services/api';
import { clearCachedValue } from '../../services/cache';

export interface ReceiptReviewerData {
  amount?: string;
  category?: string;
  description?: string;
  date?: string;
  location?: string;
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
  const [location, setLocation] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
    onClose: () => { },
  });

  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success', onClose?: () => void) => {
    setStatusModal({ visible: true, type, title, message, onClose: onClose || (() => { }) });
  };

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
      setLocation(initialData.location || "");
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
      showStatus("Invalid amount", "Please enter a valid positive amount.", "error");
      return;
    }

    let payload: any = null;
    setLoading(true);
      try {
        let parsedDate: string | undefined;
        if (date) {
          try {
            const d = parse(date, "dd-MM-yyyy", new Date());
            if (!isNaN(d.getTime())) parsedDate = d.toISOString();
          } catch (_) { }
        }

        payload = {
          amount: numAmount,
          category: category.toUpperCase(),
          vehicleId: selectedVehicleId ?? vehicleId ?? undefined,
          notes: description.trim() || undefined,
          location: location.trim() || undefined,
          date: parsedDate,
          source,
          receiptUrl: receiptUrl ?? undefined,
          mimeType: mimeType ?? undefined,
        };

      await api.post("/v1/expenses", payload);
      clearCachedValue('cache:expenses:list');
      useExpenseStore.getState().notifyCreated();

      setCategory("Fuel");
      setAmount("");
      setDescription("");
      setDate("");
      setLocation("");
      setReceiptUrl(null);
      setMimeType(null);

      onClose();
      setTimeout(() => {
        showStatus("Success", "Expense saved successfully", "success", onSuccess);
      }, 300);
    } catch (error: any) {
      console.error("ReceiptReviewer save error:", error);
      const message = String(error?.message ?? "");
      const isNetworkError =
        !getNetworkOnlineState() ||
        /network error|network request failed|failed to fetch|server unreachable/i.test(message);

      if (!isNetworkError) {
        Alert.alert(
          "Error",
          error?.error?.message ?? error?.message ?? "Failed to save expense",
        );
        return;
      }

      try {
        if (payload) {
          await queueExpenseCreate(payload as any);
        } else {
          throw new Error(message || "Failed to save expense");
        }
        onClose();
        Alert.alert("Saved offline", "Expense will sync automatically when the network returns.");
        if (onSuccess) onSuccess();
      } catch {
        Alert.alert(
          "Error",
          error?.error?.message ?? message ?? "Failed to save expense",
        );
      }
      showStatus(
        "Error",
        error?.error?.message ?? error?.message ?? "Failed to save expense",
        "error"
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
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
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

                <Label text="Location" />
                <Input
                  placeholder="Enter location"
                  value={location}
                  onChangeText={setLocation}
                  icon="location-outline"
                />

                <Label text="Date" />
                <Input
                  placeholder="dd-mm-yyyy"
                  value={date}
                  onChangeText={setDate}
                  icon="calendar-outline"
                />
              </ScrollView>

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
                    Save Review
                  </Text>
                )}
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => {
          setStatusModal(prev => ({ ...prev, visible: false }));
          statusModal.onClose();
        }}
      />

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
    backgroundColor: "#1C1C1E",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    color: "#fff",
    fontSize: 22,
    fontFamily: "Outfit-Bold",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    maxHeight: 450,
  },
  label: {
    color: "#8E8E93",
    fontSize: 13,
    fontFamily: "Outfit-Medium",
    marginBottom: 8,
    marginLeft: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  input: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 56,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputText: {
    color: "#fff",
    flex: 1,
    fontSize: 16,
    fontFamily: "Outfit-Regular",
  },
  saveBtn: {
    marginTop: 12,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2C2C2E",
    justifyContent: "center",
    alignItems: "center",
  },
  saveBtnActive: {
    backgroundColor: "#10B981",
  },
  saveText: {
    color: "#4B5563",
    fontSize: 17,
    fontFamily: "Outfit-Bold",
  },
  saveTextActive: {
    color: "#fff",
  },
  categoryPanel: {
    backgroundColor: "#1C1C1E",
    borderRadius: 24,
    paddingVertical: 12,
    width: "85%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  categoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  categoryText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Outfit-Medium",
  },
});
