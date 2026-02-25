
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  ActionSheetIOS,
  InteractionManager,
  Linking,
  Modal,
  ScrollView,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import ManualEntryOverlay from "./ManualEntry";
import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";
import ReceiptReviewer from "./ReceiptReviewer";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";
import Voice from "@react-native-voice/voice";
import DeviceInfo from "react-native-device-info";
import { useNavigation } from "@react-navigation/native";
import { api } from "../../services/api";
import { setExpenseListNeedsRefresh } from "../../utils/refreshManager";
import { getVoiceLanguageIndex, setVoiceLanguageIndex } from "../../services/storage";

// Option A: device STT → send text only (fast, no upload). User picks default language.
const VOICE_LANGUAGES: { label: string; locale: string }[] = [
  { label: "Auto (device language)", locale: "" },
  { label: "Hindi", locale: "hi-IN" },
  { label: "Tamil", locale: "ta-IN" },
  { label: "Telugu", locale: "te-IN" },
  { label: "Kannada", locale: "kn-IN" },
  { label: "Malayalam", locale: "ml-IN" },
  { label: "Bengali", locale: "bn-IN" },
  { label: "Marathi", locale: "mr-IN" },
  { label: "English (India)", locale: "en-IN" },
  { label: "English (US)", locale: "en-US" },
];

export default function AddExpenseScreen() {
  const navigation = useNavigation();
  const [showManual, setShowManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [scannedData, setScannedData] = useState<any>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [showReviewer, setShowReviewer] = useState(false);
  const [reviewSource, setReviewSource] = useState<"RECEIPT" | "VOICE">("RECEIPT");
  const [voiceLanguageIndex, setVoiceLanguageIndexState] = useState(() => getVoiceLanguageIndex());
  const [showVoiceLangPicker, setShowVoiceLangPicker] = useState(false);

  // Voice setup – only set listeners; avoid calling destroy/isAvailable if native module is null
  React.useEffect(() => {
    const initVoice = async () => {
      try {
        // Only treat as unavailable if the module is missing; we assign handlers below
        if (!Voice) {
          setVoiceAvailable(false);
          return;
        }

        Voice.onSpeechStart = () => {
          setIsRecording(true);
        };
        Voice.onSpeechEnd = () => {
          setIsRecording(false);
        };
        Voice.onSpeechResults = (results: { value?: string[] }) => {
          if (results?.value?.length) {
            const speechText = results.value[0];
            setVoiceText(speechText);
            processVoiceCommand(speechText);
          }
        };
        (Voice as any).onSpeechError = (error: any) => {
          setIsRecording(false);
          const msgStr = typeof error?.error?.message === "string" ? error.error.message : String(error?.error || "");
          console.log("Speech Error:", msgStr);
          if (msgStr.toLowerCase().includes('permission') || msgStr.includes('9/')) {
            Alert.alert('Voice Recognition Error', 'Microphone permission denied. Please enable it in settings.');
          }
        };

        // Avoid calling isAvailable() – it can touch native code that may be null.
        // We'll discover availability when user taps "Add by Voice" (start() will throw if unavailable).
        setVoiceAvailable(true);
      } catch (err) {
        console.error('Voice init error:', err);
        setVoiceAvailable(false);
      }
    };

    initVoice();

    return () => {
      if (!Voice) return;
      try {
        if (typeof Voice.destroy === 'function') {
          Voice.destroy().then(() => {
            if (typeof Voice.removeAllListeners === 'function') Voice.removeAllListeners();
          }).catch(() => { });
        } else if (typeof Voice.removeAllListeners === 'function') {
          Voice.removeAllListeners();
        }
      } catch (_) { }
    };
  }, []);

  const processVoiceCommand = async (speechText: string) => {
    setLoading(true);
    try {
      // Get extracted data only (dryRun) so we can show confirmation screen
      const response = await api.post('/v1/expenses/parse/voice/text?dryRun=true', {
        text: speechText,
      });

      const resData = response as any;
      const result = resData?.data?.data ?? resData?.data ?? resData;

      if (result?.success && result?.expense) {
        const exp = result.expense;
        // Convert date from YYYY-MM-DD to dd-MM-yyyy for ManualEntry
        let dateStr = "";
        if (exp.date) {
          const d = new Date(exp.date);
          if (!isNaN(d.getTime())) {
            const day = String(d.getDate()).padStart(2, "0");
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const year = d.getFullYear();
            dateStr = `${day}-${month}-${year}`;
          }
        }
        setScannedData({
          amount: String(exp.amount ?? ""),
          category: exp.category ?? "OTHER",
          description: [exp.merchantName, exp.notes].filter(Boolean).join(" · ") || exp.transcription || "",
          date: dateStr,
          source: "voice",
        });
        setReviewSource("VOICE");
        setShowReviewer(true);
      } else if (result?.success === false && result?.error) {
        Alert.alert(
          "Voice Processing",
          result.error?.message || "Could not parse expense from voice command.",
        );
      }
    } catch (error: any) {
      console.error("Voice processing error:", error);
      const msg =
        error?.error?.message ?? error?.message ?? "Failed to process voice command. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setLoading(false);
    }
  };

  const uploadAndParseReceipt = async (asset: { uri?: string; type?: string; fileName?: string }) => {
    if (!asset.uri) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || 'receipt.jpg',
      } as any);

      const res = await api.upload<any>('/v1/expenses/parse/receipt?dryRun=true', formData);
      const result = res?.data ?? res;

      if (result.success && result.expense) {
        let formattedDate = "";
        if (result.expense.date) {
          const d = new Date(result.expense.date);
          formattedDate = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
        }
        setScannedData({
          amount: result.expense.amount?.toString() || "",
          category: result.expense.category,
          description: result.expense.notes || result.expense.merchantName || "",
          date: formattedDate,
          receiptUrl: result.expense.receiptUrl,
          mimeType: result.expense.mimeType,
        });
        setReviewSource("RECEIPT");
        setShowReviewer(true);
      } else if (result.receiptUrl) {
        setScannedData({
          amount: "",
          category: "Other",
          description: "",
          date: "",
          receiptUrl: result.receiptUrl,
          mimeType: result.mimeType || undefined,
        });
        setReviewSource("RECEIPT");
        setShowReviewer(true);
      } else {
        Alert.alert("Scan Failed", result.error?.message || "Could not read receipt. Please try again or enter manually.");
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      const isParseFailed = msg.includes("Could not detect expense amount");
      if (isParseFailed) {
        Alert.alert(
          "Couldn't Read Amount",
          "We couldn't detect the amount from the receipt. Would you like to enter it manually?",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Enter Manually", onPress: () => { setScannedData(null); setShowReviewer(false); setShowManual(true); } },
          ]
        );
      } else {
        Alert.alert("Upload Error", msg || "Failed to upload receipt");
      }
    } finally {
      setLoading(false);
    }
  };

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== "android") return true;
    try {
      const perm = Platform.Version >= 33
        ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      const granted = await PermissionsAndroid.request(perm, {
        title: "Photo Library Permission",
        message: "App needs access to select receipt images",
        buttonNeutral: "Ask Me Later",
        buttonNegative: "Cancel",
        buttonPositive: "OK",
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  };

  const handleTakePhoto = async () => {
    if (Platform.OS === "android") {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        { title: "Camera Permission", message: "App needs camera access to scan bills", buttonPositive: "OK" }
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert("Permission needed", "Camera access is required to scan bills.");
        return;
      }
    }
    try {
      const response = await launchCamera({ mediaType: "photo", quality: 0.8 });
      if (!response.didCancel && response.assets?.[0]) {
        await uploadAndParseReceipt(response.assets[0]);
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Camera Error", error?.message || "Could not open camera.");
    }
  };

  const handlePickFromGallery = async () => {
    if (Platform.OS === "android") {
      const granted = await requestStoragePermission();
      if (!granted) {
        Alert.alert("Permission needed", "Photo library access is required to select receipts.");
        return;
      }
    }
    try {
      const response = await launchImageLibrary({ mediaType: "photo", quality: 0.8 });
      if (!response.didCancel && response.assets?.[0]) {
        await uploadAndParseReceipt(response.assets[0]);
      }
    } catch (error: any) {
      setLoading(false);
      Alert.alert("Error", error?.message || "Could not pick image.");
    }
  };

  const showScanBillsPicker = () => {
    const run = (fn: () => void) => {
      InteractionManager.runAfterInteractions(() => setTimeout(fn, 100));
    };
    if (Platform.OS === "ios" && ActionSheetIOS) {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ["Take Photo", "Upload from Gallery", "Cancel"], cancelButtonIndex: 2 },
        (i) => { if (i === 0) run(handleTakePhoto); else if (i === 1) run(handlePickFromGallery); }
      );
    } else {
      Alert.alert(
        "Scan Receipt",
        "Use a receipt or bill (e.g. fuel slip, service bill). Choose source:",
        [
          { text: "Take Photo", onPress: () => run(handleTakePhoto) },
          { text: "Upload from Gallery", onPress: () => run(handlePickFromGallery) },
          { text: "Cancel", style: "cancel" },
        ]
      );
    }
  };

  const startVoiceRecording = async () => {
    if (!voiceAvailable) {
      Alert.alert("Voice Not Available", "Please use manual entry or scan bills instead.");
      return;
    }
    try {
      if (Platform.OS === "android") {
        const hasPermission = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
        if (!hasPermission) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            { title: "Microphone", message: "Needed for voice expense.", buttonPositive: "OK" }
          );
          if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
            Alert.alert("Permission", "Enable microphone in settings.", [
              { text: "Cancel", style: "cancel" },
              { text: "Settings", onPress: () => Linking.openSettings() },
            ]);
            return;
          }
        }
      }

      if (!Voice || typeof Voice.start !== "function") {
        setVoiceAvailable(false);
        Alert.alert("Voice Not Available", "Use manual entry or scan bills.");
        return;
      }
      try {
        if (typeof Voice.stop === "function") await Voice.stop();
      } catch (_) { }
      setVoiceText("");

      // Use saved default language (or Auto = device locale)
      let locale = "en-US";
      if (voiceLanguageIndex > 0 && VOICE_LANGUAGES[voiceLanguageIndex]?.locale) {
        locale = VOICE_LANGUAGES[voiceLanguageIndex].locale;
      } else {
        try {
          const deviceLocale = (DeviceInfo as any).getDeviceLocale?.();
          if (deviceLocale && typeof deviceLocale === "string") locale = deviceLocale.replace("_", "-");
        } catch (_) { }
      }

      try {
        await Voice.start(locale);
      } catch (nativeErr: any) {
        if (locale !== "en-US") {
          try {
            await Voice.start("en-US");
          } catch (_) {
            throw nativeErr;
          }
        } else throw nativeErr;
      }
      setIsRecording(true);
      Alert.alert(
        "Voice",
        `Speak your expense in ${VOICE_LANGUAGES[voiceLanguageIndex]?.label ?? "your language"} (amount, category, date).`,
        [{ text: "Stop", onPress: stopVoiceRecording }]
      );
    } catch (e: any) {
      setIsRecording(false);
      setVoiceAvailable(false);
      Alert.alert("Voice Error", e?.message ?? "Try again or use manual entry.");
    }
  };

  const stopVoiceRecording = async () => {
    setIsRecording(false);
    if (Voice && typeof Voice.stop === "function") {
      try {
        await Voice.stop();
      } catch (_) { }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => navigation.goBack()}
        />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>Add Expense</Text>
            {loading && <ActivityIndicator color="#fff" style={{ marginRight: 10 }} />}
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Ionicons name="close" size={25} color="#fff" />
            </TouchableOpacity>
          </View>

          <ActionCard
            icon="camera-outline"
            label={loading ? "Scanning..." : "Scan Receipt"}
            onPress={loading ? () => { } : showScanBillsPicker}
          />

          <ActionCard
            icon={isRecording ? "mic" : voiceAvailable ? "mic-outline" : "mic-off-outline"}
            label={
              isRecording ? "Recording... Tap Stop" : voiceAvailable ? "Add by Voice" : "Voice Unavailable"
            }
            onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
            disabled={!voiceAvailable}
          />
          <TouchableOpacity
            style={styles.voiceLangRow}
            onPress={() => setShowVoiceLangPicker(true)}
            disabled={!voiceAvailable}
          >
            <Text style={styles.voiceLangLabel}>Default language: </Text>
            <Text style={styles.voiceLangValue}>
              {VOICE_LANGUAGES[voiceLanguageIndex]?.label ?? "Auto"} ▼
            </Text>
          </TouchableOpacity>

          <ActionCard
            icon="create-outline"
            label="Enter Manually"
            onPress={() => {
              setScannedData(null);
              setShowManual(true);
            }}
          />
        </View>
      </View>

      <ManualEntryOverlay
        visible={showManual}
        initialData={null}
        onClose={() => {
          setShowManual(false);
        }}
        onSuccess={() => {
          setExpenseListNeedsRefresh();
          setShowManual(false);
          navigation.goBack();
        }}
      />

      <ReceiptReviewer
        visible={showReviewer}
        source={reviewSource}
        initialData={scannedData}
        onClose={() => {
          setShowReviewer(false);
          setScannedData(null);
        }}
        onSuccess={() => {
          setExpenseListNeedsRefresh();
          setShowReviewer(false);
          setScannedData(null);
          navigation.goBack();
        }}
      />

      <Modal
        visible={showVoiceLangPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVoiceLangPicker(false)}
      >
        <Pressable style={styles.langPickerBackdrop} onPress={() => setShowVoiceLangPicker(false)}>
          <Pressable style={styles.langPickerPanel} onPress={() => { }}>
            <Text style={styles.langPickerTitle}>Set default voice language</Text>
            <ScrollView style={styles.langPickerList} keyboardShouldPersistTaps="handled">
              {VOICE_LANGUAGES.map((item, index) => (
                <TouchableOpacity
                  key={item.locale || "auto"}
                  style={[styles.langPickerOption, index === voiceLanguageIndex && styles.langPickerOptionSelected]}
                  onPress={() => {
                    setVoiceLanguageIndex(index);
                    setVoiceLanguageIndexState(index);
                    setShowVoiceLangPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.langPickerOptionText,
                      index === voiceLanguageIndex && styles.langPickerOptionTextSelected,
                    ]}
                  >
                    {item.label}
                  </Text>
                  {index === voiceLanguageIndex && (
                    <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.langPickerClose} onPress={() => setShowVoiceLangPicker(false)}>
              <Text style={styles.langPickerCloseText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function ActionCard({
  icon,
  label,
  onPress,
  disabled = false
}: {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.card, disabled && styles.cardDisabled]}
      activeOpacity={disabled ? 1 : 0.85}
      onPress={disabled ? undefined : onPress}
    >
      <View style={[styles.iconCircle, disabled && styles.iconCircleDisabled]}>
        <Ionicons name={icon} size={26} color={disabled ? "#999" : "#fff"} />
      </View>
      <Text style={[styles.cardText, disabled && styles.cardTextDisabled]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end', // Align panel to bottom or center? The original was centered.
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    backgroundColor: "rgba(0,0,0,0.8)", // Darker backdrop
    justifyContent: "center",
    paddingHorizontal: wp(5),
  },

  panel: {
    borderRadius: wp(7),
    padding: wp(5),
    backgroundColor: "rgba(28,28,28,0.95)",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: hp(2),
  },

  title: {
    color: "#fff",
    fontSize: hp(2.3),
    fontWeight: "600",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: wp(6),
    paddingVertical: hp(3),
    alignItems: "center",
    marginBottom: hp(2),
  },

  iconCircle: {
    width: wp(16),
    height: wp(16),
    borderRadius: wp(8),
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: hp(1),
  },

  cardText: {
    color: "#fff",
    fontSize: hp(1.9),
    fontWeight: "500",
  },
  cardDisabled: {
    backgroundColor: "rgba(255,255,255,0.03)",
    opacity: 0.6,
  },
  iconCircleDisabled: {
    borderColor: "rgba(255,255,255,0.2)",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  cardTextDisabled: {
    color: "#999",
  },
  voiceLangRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    paddingVertical: 8,
  },
  voiceLangLabel: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
  },
  voiceLangValue: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  langPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    padding: 24,
  },
  langPickerPanel: {
    backgroundColor: "rgba(28,28,28,0.98)",
    borderRadius: 16,
    padding: 16,
    maxHeight: "70%",
  },
  langPickerTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  langPickerList: {
    maxHeight: 320,
  },
  langPickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  langPickerOptionSelected: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  langPickerOptionText: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
  },
  langPickerOptionTextSelected: {
    color: "#fff",
    fontWeight: "500",
  },
  langPickerClose: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  langPickerCloseText: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "600",
  },
});
