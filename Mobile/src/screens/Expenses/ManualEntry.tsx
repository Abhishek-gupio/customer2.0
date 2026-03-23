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
import Ionicons from "react-native-vector-icons/Ionicons";
import { api } from "../../services/api";
import { parse, isValid, format } from "date-fns";
import { setExpenseListNeedsRefresh, setWarrantyStatusNeedsRefresh } from "../../utils/refreshManager";
import { vehicleService, Vehicle } from "../../services/vehicleService";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";

interface ManualEntryData {
  amount?: string;
  category?: string;
  description?: string;
  date?: string;
  receiptUrl?: string;
  mimeType?: string;
  partType?: string;
}

interface ManualEntryOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: ManualEntryData | null;
}

const parseManualDate = (value: string): Date | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const formats = ["dd-MM-yyyy", "dd/MM/yyyy", "yyyy-MM-dd", "yyyy/MM/dd"];
  for (const fmt of formats) {
    const d = parse(trimmed, fmt, new Date());
    if (isValid(d)) return d;
  }

  const native = new Date(trimmed);
  if (isValid(native)) return native;

  return null;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export default function ManualEntryOverlay({ visible, onClose, onSuccess, initialData }: ManualEntryOverlayProps) {
  const [category, setCategory] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [odometer, setOdometer] = useState("");
  const [date, setDate] = useState("");
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedPartType, setSelectedPartType] = useState("ENGINE_OIL");
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [placeSearch, setPlaceSearch] = useState("");
  const [showPlaceInput, setShowPlaceInput] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<{
    placeId: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  } | null>(null);

  const fetchVehicles = async () => {
    try {
      const data = await vehicleService.getVehicles();
      setVehicles(data);
      if (data.length > 0) {
        const primary = data.find(v => v.isPrimary) || data[0];
        setSelectedVehicleId(primary.id);
        if (primary.currentOdometer) {
          setOdometer(String(primary.currentOdometer));
        }
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
        // Simple case matching or default
        const cat = initialData.category.charAt(0).toUpperCase() + initialData.category.slice(1).toLowerCase();
        setCategory(cat);
      }
      if (initialData.description) setDescription(initialData.description);
      if (initialData.date) setDate(initialData.date);
      if (initialData.receiptUrl) setReceiptUrl(initialData.receiptUrl);
      if (initialData.mimeType) setMimeType(initialData.mimeType);
      if (initialData.partType) setSelectedPartType(initialData.partType);
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
  const [loading, setLoading] = useState(false);

  const categories = ['Fuel', 'Toll', 'Parking', 'Service', 'Insurance', 'Challan', 'Emi', 'Other'];
  const partTypes = [
    { label: "Battery", value: "BATTERY" },
    { label: "Engine Oil", value: "ENGINE_OIL" },
    { label: "Oil Filter", value: "OIL_FILTER" },
    { label: "Air Filter", value: "AIR_FILTER" },
    { label: "Brake Pads", value: "BRAKE_PADS" },
    { label: "Brake Discs", value: "BRAKE_DISCS" },
    { label: "Tyres (All)", value: "TYRES" },
    { label: "Tyres (Front)", value: "TYRES_FRONT" },
    { label: "Tyres (Rear)", value: "TYRES_REAR" },
    { label: "Clutch Plate", value: "CLUTCH_PLATE" },
    { label: "Spark Plugs", value: "SPARK_PLUGS" },
    { label: "Coolant", value: "COOLANT" },
    { label: "AC Filter", value: "AC_FILTER" },
    { label: "Wiper Blades", value: "WIPER_BLADES" },
    { label: "Headlight Bulb", value: "HEADLIGHT_BULB" },
    { label: "Other Part", value: "OTHER_PART" },
  ];

  const isValid = amount.trim().length > 0;

  const openDatePicker = () => {
    const parsed = parseManualDate(date);
    const refDate = parsed || new Date();
    setCalendarMonth(new Date(refDate.getFullYear(), refDate.getMonth(), 1));
    setShowDatePicker(true);
  };

  const calendarTitle = calendarMonth.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const buildCalendarDays = React.useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (Date | null)[] = [];

    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
    while (cells.length % 7 !== 0) cells.push(null);

    return cells;
  }, [calendarMonth]);

  const handleSave = async () => {
    if (!isValid) return;

    setLoading(true);
    try {
      // Parse date from supported text formats.
      let parsedDate: string;

      if (date && date.trim().length > 0) {
        const parsed = parseManualDate(date);
        if (!parsed) {
          Alert.alert("Invalid date", "Enter date as dd-mm-yyyy (example: 05-03-2026).");
          setLoading(false);
          return;
        }
        parsedDate = parsed.toISOString();
      } else {
        parsedDate = new Date().toISOString();
      }

      const payload: any = {
        amount: parseFloat(amount),
        category: category.toUpperCase(), // Backend expects uppercase
        vehicleId: selectedVehicleId ?? vehicleId ?? undefined,
        notes: description,
        date: parsedDate,
        source: "MANUAL",
        receiptUrl: receiptUrl || undefined,
        mimeType: mimeType || undefined,
        odometerReading: odometer ? parseFloat(odometer) : undefined,
      };

      // Attach structured Google Places info if driver selected a place
      if (selectedPlace) {
        payload.placeId = selectedPlace.placeId;
        payload.placeName = selectedPlace.name;
        payload.placeAddress = selectedPlace.address;
        if (typeof selectedPlace.lat === "number") {
          payload.placeLat = selectedPlace.lat;
        }
        if (typeof selectedPlace.lng === "number") {
          payload.placeLng = selectedPlace.lng;
        }
        // Keep free-text location aligned for older analytics
        if (!payload.location && selectedPlace.address) {
          payload.location = selectedPlace.address;
        }
      }

      const isPartCategory = category.toLowerCase() === 'service' || category.toLowerCase() === 'other';
      if (isPartCategory) {
        payload.parts = [{
          partType: selectedPartType,
          cost: parseFloat(amount),
        }];
      }

      await api.post('/v1/expenses', payload);

      // Mark expense list for refresh
      setExpenseListNeedsRefresh();
      const needsWarrantyRefresh = category.toLowerCase() === 'service' || category.toLowerCase() === 'other';
      if (needsWarrantyRefresh) {
        setWarrantyStatusNeedsRefresh();
      }

      // Reset Form
      setCategory("Fuel");
      setAmount("");
      setDescription("");
      setDate("");
      setOdometer("");
      setReceiptUrl(null);
      setMimeType(null);

      // Close modal first
      onClose();

      // Show success and trigger callback after modal closes
      setTimeout(() => {
        Alert.alert("Success", "Expense added successfully");
        if (onSuccess) onSuccess();
      }, 300);
    } catch (error: any) {
      console.error("Add Expense Error:", error);
      Alert.alert("Error", error?.message || "Failed to add expense");
    } finally {
      setLoading(false);
    }
  };

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
                <Text style={styles.title}>Add Manual Entry</Text>
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

              {(category.toLowerCase() === 'service' || category.toLowerCase() === 'other') && (
                <>
                  <Label text="Part Serviced" />
                  <TouchableOpacity onPress={() => setShowPartPicker(true)}>
                    <Input
                      value={partTypes.find(p => p.value === selectedPartType)?.label || selectedPartType}
                      icon="chevron-down"
                      editable={false}
                    />
                  </TouchableOpacity>
                </>
              )}


              <Label text="Amount" />
              <Input
                placeholder="₹ 0"
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
              />

              <Label text="Odometer Reading (km)" />
              <Input
                placeholder="Enter current km"
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="numeric"
              />


              <Label text="Description" />
              <Input
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
              />

              <Label text="Place (Google Maps)" />
              <Input
                placeholder={selectedPlace ? `${selectedPlace.name}${selectedPlace.address ? " • " + selectedPlace.address : ""}` : "Search or type place"}
                value={placeSearch}
                onChangeText={text => {
                  setPlaceSearch(text);
                  setSelectedPlace(null);
                }}
              />


              <Label text="Date" />
              <Input
                placeholder="dd-MM-yyyy"
                value={date}
                onChangeText={setDate}
                icon="calendar-outline"
                onIconPress={openDatePicker}
              />


              <TouchableOpacity
                style={[styles.saveBtn, (isValid && !loading) ? styles.saveBtnActive : {}]}
                disabled={!isValid || loading}
                onPress={handleSave}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={[styles.saveText, isValid && styles.saveTextActive]}>
                    Save Entry
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

      <Modal transparent visible={showCategoryPicker} animationType="fade">
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

      <Modal transparent visible={showPartPicker} animationType="fade">
        <Pressable
          style={styles.backdrop}
          onPress={() => setShowPartPicker(false)}
        >
          <Pressable style={styles.categoryPanel} onPress={() => { }}>
            <ScrollView style={{ maxHeight: hp(50) }}>
              {partTypes.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.categoryItem}
                  onPress={() => {
                    setSelectedPartType(item.value);
                    if (category !== 'Service' && category !== 'Other') {
                      setCategory('Service');
                    }
                    setShowPartPicker(false);
                  }}
                >
                  <Text style={styles.categoryText}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal transparent visible={showDatePicker} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => setShowDatePicker(false)}>
          <Pressable style={styles.calendarPanel} onPress={() => { }}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.calendarTitle}>{calendarTitle}</Text>
              <TouchableOpacity
                onPress={() =>
                  setCalendarMonth(
                    prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
                  )
                }
              >
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.weekHeader}>
              {["S", "M", "T", "W", "T", "F", "S"].map((day, idx) => (
                <Text key={`${day}-${idx}`} style={styles.weekHeaderText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {buildCalendarDays.map((day, index) => {
                if (!day) {
                  return <View key={`empty-${index}`} style={styles.dayCell} />;
                }

                const selectedDate = parseManualDate(date);
                const isSelected = selectedDate ? sameDay(day, selectedDate) : false;

                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[styles.dayCell, isSelected && styles.dayCellSelected]}
                    onPress={() => {
                      setDate(format(day, "dd-MM-yyyy"));
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected]}>
                      {day.getDate()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.calendarActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => {
                  setDate("");
                  setShowDatePicker(false);
                }}
              >
                <Text style={styles.actionBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setShowDatePicker(false)}
              >
                <Text style={styles.actionBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
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
  onIconPress,
}: {
  placeholder?: string;
  value?: string;
  icon?: string;
  onChangeText?: (t: string) => void;
  keyboardType?: "default" | "numeric";
  editable?: boolean;
  onIconPress?: () => void;
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
    {icon && (
      <TouchableOpacity onPress={onIconPress} disabled={!onIconPress}>
        <Ionicons name={icon} size={18} color="#aaa" />
      </TouchableOpacity>
    )}
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
  calendarPanel: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "rgba(28,28,28,0.98)",
    borderRadius: 20,
    padding: 16,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  calendarTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  weekHeader: {
    flexDirection: "row",
    marginBottom: 8,
  },
  weekHeaderText: {
    width: `${100 / 7}%`,
    textAlign: "center",
    color: "#8e8e8e",
    fontWeight: "600",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: `${100 / 7}%`,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  dayCellSelected: {
    backgroundColor: "#ffbf00",
  },
  dayText: {
    color: "#fff",
    fontSize: 14,
  },
  dayTextSelected: {
    color: "#111",
    fontWeight: "700",
  },
  calendarActions: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionBtn: {
    backgroundColor: "#222",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "600",
  },
});
