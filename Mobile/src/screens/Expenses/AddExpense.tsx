import React, { useState, useContext, useEffect, useRef } from "react";
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
import StatusModal from "../../components/common/Modals/StatusModal";
import ManualEntryOverlay from "./ManualEntry";
import ReceiptReviewer from "./ReceiptReviewer";
import { launchCamera, launchImageLibrary } from "react-native-image-picker";


import {
  widthPercentageToDP as wp,
  heightPercentageToDP as hp,
} from "react-native-responsive-screen";


import Voice from "@react-native-voice/voice";
import DeviceInfo from "react-native-device-info";
import { useNavigation } from "../../lib/react-navigation-native";
import { api } from "../../services/api";
import { checkImageQuality } from "../../services/documentService";
import { googleMapsService } from "../../services/googleMapsService";
import { useExpenseStore } from "../../store/expenseStore";
import { getVoiceLanguageIndex, setVoiceLanguageIndex } from "../../services/storage";
import { VoiceOwnerContext } from "../../context/VoiceOwnerContext";

type ReceiptAsset = { uri?: string; type?: string; fileName?: string };

let Geolocation: any = null;
try {
  const geoModule = require("@react-native-community/geolocation") as any;
  Geolocation = geoModule?.default ?? geoModule;
} catch {
  Geolocation = null;
}

const SUPPORTED_RECEIPT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function inferMimeTypeFromName(nameOrUri?: string) {
  const value = (nameOrUri || "").toLowerCase();
  if (value.endsWith(".png")) return "image/png";
  if (value.endsWith(".webp")) return "image/webp";
  if (value.endsWith(".jpg") || value.endsWith(".jpeg")) return "image/jpeg";
  if (value.endsWith(".heic")) return "image/heic";
  if (value.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function normalizeReceiptAsset(asset: ReceiptAsset) {
  const uri = asset.uri || "";
  const rawType = (asset.type || "").toLowerCase();
  const inferredType = inferMimeTypeFromName(asset.fileName || uri);
  const detectedType =
    !rawType || rawType === "application/octet-stream" || rawType === "image/*"
      ? inferredType
      : rawType === "image/jpg"
        ? "image/jpeg"
        : rawType;
  const isUnsupportedAppleFormat = detectedType === "image/heic" || detectedType === "image/heif";
  const type = isUnsupportedAppleFormat ? detectedType : detectedType || "image/jpeg";
  const extension =
    type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const fileName =
    asset.fileName && /\.[a-z0-9]+$/i.test(asset.fileName)
      ? asset.fileName
      : `receipt_${Date.now()}.${extension}`;

  return { uri, type, fileName, detectedType };
}

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
  const { voiceOwner, setVoiceOwner } = useContext(VoiceOwnerContext);
  const [showManual, setShowManual] = useState(false);
  const [manualInitialData, setManualInitialData] = useState<any>(null);
  const [showScanOptions, setShowScanOptions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [scannedData, setScannedData] = useState<any>(null);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [showReviewer, setShowReviewer] = useState(false);
  const [reviewSource, setReviewSource] = useState<"RECEIPT" | "VOICE">("RECEIPT");
  const [voiceLanguageIndex, setVoiceLanguageIndexState] = useState(() => getVoiceLanguageIndex());
  const [showVoiceLangPicker, setShowVoiceLangPicker] = useState(false);
  const voiceStartInFlightRef = useRef(false);
  const voiceResultHandledRef = useRef(false);
  const voiceCleanupRef = useRef(false);
  const voiceBusyRetryRef = useRef(0);
  const voicePartialTextRef = useRef("");
  const voiceEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentLocationRef = useRef("");
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

  const clearVoiceEndTimeout = () => {
    if (voiceEndTimeoutRef.current) {
      clearTimeout(voiceEndTimeoutRef.current);
      voiceEndTimeoutRef.current = null;
    }
  };

  const releaseVoiceSession = async () => {
    clearVoiceEndTimeout();
    voiceStartInFlightRef.current = false;
    voiceCleanupRef.current = true;
    setIsRecording(false);
    try {
      if (typeof (Voice as any)?.stop === "function") {
        await (Voice as any).stop().catch(() => {});
      }
      if (typeof (Voice as any)?.cancel === "function") {
        await (Voice as any).cancel().catch(() => {});
      }
    } catch (_) {}
    setVoiceOwner(null);
    setTimeout(() => {
      voiceCleanupRef.current = false;
    }, 350);
  };

  const getPreferredVoiceLocales = () => {
    const locales: string[] = [];
    const preferredLocale =
      voiceLanguageIndex > 0 && VOICE_LANGUAGES[voiceLanguageIndex]?.locale
        ? VOICE_LANGUAGES[voiceLanguageIndex].locale
        : "";
    if (preferredLocale) locales.push(preferredLocale);
    try {
      const deviceLocale = (DeviceInfo as any).getDeviceLocale?.();
      if (deviceLocale && typeof deviceLocale === "string") {
        locales.push(deviceLocale.replace("_", "-"));
      }
    } catch (_) {}
    locales.push("en-IN", "en-US");
    return [...new Set(locales.filter(Boolean))];
  };

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

  const getCurrentLocationLabel = async () => {
    if (currentLocationRef.current) return currentLocationRef.current;

    try {
      const gpsCoords = await getGpsPosition();
      const coords = gpsCoords ?? await googleMapsService.getCurrentLocation();
      const address = await googleMapsService.getAddress(coords.latitude, coords.longitude);
      currentLocationRef.current = address;
      return address;
    } catch {
      return "";
    }
  };

  const handleCapturedSpeech = (speechText: string) => {
    const normalizedText = speechText.trim();
    if (!normalizedText || voiceResultHandledRef.current) return;
    voiceResultHandledRef.current = true;
    clearVoiceEndTimeout();
    voicePartialTextRef.current = normalizedText;
    setVoiceText(normalizedText);
    setIsRecording(false);
    setVoiceOwner(null);
    void processVoiceCommand(normalizedText);
    void releaseVoiceSession();
  };

  // Voice: only check availability on mount. Handlers are set when user taps "Add by Voice" so Hey Gupio can keep the mic until then.
  useEffect(() => {
    if (!Voice) setVoiceAvailable(false);
    else setVoiceAvailable(true);
    void getCurrentLocationLabel();
    return () => {
      // Release mic when leaving screen so Hey Gupio can listen again (do not destroy – shared with Hey Gupio)
      clearVoiceEndTimeout();
      try {
        if (typeof (Voice as any)?.stop === "function") (Voice as any).stop();
        if (typeof (Voice as any)?.cancel === "function") (Voice as any).cancel();
      } catch (_) {}
      voiceStartInFlightRef.current = false;
      setVoiceOwner(null);
    };
  }, [setVoiceOwner]);

  const processVoiceCommand = async (speechText: string) => {
    const trimmed = (speechText || "").trim();
    if (trimmed.length < 2) {
      showStatus(
        "No speech detected",
        "Please speak clearly with amount and category (e.g. 500 rupees fuel today).",
        "error"
      );
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/v1/expenses/parse/voice/text?dryRun=true', {
        text: trimmed,
      });

      const resData = response as any;
      const result = resData?.data ?? resData;
      const expense = result?.expense ?? result?.data?.expense;
      let parsedLocation =
        [
          expense?.location,
          expense?.address,
          expense?.merchantAddress,
          expense?.storeAddress,
          expense?.vendorAddress,
          expense?.place,
          expense?.placeAddress,
        ].find((value) => typeof value === "string" && value.trim().length > 0) || "";
      if (!parsedLocation) {
        parsedLocation = await getCurrentLocationLabel();
      }

      if (expense && (typeof expense.amount === "number" ? expense.amount > 0 : Number(expense.amount) > 0)) {
        const exp = expense;
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
          description: [exp.merchantName, exp.notes].filter(Boolean).join(" · ") || exp.transcription || trimmed,
          date: dateStr,
          location: parsedLocation,
          source: "voice",
        });
        setReviewSource("VOICE");
        setShowReviewer(true);
      } else if (result?.error?.message || result?.error) {
        showStatus(
          "Voice Processing",
          result.error?.message || result.error || "Could not parse expense from voice command.",
          "error"
        );
      } else if (!expense) {
        showStatus(
          "Couldn't understand",
          "Say amount and category clearly (e.g. 500 rupees fuel today). Or use manual entry.",
          "error"
        );
      }
    } catch (error: any) {
      console.error("Voice processing error:", error);
      const msg =
        error?.error?.message ?? error?.message ?? "Failed to process voice command. Please try again.";
      const isAiNotConfigured = /AI not configured|not configured/i.test(String(msg));
      const isNoAmount =
        /could not detect expense amount/i.test(String(msg)) ||
        /say the amount clearly/i.test(String(msg));

      if (isAiNotConfigured || isNoAmount) {
        showStatus(
          "Voice Not Available",
          isAiNotConfigured
            ? "Voice parsing is not set up on the server. We’ll open manual entry with your spoken text."
            : "We couldn't detect the amount from your voice. We'll open manual entry with your spoken text.",
          "error",
          () => {
            setManualInitialData({ description: trimmed });
            setShowManual(true);
          }
        );
      } else {
        showStatus("Error", msg, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadAndParseReceipt = async (asset: ReceiptAsset) => {
    const normalizedAsset = normalizeReceiptAsset(asset);
    if (!normalizedAsset.uri) return;
    if (normalizedAsset.detectedType === "image/heic" || normalizedAsset.detectedType === "image/heif") {
      showStatus(
        "Unsupported format",
        "This receipt photo is in HEIC format. Please retake it as JPG/PNG or choose a compatible image from gallery.",
        "error"
      );
      return;
    }
    if (!SUPPORTED_RECEIPT_MIME_TYPES.has(normalizedAsset.type)) {
      showStatus(
        "Unsupported format",
        "Please use a JPG, PNG, or WebP image for receipt scanning.",
        "error"
      );
      return;
    }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: normalizedAsset.uri,
        type: normalizedAsset.type,
        name: normalizedAsset.fileName,
      } as any);

      const res = await api.upload<any>('/v1/expenses/parse/receipt?dryRun=true', formData);
      const result = res?.data ?? res;

      if (result.success && result.expense) {
        const parsedLocation =
          [
            result.expense.location,
            result.expense.address,
            result.expense.merchantAddress,
            result.expense.storeAddress,
            result.expense.vendorAddress,
            result.expense.place,
          ].find((value) => typeof value === "string" && value.trim().length > 0) || "";
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
          location: parsedLocation,
          receiptUrl: result.expense.receiptUrl,
          mimeType: result.expense.mimeType,
        });
        setReviewSource("RECEIPT");
        setShowReviewer(true);
      } else if (result.receiptUrl) {
        const parsedLocation =
          [
            result.location,
            result.address,
            result.merchantAddress,
            result.storeAddress,
            result.vendorAddress,
            result.place,
          ].find((value) => typeof value === "string" && value.trim().length > 0) || "";
        setScannedData({
          amount: "",
          category: "Other",
          description: "",
          date: "",
          location: parsedLocation,
          receiptUrl: result.receiptUrl,
          mimeType: result.mimeType || undefined,
        });
        setReviewSource("RECEIPT");
        setShowReviewer(true);
      } else {
        showStatus("Scan Failed", result.error?.message || "Could not read receipt. Please try again or enter manually.", "error");
      }
    } catch (e: any) {
      const msg = String(e?.message ?? "").trim();
      const isParseFailed = msg.includes("Could not detect expense amount");
      const isReceiptMismatch =
        /does not look like a receipt|please scan a receipt or bill/i.test(msg);
      const isAiNotConfigured = /ai not configured|gemini|not configured/i.test(msg);
      const isTooLarge = /request entity too large|payload too large|file too large|413/i.test(msg);
      if (isParseFailed) {
        showStatus(
          "Couldn't Read Amount",
          "We couldn't detect the amount from the receipt. We'll open manual entry for you.",
          "error",
          () => { setScannedData(null); setShowReviewer(false); setShowManual(true); }
        );
      } else if (isReceiptMismatch) {
        showStatus("Not a receipt", "Please upload a clear receipt or bill photo.", "error");
      } else if (isAiNotConfigured) {
        showStatus("扫描不可用", "Receipt scanning is not configured on the server right now.", "error");
      } else if (isTooLarge) {
        showStatus("Receipt too large", "Please retake the receipt a bit closer or use a smaller JPG/PNG image.", "error");
      } else {
        showStatus("Scan Error", msg || "Could not scan this receipt.", "error");
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
        showStatus("Permission needed", "Camera access is required to scan bills.", "error");
        return;
      }
    }
    try {
      const response = await (launchCamera as any)({
        mediaType: "photo",
        quality: 0.7,
        maxWidth: 1800,
        maxHeight: 1800,
        selectionLimit: 1,
        assetRepresentationMode: "compatible",
      });
      if (response.errorCode) {
        showStatus("Camera Error", response.errorMessage || "Could not capture image.", "error");
        return;
      }
      if (!response.didCancel && response.assets?.[0]) {
        const asset = normalizeReceiptAsset(response.assets[0]);
        setLoading(true);
        const result = await checkImageQuality(asset.uri, asset.fileName, asset.type || "image/jpeg");
        if (result.ok) {
          uploadAndParseReceipt(asset);
        } else {
          setLoading(false);
          showStatus(
            "Image quality",
            result.hints.join("\n\n") + "\n\nYou can retake or use this image anyway.",
            "error",
            () => uploadAndParseReceipt(asset)
          );
        }
      }
    } catch (error: any) {
      setLoading(false);
      showStatus("Camera Error", error?.message || "Could not open camera.", "error");
    }
  };

  const handlePickFromGallery = async () => {
    if (Platform.OS === "android") {
      const granted = await requestStoragePermission();
      if (!granted) {
        showStatus("Permission needed", "Photo library access is required to select receipts.", "error");
        return;
      }
    }
    try {
      const response = await (launchImageLibrary as any)({
        mediaType: "photo",
        quality: 0.7,
        maxWidth: 1800,
        maxHeight: 1800,
        selectionLimit: 1,
        assetRepresentationMode: "compatible",
      });
      if (response.errorCode) {
        showStatus("Error", response.errorMessage || "Could not pick image.", "error");
        return;
      }
      if (!response.didCancel && response.assets?.[0]) {
        const asset = normalizeReceiptAsset(response.assets[0]);
        setLoading(true);
        const result = await checkImageQuality(asset.uri, asset.fileName, asset.type || "image/jpeg");
        if (result.ok) {
          uploadAndParseReceipt(asset);
        } else {
          setLoading(false);
          showStatus(
            "Image quality",
            result.hints.join("\n\n") + "\n\nYou can pick another or use this image anyway.",
            "error",
            () => uploadAndParseReceipt(asset)
          );
        }
      }
    } catch (error: any) {
      setLoading(false);
      showStatus("Error", error?.message || "Could not pick image.", "error");
    }
  };

  const showScanBillsPicker = () => {
    setShowScanOptions(true);
  };

  const startVoiceRecording = async () => {
    if (!voiceAvailable) {
      showStatus("Voice Not Available", "Please use manual entry or scan bills instead.", "error");
      return;
    }
    if (voiceStartInFlightRef.current) return;
    if (voiceOwner && voiceOwner !== "addExpense" && voiceOwner !== "heyGupio") {
      showStatus("Mic In Use", "Another feature is using the microphone right now.", "error");
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
            showStatus("Permission", "Enable microphone in settings.", "error", () => Linking.openSettings());
            return;
          }
        }
      }

      if (!Voice || typeof Voice.start !== "function") {
        setVoiceAvailable(false);
        showStatus("Voice Not Available", "Use manual entry or scan bills.", "error");
        return;
      }
      voiceStartInFlightRef.current = true;
      voiceResultHandledRef.current = false;
      voiceCleanupRef.current = false;
      voiceBusyRetryRef.current = 0;
      voicePartialTextRef.current = "";
      clearVoiceEndTimeout();
      // Claim mic so Hey Gupio stops listening, then stop any current session
      setVoiceOwner("addExpense");
      await new Promise((resolve) => setTimeout(resolve, 250));
      try {
        await (Voice as any).cancel?.().catch(() => {});
        if (typeof Voice.stop === "function") await Voice.stop();
        await (Voice as any).destroy?.().catch(() => {});
        (Voice as any).removeAllListeners?.();
      } catch (_) {}
      setVoiceText("");

      // Set our handlers only while we own the mic.
      Voice.onSpeechStart = () => {
        clearVoiceEndTimeout();
        voiceStartInFlightRef.current = false;
        voiceCleanupRef.current = false;
        voiceBusyRetryRef.current = 0;
        setIsRecording(true);
      };
      (Voice as any).onSpeechPartialResults = (results: { value?: string[] }) => {
        const partialText = results?.value?.find((item) => item?.trim())?.trim();
        if (!partialText || voiceResultHandledRef.current) return;
        if (partialText.length >= voicePartialTextRef.current.length) {
          voicePartialTextRef.current = partialText;
          setVoiceText(partialText);
        }
      };
      Voice.onSpeechEnd = () => {
        setIsRecording(false);
        clearVoiceEndTimeout();
        voiceEndTimeoutRef.current = setTimeout(() => {
          if (voiceResultHandledRef.current) return;
          const fallbackText = voicePartialTextRef.current.trim();
          if (fallbackText.length >= 2) {
            handleCapturedSpeech(fallbackText);
            return;
          }
          void releaseVoiceSession();
          showStatus(
            "Couldn't hear you",
            "We didn't catch any speech. Try again closer to the mic.",
            "error"
          );
        }, 900);
      };
      Voice.onSpeechResults = (results: { value?: string[] }) => {
        const speechText = results?.value?.find((item) => item?.trim())?.trim();
        if (speechText) handleCapturedSpeech(speechText);
      };
      (Voice as any).onSpeechError = (error: any) => {
        clearVoiceEndTimeout();
        voiceStartInFlightRef.current = false;
        const rawMsg =
          typeof error?.error?.message === "string"
            ? error.error.message
            : typeof error?.message === "string"
            ? error.message
            : String(error?.error || error || "");
        const msg = rawMsg.toLowerCase();
        const code = Number(error?.error?.code ?? error?.code);
        console.log("Speech Error:", rawMsg);
        const isExpectedCleanupError =
          voiceCleanupRef.current || voiceResultHandledRef.current;
        if (
          isExpectedCleanupError &&
          (msg.includes("cancel") || msg.includes("stopped") || msg.includes("busy") || code === 5 || code === 8)
        ) {
          return;
        }

        const fallbackText = voicePartialTextRef.current.trim();
        if (
          !voiceResultHandledRef.current &&
          fallbackText.length >= 2 &&
          (msg.includes("no match") || msg.includes("timeout") || msg.includes("didn't understand") || code === 6 || code === 7)
        ) {
          handleCapturedSpeech(fallbackText);
          return;
        }

        // Common benign cases: no speech / user canceled / no match / low confidence
        if (
          msg.includes("no speech") ||
          msg.includes("no match") ||
          msg.includes("timeout") ||
          msg.includes("cancel") ||
          msg.includes("didn't understand") ||
          msg.startsWith("7/") || // 7/No match on some devices
          msg.startsWith("11/") // 11/Didn't understand, please try again.
        ) {
          void releaseVoiceSession();
          showStatus(
            "Couldn’t hear you",
            "We didn’t catch any speech. Try again closer to the mic.",
            "error"
          );
          return;
        }

        // Permission / privacy
        if (msg.includes("permission") || msg.includes("denied") || msg.includes("record audio")) {
          void releaseVoiceSession();
          showStatus(
            "Microphone blocked",
            "Microphone permission is off. Please enable it in system settings.",
            "error"
          );
          return;
        }

        if (msg.includes("busy")) {
          if (voiceBusyRetryRef.current < 1) {
            voiceBusyRetryRef.current += 1;
            setTimeout(() => {
              startVoiceRecording().catch(() => {});
            }, 450);
            return;
          }
          void releaseVoiceSession();
          showStatus("Microphone busy", "Please wait a moment and try again.", "error");
          return;
        }

        // Recognizer / engine not present on device
        if (msg.includes("recognizer not present") || msg.includes("service not available") || msg.includes("not available")) {
          void releaseVoiceSession();
          showStatus(
            "Voice not available",
            "This device doesn’t have a working speech recognizer.",
            "error"
          );
          return;
        }

        // Fallback: generic error
        void releaseVoiceSession();
        showStatus(
          "Voice Error",
          rawMsg || "There was a problem with voice recognition.",
          "error"
        );
      };

      let started = false;
      for (const locale of getPreferredVoiceLocales()) {
        try {
          await Voice.start(locale);
          started = true;
          break;
        } catch (_) {
          continue;
        }
      }
      if (!started) throw new Error("Voice recognition failed to start.");
      setIsRecording(true);
    } catch (e: any) {
      await releaseVoiceSession();
      showStatus("Voice Error", e?.message ?? "Try again or use manual entry.", "error");
    }
  };

  const stopVoiceRecording = async () => {
    voiceResultHandledRef.current = true;
    await releaseVoiceSession();
  };

  return (
    <View style={styles.container}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} />
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

          {voiceAvailable && (
            <Text style={styles.voiceStatusText}>
              {isRecording
                ? `Listening in ${VOICE_LANGUAGES[voiceLanguageIndex]?.label ?? "Auto"}. Say amount, category, date, and location.`
                : voiceText
                  ? `Last voice input: ${voiceText}`
                  : "Say something like 500 rupees fuel today at Shell Banjara Hills."}
            </Text>
          )}

          <ActionCard
            icon="create-outline"
            label="Enter Manually"
            onPress={() => {
              setScannedData(null);
              setManualInitialData(null);
              setShowManual(true);
            }}
          />
        </View>
      </View>

      <ManualEntryOverlay
        visible={showManual}
        initialData={manualInitialData}
        onClose={() => {
          setShowManual(false);
        }}
        onSuccess={() => {
          useExpenseStore.getState().notifyCreated();
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
          useExpenseStore.getState().notifyCreated();
          setShowReviewer(false);
          setScannedData(null);
          navigation.goBack();
        }}
      />
      <StatusModal
        visible={statusModal.visible}
        type={statusModal.type}
        title={statusModal.title}
        message={statusModal.message}
        onClose={() => {
          const cb = statusModal.onClose;
          setStatusModal(prev => ({ ...prev, visible: false, onClose: () => { } }));
          cb();
        }}
      />

      <Modal
        visible={showScanOptions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScanOptions(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowScanOptions(false)}>
          <View style={styles.optionsContainer}>
            <Text style={styles.optionsTitle}>Scan Receipt</Text>
            <Text style={styles.optionsSubtitle}>Choose a source for your bill or receipt</Text>
            
            <TouchableOpacity 
              style={styles.optionItem} 
              onPress={() => { setShowScanOptions(false); setTimeout(handleTakePhoto, 300); }}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                <Ionicons name="camera-outline" size={24} color="#10B981" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>Take Photo</Text>
                <Text style={styles.optionDesc}>Capture a clear photo of your receipt</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionItem} 
              onPress={() => { setShowScanOptions(false); setTimeout(handlePickFromGallery, 300); }}
            >
              <View style={[styles.optionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                <Ionicons name="image-outline" size={24} color="#3B82F6" />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>Upload from Gallery</Text>
                <Text style={styles.optionDesc}>Pick an existing photo from your device</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.optionsCancel} 
              onPress={() => setShowScanOptions(false)}
            >
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

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
    justifyContent: 'flex-end',
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  loadingText: {
    color: "#fff",
    marginTop: 20,
    fontSize: 18,
    fontFamily: "Outfit-Bold",
    letterSpacing: 0.5,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  optionsContainer: {
    width: '100%',
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
  },
  optionsTitle: {
    color: '#FFF',
    fontSize: 22,
    fontFamily: 'Outfit-Bold',
    marginBottom: 4,
  },
  optionsSubtitle: {
    color: '#8E8E93',
    fontSize: 15,
    fontFamily: 'Outfit-Regular',
    marginBottom: 24,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    color: '#FFF',
    fontSize: 16,
    fontFamily: 'Outfit-Bold',
  },
  optionDesc: {
    color: '#8E8E93',
    fontSize: 13,
    fontFamily: 'Outfit-Regular',
  },
  optionsCancel: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  optionsCancelText: {
    color: '#FFF',
    fontSize: 17,
    fontFamily: 'Outfit-Bold',
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
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
  voiceStatusText: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 13,
    textAlign: "center",
    marginTop: -4,
    marginBottom: 14,
    paddingHorizontal: 16,
    lineHeight: 18,
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
