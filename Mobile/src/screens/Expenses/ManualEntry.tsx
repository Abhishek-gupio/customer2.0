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
  PermissionsAndroid,
  Alert,
  ScrollView,
} from "react-native";
import StatusModal from "../../components/common/Modals/StatusModal";
import Ionicons from "react-native-vector-icons/Ionicons";
import { api, getNetworkOnlineState } from "../../services/api";
import { parse, isValid, format } from "date-fns";
import { setExpenseListNeedsRefresh, setWarrantyStatusNeedsRefresh } from "../../utils/refreshManager";
import { vehicleService, Vehicle } from "../../services/vehicleService";
import { heightPercentageToDP as hp } from "react-native-responsive-screen";
import { PART_TYPE_OPTIONS, getPartTypeLabel } from "../../constants/partTypes";
import { googleMapsService } from "../../services/googleMapsService";
import LoaderButton from "../../components/Button";
import { queueExpenseCreate } from "../../services/offlineMutationQueue";
import { clearCachedValue } from "../../services/cache";

let Geolocation: any = null;
try {
  const geoModule = require("@react-native-community/geolocation") as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}

interface ManualEntryData {
  amount?: string;
  category?: string;
  description?: string;
  date?: string;
  receiptUrl?: string;
  mimeType?: string;
  partType?: string;
  partTypes?: string[];
}

interface ManualEntryOverlayProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: ManualEntryData | null;
}

interface CreateExpenseResponse {
  success: boolean;
  data?: {
    expense?: {
      id: string;
    };
    serviceRecord?: {
      id: string;
    } | null;
    failedParts?: Array<{
      partType: string;
      reason?: string;
    }>;
    warrantySyncError?: string | null;
  };
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

const normalizeSelectedPartTypes = (partTypes: string[]): string[] => {
  const normalized = new Set<string>();

  for (const partType of partTypes) {
    const value = String(partType || "").trim().toUpperCase();
    if (!value) continue;

    if (value === "TYRES") {
      normalized.add("TYRES_FRONT");
      normalized.add("TYRES_REAR");
      continue;
    }

    normalized.add(value);
  }

  return Array.from(normalized);
};

const formatManualDate = (value: Date) => format(value, "dd-MM-yyyy");

export default function ManualEntryOverlay({ visible, onClose, onSuccess, initialData }: ManualEntryOverlayProps) {
  const [category, setCategory] = useState("Fuel");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [odometer, setOdometer] = useState("");
  const [date, setDate] = useState(formatManualDate(new Date()));
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [selectedPartTypes, setSelectedPartTypes] = useState<string[]>(["ENGINE_OIL"]);
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [placeSearch, setPlaceSearch] = useState("Fetching...");
  const [selectedPlace, setSelectedPlace] = useState<{
    placeId: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
  } | null>(null);
  const [statusModal, setStatusModal] = useState({
    visible: false,
    type: 'success' as 'success' | 'delete' | 'error',
    title: '',
    message: '',
  });

  const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
    setStatusModal({ visible: true, type, title, message });
  };

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
      fetchCurrentPlace();
    }
  }, [visible]);

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === "ios") {
      try {
          if (Geolocation?.requestAuthorization) {
          const status = await Geolocation.requestAuthorization("whenInUse");
          return (
            status === "granted" ||
            status === "authorized" ||
            status === "authorizedWhenInUse"
          );
        }
        return true;
      } catch {
        return false;
      }
    }

    try {
      const fine = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
      const coarse = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;
      const fineHas = await PermissionsAndroid.check(fine);
      const coarseHas = await PermissionsAndroid.check(coarse);
      if (fineHas || coarseHas) return true;

      const results = await PermissionsAndroid.requestMultiple([fine, coarse]);
      return (
        results[fine] === PermissionsAndroid.RESULTS.GRANTED ||
        results[coarse] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch {
      return false;
    }
  };

  const getGpsPosition = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!Geolocation) return null;

    const permitted = await requestLocationPermission();
    if (!permitted) return null;

    const getPositionOnce = (options: any) =>
      new Promise<{ latitude: number; longitude: number } | null>((resolve) => {
        Geolocation.getCurrentPosition(
          (position: any) =>
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          () => resolve(null),
          options,
        );
      });

    const highAccuracy = await getPositionOnce({
      enableHighAccuracy: true,
      timeout: 5000,
      maximumAge: 60000,
      forceRequestLocation: true,
    });
    if (highAccuracy) return highAccuracy;

    return getPositionOnce({
      enableHighAccuracy: false,
      timeout: 5000,
      maximumAge: 60000,
      forceRequestLocation: true,
    });
  };

  const fetchCurrentPlace = async () => {
    try {
      setPlaceSearch("Fetching...");
      setSelectedPlace(null);
      const gpsCoords = await getGpsPosition();
      const coords = gpsCoords ?? await googleMapsService.getCurrentLocation();
      const address = await googleMapsService.getAddress(
        coords.latitude,
        coords.longitude,
      );

      setPlaceSearch(address);
      setSelectedPlace({
        placeId: `current-${coords.latitude},${coords.longitude}`,
        name: address,
        address,
        lat: coords.latitude,
        lng: coords.longitude,
      });
    } catch (error) {
      console.log("Place detection failed:", error);
      setPlaceSearch("Location not available");
    }
  };

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
      if (initialData.partTypes?.length) {
        setSelectedPartTypes(initialData.partTypes);
      } else if (initialData.partType) {
        setSelectedPartTypes([initialData.partType]);
      }
    } else if (visible) {
      setDate(formatManualDate(new Date()));
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

  const categories = ['Fuel', 'Toll', 'Parking', 'Service', 'Repair', 'Insurance', 'Challan', 'Emi', 'Other'];
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

    let payload: any = null;
    setLoading(true);
    try {
      // Parse date from supported text formats.
      let parsedDate: string;

      if (date && date.trim().length > 0) {
        const parsed = parseManualDate(date);
        if (!parsed) {
          showStatus("Invalid date", "Enter date as dd-mm-yyyy (example: 05-03-2026).", "error");
          setLoading(false);
          return;
        }
        const now = new Date();
        parsed.setHours(
          now.getHours(),
          now.getMinutes(),
          now.getSeconds(),
          now.getMilliseconds(),
        );
        parsedDate = parsed.toISOString();
      } else {
        parsedDate = new Date().toISOString();
      }

      const isPartCategory = category.toLowerCase() === 'service' || category.toLowerCase() === 'repair' || category.toLowerCase() === 'other';
      const targetVehicleId = isPartCategory
        ? (vehicleId ?? selectedVehicleId ?? undefined)
        : (selectedVehicleId ?? vehicleId ?? undefined);
      const normalizedPartTypes = normalizeSelectedPartTypes(selectedPartTypes);

      payload = {
        amount: parseFloat(amount),
        category: category.toUpperCase(), // Backend expects uppercase
        vehicleId: targetVehicleId,
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

      if (isPartCategory && normalizedPartTypes.length > 0) {
        payload.parts = normalizedPartTypes.map((partType) => ({
          partType,
          cost: parseFloat(amount),
        }));
      }

      const response = await api.post<CreateExpenseResponse>('/v1/expenses', payload);
      clearCachedValue('cache:expenses:list');
      const responseData = response?.data;
      const serviceRecord = responseData?.serviceRecord ?? null;
      const failedParts = response?.data?.failedParts ?? [];
      const warrantySyncError = response?.data?.warrantySyncError ?? null;

      if (
        isPartCategory &&
        targetVehicleId &&
        normalizedPartTypes.length > 0 &&
        !warrantySyncError &&
        !serviceRecord
      ) {
        await api.post('/v1/expenses/warranty/service-records', {
          vehicleId: targetVehicleId,
          expenseId: responseData?.expense?.id,
          serviceType: 'REGULAR_SERVICE',
          odometerAtService: odometer ? parseFloat(odometer) : undefined,
          serviceDate: parsedDate,
          notes: description || undefined,
          parts: normalizedPartTypes.map((partType) => ({
            partType,
            cost: parseFloat(amount),
          })),
        });
      }

      // Mark expense list for refresh
      setExpenseListNeedsRefresh();
      if (isPartCategory) {
        setWarrantyStatusNeedsRefresh();
      }

      // Reset Form
      setCategory("Fuel");
      setAmount("");
      setDescription("");
      setDate(formatManualDate(new Date()));
      setOdometer("");
      setReceiptUrl(null);
      setMimeType(null);
      setSelectedPartTypes(["ENGINE_OIL"]);
      setPlaceSearch("Fetching...");
      setSelectedPlace(null);

      // Close modal first
      onClose();

      // Show success and trigger callback after modal closes
      setTimeout(() => {
        const failedPartText = failedParts.length
          ? `\n\nThese selected parts could not be updated: ${failedParts
              .map((part) => getPartTypeLabel(part.partType))
              .join(", ")}`
          : "";
        const warrantySyncText = warrantySyncError
          ? `\n\nWarranty status was not updated: ${warrantySyncError}`
          : "";
        showStatus("Success", `Expense added successfully${failedPartText}${warrantySyncText}`);
        if (onSuccess) onSuccess();
      }, 300);
    } catch (error: any) {
      console.error("Add Expense Error:", error);
      const message = String(error?.message ?? "");
      const isNetworkError =
        !getNetworkOnlineState() ||
        /network error|network request failed|failed to fetch|server unreachable/i.test(message);

      if (!isNetworkError) {
        Alert.alert("Error", message || "Failed to add expense");
        return;
      }

      try {
        if (payload) {
          await queueExpenseCreate(payload as any);
        } else {
          throw new Error(message || "Failed to add expense");
        }
        onClose();
        Alert.alert("Saved offline", "Expense will sync automatically when the network returns.");
        if (onSuccess) onSuccess();
      } catch {
        Alert.alert("Error", message || "Failed to add expense");
      }
      showStatus("Error", error?.message || "Failed to add expense", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>

      <Modal transparent visible={visible} animationType="fade">
        <Pressable style={styles.backdrop} onPress={() => { if (!loading) onClose(); }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ width: "100%", alignItems: "center" }}
          >
            <Pressable style={styles.panel} onPress={() => { }}>

              <View style={styles.header}>
                <Text style={styles.title}>Add Manual Entry</Text>
                <TouchableOpacity onPress={onClose} disabled={loading}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>

              <Label text="Vehicle" />
              <TouchableOpacity onPress={() => setShowVehiclePicker(true)} disabled={loading}>
                <Input
                  value={vehicles.find(v => v.id === selectedVehicleId)?.registrationNumber || "Select Vehicle"}
                  icon="chevron-down"
                  editable={false}
                />
              </TouchableOpacity>

              <Label text="Category" />
              <TouchableOpacity onPress={() => setShowCategoryPicker(true)} disabled={loading}>
                <Input value={category} icon="chevron-down" editable={false} />
              </TouchableOpacity>

              {(category.toLowerCase() === 'service' || category.toLowerCase() === 'repair' || category.toLowerCase() === 'other') && (
                <>
                  <Label text="Part Serviced" />
                  <TouchableOpacity onPress={() => setShowPartPicker(true)} disabled={loading}>
                    <Input
                      value={
                        selectedPartTypes.length > 0
                          ? PART_TYPE_OPTIONS
                              .filter(p => selectedPartTypes.includes(p.value))
                              .map(p => p.label)
                              .join(", ")
                          : "Select parts"
                      }
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
                editable={!loading}
              />

              <Label text="Odometer Reading (km)" />
              <Input
                placeholder="Enter current km"
                value={odometer}
                onChangeText={setOdometer}
                keyboardType="numeric"
                editable={!loading}
              />


              <Label text="Description" />
              <Input
                placeholder="Enter description"
                value={description}
                onChangeText={setDescription}
                editable={!loading}
              />

              <Label text="Place (Google Maps)" />
              <Input
                placeholder={selectedPlace ? `${selectedPlace.name}${selectedPlace.address ? " • " + selectedPlace.address : ""}` : "Search or type place"}
                value={placeSearch}
                onChangeText={text => {
                  setPlaceSearch(text);
                  setSelectedPlace(null);
                }}
                editable={!loading}
              />


              <Label text="Date" />
              <Input
                placeholder="dd-MM-yyyy"
                value={date}
                onChangeText={setDate}
                icon="calendar-outline"
                onIconPress={loading ? undefined : openDatePicker}
                editable={!loading}
              />


              <LoaderButton
                title="Save Entry"
                loading={loading}
                loadingTitle="Saving..."
                onPress={handleSave}
                disabled={!isValid}
                style={[styles.saveBtn, (isValid && !loading) ? styles.saveBtnActive : {}]}
              />
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
              {PART_TYPE_OPTIONS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={[
                    styles.categoryItem,
                    selectedPartTypes.includes(item.value) && styles.categoryItemSelected,
                  ]}
                  onPress={() => {
                    setSelectedPartTypes((prev) =>
                      prev.includes(item.value)
                        ? prev.filter((value) => value !== item.value)
                        : [...prev, item.value],
                    );
                    if (category !== 'Service' && category !== 'Other') {
                      setCategory('Service');
                    }
                  }}
                >
                  <Text style={styles.categoryText}>
                    {selectedPartTypes.includes(item.value) ? "✓ " : ""}{item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.partPickerActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setSelectedPartTypes([])}
              >
                <Text style={styles.actionBtnText}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setShowPartPicker(false)}
              >
                <Text style={styles.actionBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
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

      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
      />
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
  categoryItemSelected: {
    backgroundColor: "rgba(255,191,0,0.14)",
  },
  categoryText: {
    color: "#fff",
    fontSize: 16,
  },
  partPickerActions: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
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
