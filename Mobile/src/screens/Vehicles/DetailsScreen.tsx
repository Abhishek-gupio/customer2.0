import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, Platform, PermissionsAndroid,
    Animated, Easing
} from 'react-native';
import { useRef } from 'react';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generatePDF as convertToPDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';
import LinearGradient from 'react-native-linear-gradient';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';

const { width } = Dimensions.get('window');

import {
    Trash2, FileText, Wrench, AlertCircle, User, Settings,
    ShieldCheck, Droplets, Cpu, CheckCircle2, Star, Tag, Gauge,
    Clock, FileCheck, Activity, IdCard, Weight, Building, Plus, Type,
    Calendar, Bookmark, Upload, X, Download, Share2, Info, ChevronUp, ChevronDown, Hash, ChevronRight
} from 'lucide-react-native';

import BackButton from '../../components/BackButton';
import StatusModal from '../../components/common/Modals/StatusModal';
import ConfirmModal from '../../components/common/Modals/ConfirmModal';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { COLORS, FALLBACK_IMAGE, InfoCard, INDPlate, GloveboxItem, StatusCard } from '../../components/Vehicles/VehicleUI';
import { getAbsoluteUrl } from '../../config';
import { Vehicle, vehicleService } from '../../services/vehicleService';
import { api } from '../../services/api';
import ShareScreen from './Share';
import { getProfile } from '../../services/profileService';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { RootState } from '../../store';
import { fetchDocuments, removeDocumentAsync } from '../../store/slices/documentsSlice';
import LoaderButton from '../../components/Button';

const CarImage = { uri: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=400' };
const BikeImage = { uri: 'https://images.unsplash.com/photo-1484981138541-3d074aa97716?auto=format&fit=crop&q=80&w=400' };
const IndianLion = require('../../assets/images/indian_lion.png') as any;

type DetailsScreenProps = {
    vehicles: Vehicle[];
    activeVehicle: Vehicle | null;
    setActiveVehicle: (v: Vehicle) => void;
    onBack: () => void;
    onAddNew: () => void;
    onDelete: (id: string) => void;
    onSetPrimary: (id: string) => void;
    deletingVehicleId?: string | null;
    settingPrimaryId?: string | null;
    initialTab?: MainTab;
};

type MainTab = 'Alerts' | 'Details';
type SubTab = 'Health' | 'Owner' | 'Vehicle' | 'Documents';

export const DetailsScreen = ({
    vehicles, activeVehicle, setActiveVehicle, onBack, onAddNew, onDelete, onSetPrimary, deletingVehicleId, settingPrimaryId, initialTab
}: DetailsScreenProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [mainTab, setMainTab] = useState<MainTab>(initialTab || 'Alerts');
    const [subTab, setSubTab] = useState<SubTab>('Health');



    useEffect(() => {
        if (initialTab) setMainTab(initialTab);
    }, [initialTab]);

    const [statusModal, setStatusModal] = useState({
        visible: false,
        type: 'success' as 'success' | 'delete' | 'error',
        title: '',
        message: '',
    });
    const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
        setStatusModal({ visible: true, type, title, message });
    };

    const [confirmModal, setConfirmModal] = useState({
        visible: false,
        title: '',
        message: '',
        type: 'default' as 'default' | 'logout' | 'delete',
        confirmText: 'Confirm',
        onConfirm: () => { }
    });
    const [healthScoreDetail, setHealthScoreDetail] = useState<{
        overallScore?: number;
        scoreChangeReason?: string;
        components?: { name: string; score: number | null; label: string }[];
        recommendations?: string[];
        explanations?: string[];
    } | null>(null);
    const healthVal = healthScoreDetail?.overallScore ?? activeVehicle?.healthScore?.overallScore ?? 0;
    const animatedHealth = useRef(new Animated.Value(0)).current;

    // Semicircle Gauge Constants
    const R = wp(36);
    const strokeWidth = wp(4.5);
    const padding = wp(5);
    const svgWidth = R * 2 + padding * 2;
    const svgHeight = R + padding * 1.5;
    const startX = padding;
    const startY = R + padding;
    const endX = startX + R * 2;
    const pathData = `M ${startX} ${startY} A ${R} ${R} 0 0 1 ${endX} ${startY}`;
    const pathLength = Math.PI * R;

    useEffect(() => {
        Animated.timing(animatedHealth, {
            toValue: healthVal,
            duration: 1800,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start();
    }, [healthVal]);

    const strokeDashoffset = animatedHealth.interpolate({
        inputRange: [0, 100],
        outputRange: [pathLength, 0],
    });

    const getHealthStatus = (score: number) => {
        if (score >= 80) return { label: 'EXCELLENT', color: '#22C55E', desc: 'Your vehicle is in top shape. Maintenance is up to date.' };
        if (score >= 50) return { label: 'GOOD', color: '#F59E0B', desc: 'Some parts need your attention soon to maintain peak performance.' };
        return { label: 'CRITICAL', color: '#EF4444', desc: 'Immediate service recommended. Essential parts are overdue.' };
    };

    const healthStatus = getHealthStatus(healthVal);

    const [expandWhyScore, setExpandWhyScore] = useState(false);
    const [expandNextActions, setExpandNextActions] = useState(false);
    const [rating, setRating] = useState(0);
    const [feedback, setFeedback] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submittedFeedback, setSubmittedFeedback] = useState<any>(null);
    const [shareVisible, setShareVisible] = useState(false);
    const [shareLoading, setShareLoading] = useState(false);
    const [shareAccessList, setShareAccessList] = useState<any[]>([]);
    const [currentCustomerId, setCurrentCustomerId] = useState<string | null>(null);
    const dispatch = useAppDispatch();
    const { documents, loading } = useAppSelector((state: RootState) => state.documents);

    const [showViewerModal, setShowViewerModal] = useState(false);
    const [viewingDoc, setViewingDoc] = useState<any>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            dispatch(fetchDocuments());
        }, [dispatch])
    );

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const profile = await getProfile();
                if (mounted) setCurrentCustomerId(profile.id);
            } catch {
                if (mounted) setCurrentCustomerId(null);
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const fetchHealthDetail = useCallback(async (vehicleId: string) => {
        try {
            // Recalculate first so user sees the latest score and reasons.
            await vehicleService.recalculateHealth(vehicleId);
        } catch {
            // Continue and fetch whatever is currently stored.
        }
        try {
            const data = await vehicleService.getVehicleById(vehicleId);
            const hs = data?.healthScore as typeof healthScoreDetail;
            setHealthScoreDetail(hs ?? null);
        } catch {
            setHealthScoreDetail(null);
        }
    }, []);

    useEffect(() => {
        if (activeVehicle?.id) fetchHealthDetail(activeVehicle.id);
    }, [activeVehicle?.id, fetchHealthDetail]);

    // Hero image error state must be defined BEFORE any early returns
    const [heroError, setHeroError] = useState(false);
    useEffect(() => {
        setHeroError(false);
    }, [activeVehicle?.id, activeVehicle?.imageUrl]);

    if (!activeVehicle) return null;
    
    // rto refers to the combined data from the DB record and the supplemental RTO lookup.
    // We prioritize top-level activeVehicle fields as they come from the production DB.
    const rto = { 
        ...activeVehicle.rtoDetails, 
        ...activeVehicle,
        // Ensure shared field names are handled if they differ
        ownerName: activeVehicle.ownerName || activeVehicle.rtoDetails?.ownerName,
        rto: activeVehicle.rto || activeVehicle.rtoDetails?.rto,
        vehicleClass: activeVehicle.vehicleClass || activeVehicle.rtoDetails?.vehicleClass,
        fitnessUpto: activeVehicle.fitnessUpto || activeVehicle.rtoDetails?.fitnessUpto
    };

    // Hero image source: use absolute URL if available, else fallback to local assets
    const heroUri = activeVehicle.imageUrl ? getAbsoluteUrl(activeVehicle.imageUrl) : null;
    const fallbackSrc = activeVehicle.vehicleType === 'BIKE' ? BikeImage : CarImage;
    const heroImageSource = (!heroError && heroUri) ? { uri: heroUri } : fallbackSrc;

    const handleFeedbackSubmit = () => {
        if (!rating) return;
        setIsSubmitting(true);
        setSubmittedFeedback({ rating, text: feedback });
        setIsSubmitting(false);
        setRating(0);
        setFeedback('');
    };

    const handleDeletePress = () => {
        setConfirmModal({
            visible: true,
            title: 'Remove Vehicle',
            message: `Remove ${activeVehicle.registrationNumber} from your garage?`,
            type: 'delete',
            confirmText: 'Remove',
            onConfirm: () => {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                onDelete(activeVehicle.id);
            }
        });
    };

    const openShare = async () => {
        if (!activeVehicle) return;
        setShareVisible(true);
        try {
            const res: any = await api.get(`/v1/sharing/vehicle/${activeVehicle.id}/access`);
            const raw = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
            const mapped = raw.map((row: any, idx: number) => ({
                id: idx + 1,
                name: row.customer?.fullName || 'User',
                role:
                    row.role === 'OWNER'
                        ? 'Owner'
                        : row.role === 'EDITOR'
                            ? 'Editor'
                            : row.role === 'DRIVER'
                                ? 'Driver'
                                : 'Viewer',
                phone: row.customer?.phoneNumber ? `+91 ${row.customer.phoneNumber}` : '',
                status: 'active' as const,
            }));
            setShareAccessList(mapped);
        } catch {
            setShareAccessList([]);
        }
    };

    const handleInvite = async (phone: string, role: 'Editor' | 'Viewer' | 'Driver') => {
        if (!activeVehicle) return;
        setShareLoading(true);
        try {
            await api.post('/v1/sharing/share', {
                vehicleId: activeVehicle.id,
                phoneNumber: phone,
                role: role.toUpperCase(),
            });
        } finally {
            setShareLoading(false);
        }
    };

    const handleRevoke = async (_userId: number) => {
        // TODO: wire revoke once we expose specific access IDs in the mobile payload
        return;
    };

    // ── Document Actions ──
    const generateRCPDF = async () => {
        try {
            const dateStr = new Date().toLocaleDateString('en-GB');
            const html = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica', sans-serif; padding: 40px; background: #fff; color: #000; }
                            .cert { border: 2px solid #333; padding: 30px; border-radius: 10px; }
                            .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
                            .header img { width: 60px; margin-bottom: 10px; }
                            .header h1 { margin: 0; font-size: 20px; text-transform: uppercase; }
                            .header p { margin: 5px 0; font-size: 12px; color: #666; }
                            .meta-grid { display: flex; flex-wrap: wrap; margin-bottom: 20px; }
                            .meta-item { width: 50%; margin-bottom: 15px; }
                            .label { font-size: 10px; color: #666; font-weight: bold; text-transform: uppercase; }
                            .value { font-size: 13px; font-weight: bold; margin-top: 2px; }
                            .info-table { width: 100%; border-top: 1px solid #eee; padding-top: 20px; margin-bottom: 30px; }
                            .info-row { display: flex; margin-bottom: 10px; font-size: 12px; }
                            .info-label { width: 150px; color: #444; font-weight: bold; }
                            .info-value { flex: 1; font-weight: 800; }
                            .footer { display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #eee; padding-top: 20px; }
                            .note { font-size: 10px; color: #6366f1; font-weight: bold; }
                            .signature { border: 1px solid #eee; padding: 8px; border-radius: 4px; font-size: 9px; text-align: center; }
                        </style>
                    </head>
                    <body>
                        <div class="cert">
                            <div class="header">
                                <img src="https://gupio.io/assets/images/indian_lion.png" />
                                <h1>UNION OF INDIA REGISTRATION CERTIFICATE</h1>
                                <p>Issuing Authority: ${activeVehicle?.rtoDetails?.rto || 'Transport Department'}</p>
                            </div>
                            <div class="meta-grid">
                                <div class="meta-item">
                                    <div class="label">Registration No:</div>
                                    <div class="value">${activeVehicle?.registrationNumber}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="label">Registration Date:</div>
                                    <div class="value">${activeVehicle?.registrationDate || activeVehicle?.rtoDetails?.regDate || 'N/A'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="label">Chassis No:</div>
                                    <div class="value">${activeVehicle?.chassisNumber || activeVehicle?.rtoDetails?.chassisNo || 'N/A'}</div>
                                </div>
                                <div class="meta-item">
                                    <div class="label">Engine No:</div>
                                    <div class="value">${activeVehicle?.engineNumber || activeVehicle?.rtoDetails?.engineNumber || 'N/A'}</div>
                                </div>
                            </div>
                            <div class="info-table">
                                <div class="info-row"><div class="info-label">Owner Name:</div> <div class="info-value">${rto.ownerName || 'N/A'}</div></div>
                                <div class="info-row"><div class="info-label">Make / Model:</div> <div class="info-value">${activeVehicle.make || rto.make || 'N/A'} / ${activeVehicle.model || rto.model || 'N/A'}</div></div>
                                <div class="info-row"><div class="info-label">Vehicle Type / Class:</div> <div class="info-value">${activeVehicle.vehicleType || (rto as any).vehicleType || 'N/A'} (${rto.vehicleClass || 'N/A'})</div></div>
                                <div class="info-row"><div class="info-label">RTO Office:</div> <div class="info-value">${rto.rto || 'Transport Department'}</div></div>
                                <div class="info-row"><div class="info-label">Fuel Norms:</div> <div class="info-value">${activeVehicle.fuelNorms || rto.fuelNorms || activeVehicle.fuelType || 'N/A'}</div></div>
                                <div class="info-row"><div class="info-label">Color:</div> <div class="info-value">${activeVehicle.color || rto.color || 'N/A'}</div></div>
                                <div class="info-row"><div class="info-label">Manufacturing:</div> <div class="info-value">${activeVehicle.manufacturingMonthYear || rto.manufacturingMonthYear || 'N/A'}</div></div>
                                <div class="info-row"><div class="info-label">RC EXPIRED:</div> <div class="info-value">${rto.fitnessUpto || 'N/A'}</div></div>
                            </div>
                            <div class="footer">
                                <div class="note">Powered by DigiLocker</div>
                                <div class="signature">
                                    Digitally signed on ${dateStr}<br/>Verified by Gupio
                                </div>
                            </div>
                        </div>
                    </body>
                </html>
            `;
            const options = {
                html: html,
                fileName: `RC_${activeVehicle?.registrationNumber}_${Date.now()}`,
            };
            const file = await convertToPDF(options);
            return file?.filePath;
        } catch (error) {
            console.error('RC PDF Gen Error:', error);
            return null;
        }
    };

    const createPDFFromImage = async (doc: any) => {
        try {
            let base64Data = '';
            
            // Check if it's a remote URL or local path
            if (doc.imageUri.startsWith('http')) {
                const response = await fetch(doc.imageUri);
                const blob = await response.blob();
                base64Data = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });
            } else {
                // For local files, use RNFS
                const path = doc.imageUri.replace('file://', '');
                const content = await RNFS.readFile(path, 'base64');
                const extension = path.split('.').pop()?.toLowerCase() || 'jpg';
                base64Data = `data:image/${extension === 'png' ? 'png' : 'jpeg'};base64,${content}`;
            }

            const options = {
                html: `
          <html>
            <body style="margin:0;padding:20;background-color:white;display:flex;justify-content:center;align-items:center;width:100%;height:100%;">
              <div style="width:100%; text-align:center;">
                <h1 style="font-family: Arial; font-size: 24px;">${doc.type.toUpperCase()}</h1>
                <p style="font-family: Arial; font-size: 16px; color: #666;">Vehicle: ${activeVehicle?.registrationNumber}</p>
                <img src="${base64Data}" style="max-width:90%; max-height:800px; object-fit:contain; border: 1px solid #ccc; padding: 10px;" />
              </div>
            </body>
          </html>
        `,
                fileName: `${doc.type.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`,
                directory: 'Documents',
            };
            const file = await convertToPDF(options);
            return file.filePath;
        } catch (error) {
            console.error('PDF Generation Error:', error);
            throw new Error('Failed to generate PDF. Make sure the document is fully loaded.');
        }
    };

    const handleShareDoc = async (doc: any) => {
        try {
            setIsProcessing(true);
            const isRC = doc?.type?.toUpperCase() === 'RC' || doc?.type?.toLowerCase() === 'reg certificate';
            let pdfPath: string | null = '';
            
            if (isRC) {
                pdfPath = await generateRCPDF();
            } else {
                if (!doc?.imageUri) {
                    setIsProcessing(false);
                    return;
                }
                pdfPath = await createPDFFromImage(doc);
            }

            if (!pdfPath) {
                setIsProcessing(false);
                return;
            }
            
            // Generate a clean temp path in cache with .pdf extension
            const cleanFileName = `${doc.type.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}.pdf`;
            const tempPath = `${RNFS.CachesDirectoryPath}/${cleanFileName}`;
            
            // Copy to the clean path to ensure extension and accessibility
            await RNFS.copyFile(pdfPath, tempPath);
            
            const shareOptions: any = {
                title: `Share ${doc.type}`,
                failOnCancel: false,
                type: 'application/pdf',
                filename: cleanFileName,
            };

            if (Platform.OS === 'android') {
                // Ensure file:// prefix and use the raw path
                shareOptions.url = `file://${tempPath}`;
            } else {
                // Use base64 for iOS
                const base64Data = await RNFS.readFile(tempPath, 'base64');
                shareOptions.url = `data:application/pdf;base64,${base64Data}`;
            }

            // Small delay to ensure file system has flushed
            await new Promise(r => setTimeout(r, 600));
            setIsProcessing(false);

            await RNShareCustom.open(shareOptions);
            
            // Clean up temp file
            setTimeout(() => RNFS.unlink(tempPath).catch(() => {}), 5000);
        } catch (error: any) {
            setIsProcessing(false);
            const msg = error?.message || '';
            if (msg.includes('User did not share') || msg.toLowerCase().includes('cancel') || msg.includes('dismissed')) {
                return;
            }
            showStatus('Error', 'Could not share document as PDF. Please try again.', 'error');
            console.error('Share Error:', error);
        }
    };

    const handleDownloadDoc = async (doc: any) => {
        if (!doc?.imageUri) return;
        try {
            setIsProcessing(true);

            if (Platform.OS === 'android') {
                await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
                    {
                        title: 'Storage Permission',
                        message: 'App needs access to your storage to download the PDF',
                        buttonNeutral: 'Ask Me Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    }
                );
            }

            const tempPdfPath = await createPDFFromImage(doc);
            const fileName = tempPdfPath.split('/').pop();
            let finalPath = tempPdfPath;

            if (Platform.OS === 'android') {
                const downloadDir = RNFS.DownloadDirectoryPath;
                finalPath = `${downloadDir}/${fileName}`;
                await RNFS.copyFile(tempPdfPath, finalPath);
                await RNFS.unlink(tempPdfPath);
            }

            setIsProcessing(false);
            showStatus('Success', `Document downloaded successfully! You can find it in your Downloads folder as ${fileName}`);
        } catch (error: any) {
            setIsProcessing(false);
            showStatus('Error', error.message || 'Could not download document as PDF', 'error');
        }
    };

    const handleDeleteDoc = async (id: string, type: string) => {
        setConfirmModal({
            visible: true,
            title: 'Delete Document',
            message: `Are you sure you want to delete your ${type}?`,
            type: 'delete',
            confirmText: 'Delete',
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                try {
                    await dispatch(removeDocumentAsync(id)).unwrap();
                    setShowViewerModal(false);
                    showStatus('Success', `${type} deleted successfully`);
                } catch (err: any) {
                    showStatus('Error', err.message || 'Failed to delete', 'error');
                }
            }
        });
    };

    // ── Helper: alert status badge ───────────────────────────────────────────
    const getInsuranceStatus = (): string => {
        if (!rto?.insuranceUpto) return 'UNKNOWN';
        const expiry = new Date(rto.insuranceUpto);
        return expiry > new Date() ? 'VALID' : 'EXPIRED';
    };

    const getPucStatus = (): string => {
        if (!rto?.pollutionUpto) return 'UNKNOWN';
        const expiry = new Date(rto.pollutionUpto);
        return expiry > new Date() ? 'VALID' : 'EXPIRED';
    };

    const getDocByType = (docType: string) => {
        const typeMap: Record<string, string> = {
            'reg certificate': 'RC',
            "driver's licence": 'DL',
            'insurance policy': 'Insurance',
            'puc certificate': 'PUC'
        };
        const mappedType = typeMap[docType] || docType;
        
        // Normalize for matching
        const targetType = mappedType.toUpperCase();
        const targetPlate = activeVehicle.registrationNumber?.replace(/\s+/g, '').toUpperCase();
        
        return documents.find(d => {
            const docTypeMatch = d.type.toUpperCase() === targetType;
            const docPlate = (d.vehicle || d.documentNumber || '')?.replace(/\s+/g, '').toUpperCase();
            
            // Match if type matches AND (plate matches OR we don't have a plate for this doc yet)
            // This is safer than strict matching if the backend linking is slightly off
            return docTypeMatch && (docPlate === targetPlate || !docPlate || docPlate === '');
        });
    };

    const GloveboxImageItem = ({ label, icon: Icon, onPress }: { label: string, icon: any, onPress: () => void }) => {
        const doc = getDocByType(label);

        const handlePress = () => {
            if (doc) {
                setViewingDoc(doc);
                setShowViewerModal(true);
            } else {
                navigation.navigate('DocumentList');
            }
        };

        return (
            <TouchableOpacity onPress={handlePress} style={styles.gloveboxItem}>
                <View style={styles.gloveboxIconBox}>
                    {doc ? (
                        <Image 
                            source={{ uri: doc.imageUri }} 
                            style={styles.gloveboxPreview} 
                            resizeMode="cover" 
                            blurRadius={25}
                        />
                    ) : (
                        Icon && <Icon size={20} color="#666" />
                    )}
                </View>
                <Text style={styles.gloveboxLabel} numberOfLines={1}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.screen} edges={['top']}>
            {/* ── Header ── */}
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <BackButton onPress={onBack} />

                <View style={styles.tabPillContainer}>
                    {(['Alerts', 'Details'] as MainTab[]).map(t => (
                        <TouchableOpacity
                            key={t}
                            onPress={() => setMainTab(t)}
                            style={[styles.tabPill, mainTab === t && styles.tabPillActive]}
                        >
                            <Text style={[styles.tabPillText, mainTab === t && { color: '#000' }]}>{t}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={{ flexDirection: 'row', gap: wp('2%') }}>
                    {currentCustomerId && activeVehicle.customerId === currentCustomerId && (
                        <TouchableOpacity onPress={openShare} style={styles.topRoundBtn}>
                            <User size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleDeletePress} style={styles.topRoundBtn} disabled={deletingVehicleId === activeVehicle.id}>
                        {deletingVehicleId === activeVehicle.id ? (
                            <ActivityIndicator size="small" color="#FF453A" />
                        ) : (
                            <Trash2 size={22} color="#FF453A" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: hp('12%') }} showsVerticalScrollIndicator={false}>
                {/* ── Hero section as per mockup ── */}
                <View style={styles.heroSection}>
                    <View style={styles.heroImageFrame}>
                        <Image
                            source={heroImageSource}
                            style={styles.heroImage}
                            resizeMode="cover"
                            onError={() => setHeroError(true)}
                        />
                    </View>

                    <Text style={styles.brandName}>{activeVehicle.make?.toUpperCase() || 'VEHICLE'}</Text>
                    <Text style={styles.modelName}>{activeVehicle.model?.toUpperCase() || 'MODEL'}</Text>

                    <View style={styles.heroPlateBox}>
                        <INDPlate number={activeVehicle.registrationNumber} />
                    </View>

                    {activeVehicle.isPrimary ? (
                        <View style={styles.primaryBadge}>
                            <Star size={14} color="#000" fill="#000" />
                            <Text style={styles.primaryBadgeText}>PRIMARY VEHICLE</Text>
                        </View>
                    ) : (
                        <LoaderButton
                            title="SET AS PRIMARY"
                            loading={settingPrimaryId === activeVehicle.id}
                            loadingTitle="Setting..."
                            onPress={() => onSetPrimary(activeVehicle.id)}
                            disabled={deletingVehicleId === activeVehicle.id}
                            style={styles.setPrimaryBtn}
                            titleStyle={styles.setPrimaryBtnText}
                            loadingTitleStyle={styles.setPrimaryBtnText}
                            indicatorColor={COLORS.primary}
                        />
                    )}

                    {/* ── Vehicle switcher circle icons ── */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.switcherRow}
                    >
                        <TouchableOpacity onPress={onAddNew} style={styles.addCircleBtn}>
                            <Plus size={24} color={COLORS.primary} />
                        </TouchableOpacity>
                        {vehicles
                            .filter(v => !v.__optimistic)
                            .map((v: Vehicle) => (
                                <TouchableOpacity
                                    key={v.id}
                                    onPress={() => setActiveVehicle(v)}
                                    style={[
                                        styles.miniCircleWrap,
                                        activeVehicle.id === v.id && styles.miniCircleActive
                                    ]}
                                >
                                    <View style={[styles.miniCircleInner, activeVehicle.id === v.id && { borderColor: COLORS.primary }]}>
                                        <Image
                                            source={v.imageUrl ? { uri: v.imageUrl } : (v.vehicleType === 'BIKE' ? BikeImage : CarImage)}
                                            style={StyleSheet.absoluteFill}
                                            resizeMode="cover"
                                            blurRadius={activeVehicle.id === v.id ? 2 : 0}
                                        />
                                        <View style={styles.miniModelOverlay}>
                                            <Text style={styles.miniModelText} numberOfLines={1}>{v.model || v.make || 'V'}</Text>
                                        </View>
                                        {v.isPrimary && (
                                            <View style={styles.miniPrimaryIndicator}>
                                                <Star size={10} color="#000" fill="#000" />
                                            </View>
                                        )}
                                    </View>
                                    <Text 
                                        style={[styles.activeMiniLabel, activeVehicle.id === v.id && { color: COLORS.primary }]} 
                                        numberOfLines={1}
                                    >
                                        {v.registrationNumber}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                    </ScrollView>
                </View>

                {/* ── Tab Content ── */}
                <View style={styles.sectionPad}>
                    {mainTab === 'Alerts' ? (
                        <>
                            {/* ── Status List (Challans & Health) ── */}
                            <View style={styles.statusVerticalStack}>
                                <StatusCard
                                    icon={FileText}
                                    label="TRAFFIC CHALLANS"
                                    value="Check your pending fines"
                                    onPress={() => navigation.navigate('Challans', { vehicle: activeVehicle })}
                                />
                                {activeVehicle.isPrimary && (
                                    <StatusCard
                                        icon={ShieldCheck}
                                        label="VEHICLE HEALTH"
                                        value="Detailed health report"
                                        onPress={() => navigation.navigate('WarrantyStatus')}
                                    />
                                )}
                            </View>



                            {/* ── Your GloverBox ── */}
                            <View style={{ marginTop: hp('4%') }}>
                                <Text style={styles.sectionHeading}>YOUR GLOVEBOX</Text>
                                <View style={styles.gloveboxGrid}>
                                    <GloveboxImageItem label="reg certificate" icon={Upload} onPress={() => navigation.navigate('DocumentList')} />
                                    <GloveboxImageItem label="driver's licence" icon={Upload} onPress={() => navigation.navigate('DocumentList')} />
                                    <GloveboxImageItem label="insurance policy" icon={Upload} onPress={() => navigation.navigate('DocumentList')} />
                                    <GloveboxImageItem label="puc certificate" icon={Upload} onPress={() => navigation.navigate('DocumentList')} />
                                </View>

                                <TouchableOpacity
                                    style={styles.viewAllDocsBtn}
                                    onPress={() => navigation.navigate('DocumentList')}
                                >
                                    <Text style={styles.viewAllDocsText}>View all documents</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        /* ── Details Tab (Sub-Tab Navigation) ── */
                        <View>
                            <View style={{ alignItems: 'center' }}>
                                <View style={styles.subTabNav}>
                                    {(['Health', 'Owner', 'Vehicle', 'Documents'] as SubTab[]).map(st => (
                                        <TouchableOpacity
                                            key={st}
                                            onPress={() => setSubTab(st)}
                                            style={[styles.subTabItem, subTab === st && styles.subTabItemActive]}
                                        >
                                            <Text style={[styles.subTabText, subTab === st && styles.subTabTextActive]}>
                                                {st}
                                            </Text>
                                            {subTab === st && <View style={styles.subTabIndicator} />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View style={{ gap: hp('2%') }}>
                                {subTab === 'Health' && (
                                    <>
                                        <LinearGradient
                                            colors={['#171717', '#0A0A0A']}
                                            style={styles.healthScoreCard}
                                        >
                                            <View style={styles.healthHeader}>
                                                <Text style={styles.healthTitle}>VEHICLE HEALTH SCORE</Text>
                                                <View style={styles.liveBadge}>
                                                    <View style={styles.livePulseContainer}>
                                                        <View style={styles.liveDot} />
                                                        <View style={styles.liveDotPing} />
                                                    </View>
                                                    <Text style={styles.liveText}>LIVE</Text>
                                                </View>
                                            </View>

                                            <View style={styles.gaugeContainer}>
                                                <Svg width={svgWidth} height={svgHeight}>
                                                    <Defs>
                                                        <SvgGradient id="gaugeTrack" x1="0" y1="0" x2="1" y2="0">
                                                            <Stop offset="0" stopColor="#EF4444" stopOpacity="0.1" />
                                                            <Stop offset="0.4" stopColor="#F59E0B" stopOpacity="0.1" />
                                                            <Stop offset="1" stopColor="#22C55E" stopOpacity="0.1" />
                                                        </SvgGradient>
                                                        <SvgGradient id="gaugeFill" x1="0" y1="0" x2="1" y2="0">
                                                            <Stop offset="0" stopColor="#EF4444" />
                                                            <Stop offset="0.4" stopColor="#F59E0B" />
                                                            <Stop offset="1" stopColor="#22C55E" />
                                                        </SvgGradient>
                                                    </Defs>
                                                    <Path
                                                        d={pathData}
                                                        stroke="url(#gaugeTrack)"
                                                        strokeWidth={strokeWidth}
                                                        strokeLinecap="round"
                                                        fill="transparent"
                                                    />
                                                    <AnimatedPath
                                                        d={pathData}
                                                        stroke="url(#gaugeFill)"
                                                        strokeWidth={strokeWidth}
                                                        strokeLinecap="round"
                                                        fill="transparent"
                                                        strokeDasharray={pathLength}
                                                        strokeDashoffset={strokeDashoffset}
                                                    />
                                                </Svg>
                                                <View style={styles.gaugeCenterText}>
                                                    <Text style={styles.healthScoreValue}>{healthVal}</Text>
                                                    <Text style={[styles.healthStatusLabel, { color: healthStatus.color }]}>
                                                        {healthStatus.label}
                                                    </Text>
                                                </View>
                                            </View>

                                            <Text style={styles.healthDescription}>{healthStatus.desc}</Text>

                                            <View style={styles.partsRow}>
                                                <View style={styles.partStatBox}>
                                                    <LinearGradient colors={['rgba(34, 197, 94, 0.15)', 'rgba(34, 197, 94, 0.02)']} style={styles.partIconBg}>
                                                        <CheckCircle2 size={18} color="#22C55E" />
                                                    </LinearGradient>
                                                    <View>
                                                        <Text style={styles.partNumber}>14</Text>
                                                        <Text style={styles.partLabel}>HEALTHY PARTS</Text>
                                                    </View>
                                                </View>
                                                <View style={styles.partStatBox}>
                                                    <LinearGradient colors={['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.02)']} style={styles.partIconBg}>
                                                        <AlertCircle size={18} color="#EF4444" />
                                                    </LinearGradient>
                                                    <View>
                                                        <Text style={[styles.partNumber, { color: '#EF4444' }]}>0</Text>
                                                        <Text style={styles.partLabel}>PARTS DUE</Text>
                                                    </View>
                                                </View>
                                            </View>
                                        </LinearGradient>
                                        <View style={styles.healthBasedOnCard}>
                                            <Text style={styles.healthBasedOnTitle}>What this score is based on</Text>
                                            {healthScoreDetail?.components?.some(c => c.name === 'driving' && c.score != null) ? (
                                                <>
                                                    <Text style={styles.healthBasedOnItem}>• Compliance (20%) — Insurance & PUC documents</Text>
                                                    <Text style={styles.healthBasedOnItem}>• Maintenance (50%) — Parts, mileage & vehicle age</Text>
                                                    <Text style={styles.healthBasedOnItem}>• Driving (30%) — Last 20 trips safety score</Text>
                                                </>
                                            ) : (
                                                <>
                                                    <Text style={styles.healthBasedOnItem}>• Compliance (20%) — Insurance & PUC documents</Text>
                                                    <Text style={styles.healthBasedOnItem}>• Maintenance (80%) — Parts, mileage & vehicle age</Text>
                                                    <Text style={styles.healthBasedOnItem}>• Driving — Not used yet (no trips; add trips to include)</Text>
                                                </>
                                            )}
                                        </View>
                                        {healthScoreDetail?.components && healthScoreDetail.components.length > 0 && (
                                            <View style={styles.healthComponentsRow}>
                                                {healthScoreDetail.components.map((c) => (
                                                    <View key={c.name} style={styles.healthComponentBox}>
                                                        {c.name === 'maintenance' ? <Wrench size={16} color="#666" /> :
                                                         c.name === 'driving' ? <Activity size={16} color="#666" /> :
                                                         <Clock size={16} color="#666" />}
                                                        <Text style={styles.healthComponentLabel}>{c.label}</Text>
                                                        <Text style={styles.healthComponentValue}>
                                                            {c.score != null ? c.score : '—'}
                                                            <Text style={{ fontSize: hp('1.4%'), color: '#555' }}>%</Text>
                                                        </Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}

                                        {(healthScoreDetail?.scoreChangeReason || healthScoreDetail?.explanations?.length) && (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.whyScoreRow}
                                                    onPress={() => setExpandWhyScore(v => !v)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Info size={18} color={COLORS.primary} />
                                                    <Text style={styles.whyScoreLabel}>Score changed because…</Text>
                                                    {expandWhyScore ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                                                </TouchableOpacity>
                                                {expandWhyScore && (
                                                    <View style={styles.whyScoreBody}>
                                                        <Text style={styles.whyScoreText}>{healthScoreDetail?.scoreChangeReason ?? healthScoreDetail?.explanations?.[0] ?? '—'}</Text>
                                                        {healthScoreDetail?.explanations && healthScoreDetail.explanations.length > 1 && (
                                                            <View style={{ marginTop: hp('1%'), gap: hp('0.5%') }}>
                                                                {healthScoreDetail.explanations.slice(1, 4).map((e: string, i: number) => (
                                                                    <Text key={i} style={styles.explanationItem}>• {e}</Text>
                                                                ))}
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </>
                                        )}

                                        {healthScoreDetail?.recommendations && healthScoreDetail.recommendations.length > 0 && (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.whyScoreRow}
                                                    onPress={() => setExpandNextActions(v => !v)}
                                                    activeOpacity={0.7}
                                                >
                                                    <CheckCircle2 size={18} color={COLORS.primary} />
                                                    <Text style={styles.whyScoreLabel}>What to do next</Text>
                                                    {expandNextActions ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                                                </TouchableOpacity>
                                                {expandNextActions && (
                                                    <View style={styles.nextActionsBody}>
                                                        {healthScoreDetail.recommendations.map((r, i) => (
                                                            <View key={i} style={styles.nextActionItem}>
                                                                <Text style={styles.nextActionText}>{r}</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                )}
                                            </>
                                        )}

                                        {!healthScoreDetail && (
                                            <Text style={styles.healthLoadingHint}>Recalculate health from vehicle settings to see breakdown.</Text>
                                        )}
                                    </>
                                )}

                                {subTab === 'Owner' && (
                                    <>
                                        <InfoCard icon={User} label="Owner Name" value={rto?.ownerName || (rto as any)?.owner_name || 'Unknown'} />
                                        <InfoCard icon={Building} label="RTO" value={rto?.rto || 'N/A'} />
                                    </>
                                )}
                                {subTab === 'Vehicle' && (
                                    <>
                                        <InfoCard icon={Tag} label="Make" value={rto?.make || activeVehicle.make || 'Unknown'} />
                                        <InfoCard icon={Star} label="Model" value={rto?.model || activeVehicle.model || 'Unknown'} />
                                        <InfoCard icon={Type} label="Class" value={rto?.vehicleClass || activeVehicle.vehicleType || 'Unknown'} />
                                        <InfoCard icon={Hash} label="Engine Number" value={rto?.engineNumber || rto?.engineNo || 'N/A'} />
                                        <InfoCard icon={Hash} label="Chassis Number" value={rto?.chassisNumber || rto?.chassisNo || activeVehicle.chassisNumber || 'N/A'} />
                                        <InfoCard icon={Droplets} label="Fuel Type" value={rto?.fuelType || activeVehicle.fuelType || 'Petrol'} />
                                        <InfoCard icon={Droplets} label="Color" value={rto?.color ?? activeVehicle.color ?? 'N/A'} />
                                        <InfoCard icon={Weight} label="Unladen Weight" value={rto?.unloadedWeight ?? activeVehicle.unloadedWeight ?? 'N/A'} />
                                        
                                        {/* Merged 'More' details */}
                                        <InfoCard icon={ShieldCheck} label="RC Status" value={rto?.rcStatus || 'ACTIVE'} />
                                        <InfoCard icon={Clock} label="RC EXPIRED" value={rto?.fitnessUpto || (rto as any)?.rc_expiry_date || 'N/A'} />
                                        {(rto?.fuelNorms || activeVehicle.fuelNorms) && (
                                            <InfoCard icon={Info} label="Fuel Norms" value={rto?.fuelNorms || activeVehicle.fuelNorms} />
                                        )}
                                        {(rto?.mileage || activeVehicle.mileage) && (
                                            <InfoCard icon={Gauge} label="Mileage" value={rto?.mileage || activeVehicle.mileage} />
                                        )}
                                        {(rto?.transmission || activeVehicle.transmission) && (
                                            <InfoCard icon={Cpu} label="Transmission" value={rto?.transmission || activeVehicle.transmission} />
                                        )}
                                        {(rto?.regDate || rto?.registrationDate || activeVehicle.registrationDate) && (
                                            <InfoCard icon={Calendar} label="Registration Date" value={rto?.regDate || rto?.registrationDate || (activeVehicle.registrationDate ? new Date(activeVehicle.registrationDate).toLocaleDateString() : 'N/A')} />
                                        )}
                                        {((rto as any)?.presentAddress || (rto as any)?.present_address || (activeVehicle as any)?.presentAddress || (activeVehicle as any)?.present_address) && (
                                            <InfoCard icon={Building} label="Registered Address" value={(rto as any)?.presentAddress || (rto as any)?.present_address || (activeVehicle as any)?.presentAddress || (activeVehicle as any)?.present_address} />
                                        )}
                                        <InfoCard icon={Calendar} label="Manufacturing Date" value={rto?.manufacturingMonthYear || activeVehicle.manufacturingMonthYear || 'N/A'} />
                                    </>
                                )}
                                {subTab === 'Documents' && (
                                    <View style={styles.documentsTab}>
                                        {/* RC Mini Certificate (Production Style) */}
                                        <View style={styles.certificate}>
                                            <View style={styles.certHeader}>
                                                <View style={styles.certHeaderTitleCol}>
                                                    <Text style={styles.certTitleLine1}>UNION OF INDIA</Text>
                                                    <Text style={styles.certTitleLine2}>REGISTRATION CERTIFICATE (RC)</Text>
                                                </View>
                                                <TouchableOpacity onPress={() => handleShareDoc(getDocByType('reg certificate'))} style={styles.certShareBtn}>
                                                    <Share2 size={16} color={COLORS.primary} />
                                                </TouchableOpacity>
                                            </View>
                                            
                                            <View style={styles.certPlateRow}>
                                                <Text style={styles.certPlateText}>{activeVehicle.registrationNumber}</Text>
                                                <View style={styles.certStatusBadge}>
                                                   <Text style={styles.certStatusText}>{rto?.rcStatus || 'ACTIVE'}</Text>
                                                </View>
                                            </View>

                                            <View style={styles.certInfoGrid}>
                                                <View style={styles.certRow}>
                                                    <Text style={styles.certLabel}>OWNER</Text>
                                                    <Text style={styles.certValue}>{rto.ownerName || 'PENDING'}</Text>
                                                </View>
                                                <View style={styles.certRow}>
                                                    <Text style={styles.certLabel}>CLASS</Text>
                                                    <Text style={styles.certValue}>{rto.vehicleClass || activeVehicle.vehicleType || 'N/A'}</Text>
                                                </View>
                                                <View style={styles.certRow}>
                                                    <Text style={styles.certLabel}>RC EXPIRED</Text>
                                                    <Text style={styles.certValue}>{rto.fitnessUpto || 'N/A'}</Text>
                                                </View>
                                                <View style={styles.certRow}>
                                                    <Text style={styles.certLabel}>ISSUING AUTHORITY</Text>
                                                    <Text style={styles.certValue}>{rto.rto || 'LOCAL RTO'}</Text>
                                                </View>
                                            </View>

                                            <TouchableOpacity 
                                                style={styles.certViewDetailsBtn}
                                                onPress={() => {
                                                    const doc = getDocByType('reg certificate');
                                                    if (doc) {
                                                        setViewingDoc(doc);
                                                    } else {
                                                        // Pass a formal DB-only reference if no image exists
                                                        setViewingDoc({ 
                                                            type: 'RC', 
                                                            isFormalOnly: true,
                                                            registrationNumber: activeVehicle.registrationNumber 
                                                        });
                                                    }
                                                    setShowViewerModal(true);
                                                }}
                                            >
                                                <FileText size={14} color="#FFF" />
                                                <Text style={styles.certViewDetailsText}>VIEW ORIGINAL DOCUMENT</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Other Docs List */}
                                        <View style={styles.otherDocsList}>
                                            <Text style={styles.subSectionTitle}>OTHER DOCUMENTS</Text>
                                            <TouchableOpacity style={styles.otherDocRow} onPress={() => navigation.navigate('DocumentList')}>
                                                <ShieldCheck size={20} color="#8E8E93" />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={styles.otherDocLabel}>Insurance Policy</Text>
                                                    <Text style={styles.otherDocValue}>{rto?.insuranceUpto || 'Not Available'}</Text>
                                                </View>
                                                <ChevronRight size={18} color="#444" />
                                            </TouchableOpacity>
                                            <TouchableOpacity style={styles.otherDocRow} onPress={() => navigation.navigate('DocumentList')}>
                                                <Droplets size={20} color="#8E8E93" />
                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={styles.otherDocLabel}>PUC Certificate</Text>
                                                    <Text style={styles.otherDocValue}>{rto?.pollutionUpto || 'Not Available'}</Text>
                                                </View>
                                                <ChevronRight size={18} color="#444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            <ShareScreen
                visible={shareVisible}
                onClose={() => setShareVisible(false)}
                vehicle={{
                    vehicleNumber: activeVehicle.registrationNumber,
                    model: activeVehicle.model || activeVehicle.make || 'Vehicle',
                    brand: activeVehicle.make,
                }}
                accessList={shareAccessList}
                onInvite={handleInvite}
                onRevoke={handleRevoke}
                isLoading={shareLoading}
            />

            {/* Document Viewer Modal */}
            <Modal
                visible={showViewerModal}
                transparent={false}
                animationType="fade"
                onRequestClose={() => setShowViewerModal(false)}
            >
                <SafeAreaView style={styles.viewerContainer}>
                    <View style={styles.viewerHeader}>
                        <View style={styles.viewerHeaderLeft}>
                            <Text style={styles.viewerTitle}>{viewingDoc?.type || 'Document'}</Text>
                            <Text style={styles.viewerSubtitle}>{activeVehicle?.registrationNumber}</Text>
                        </View>
                        <View style={styles.viewerHeaderRight}>
                            <TouchableOpacity
                                style={styles.viewerHeaderIcon}
                                onPress={() => viewingDoc && handleDeleteDoc(viewingDoc.id, viewingDoc.type)}
                            >
                                <Trash2 size={22} color="#FF453A" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.viewerHeaderIcon, { marginLeft: wp('4%') }]}
                                onPress={() => setShowViewerModal(false)}
                            >
                                <X size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView
                        contentContainerStyle={styles.viewerContent}
                        centerContent={true}
                        showsVerticalScrollIndicator={false}
                        maximumZoomScale={5}
                        minimumZoomScale={1}
                        bouncesZoom={true}
                    >
                        {viewingDoc?.type?.toUpperCase() === 'RC' || viewingDoc?.type?.toLowerCase() === 'reg certificate' ? (
                            <View style={styles.formalCertContainer}>
                                <View style={styles.formalCert}>
                                    <View style={styles.formalCertHeader}>
                                        <Image source={IndianLion} style={styles.formalLionLogo} resizeMode="contain" />
                                        <Text style={styles.formalCertTitle}>UNION OF INDIA REGISTRATION CERTIFICATE</Text>
                                        <Text style={styles.formalCertSubtitle}>Issuing Authority: {activeVehicle?.rtoDetails?.rto || 'Transport Department'}</Text>
                                        <View style={styles.formalCertDivider} />
                                    </View>

                                    <View style={styles.formalCertMeta}>
                                        <View style={styles.formalCertMetaRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.formalCertMetaLabel}>Registration No:</Text>
                                                <Text style={styles.formalCertMetaValue}>{activeVehicle?.registrationNumber}</Text>
                                            </View>
                                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                                <Text style={styles.formalCertMetaLabelSmall}>Reg Date:</Text>
                                                <Text style={styles.formalCertMetaValueSmall}>{activeVehicle?.registrationDate || activeVehicle?.rtoDetails?.regDate || 'N/A'}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.formalCertMetaRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.formalCertMetaLabel}>Chassis No:</Text>
                                                <Text style={styles.formalCertMetaValue}>{activeVehicle?.chassisNumber || activeVehicle?.rtoDetails?.chassisNo || 'N/A'}</Text>
                                            </View>
                                            <View style={{ flex: 1, alignItems: 'flex-end' }}>
                                                <Text style={styles.formalCertMetaLabelSmall}>Engine No:</Text>
                                                <Text style={styles.formalCertMetaValueSmall}>{activeVehicle?.engineNumber || activeVehicle?.rtoDetails?.engineNumber || 'N/A'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View style={styles.formalCertInfoGrid}>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Owner Name</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{rto.ownerName || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Make / Model</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.make || rto.make || 'N/A'} / {activeVehicle.model || rto.model || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Vehicle Type</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.vehicleType || (rto as any).vehicleType || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Vehicle Class</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{rto.vehicleClass || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>RTO Name</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{rto.rto || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Fuel Norms</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.fuelNorms || rto.fuelNorms || activeVehicle.fuelType || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Engine No</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.engineNumber || rto.engineNumber || rto.engineNo || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Chassis No</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.chassisNumber || rto.chassisNumber || rto.chassisNo || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Color</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.color || rto.color || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>Mfg Date</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{activeVehicle.manufacturingMonthYear || rto.manufacturingMonthYear || 'N/A'}</Text>
                                        </View>
                                        <View style={styles.formalCertRow}>
                                            <Text style={styles.formalCertLabel}>RC EXPIRED</Text>
                                            <Text style={styles.formalCertSep}>:</Text>
                                            <Text style={styles.formalCertValue}>{rto.fitnessUpto || 'N/A'}</Text>
                                        </View>
                                    </View>

                                    <View style={styles.formalCertFooter}>
                                        <MaterialCommunityIcons name="qrcode" size={70} color="#333" />
                                        <View style={styles.formalCertNoteBox}>
                                            <Text style={styles.formalCertPowered}>Powered by DigiLocker</Text>
                                            <View style={styles.formalCertSignedBadge}>
                                                <Text style={styles.formalCertSignedText}>Digitally signed on</Text>
                                                <Text style={styles.formalCertSignedDate}>{new Date().toLocaleDateString('en-GB')}</Text>
                                                <CheckCircle2 size={12} color="#22C55E" />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        ) : viewingDoc?.imageUri ? (
                            <Image
                                source={{ uri: viewingDoc.imageUri }}
                                style={styles.fullImage}
                                resizeMode="contain"
                            />
                        ) : (
                            <View style={styles.viewerPlaceholder}>
                                <FileText size={64} color="#333" />
                                <Text style={styles.placeholderText}>Preview not available</Text>
                            </View>
                        )}
                    </ScrollView>

                    <View style={styles.viewerFooter}>
                        <TouchableOpacity style={styles.viewerActionBtn} onPress={() => handleShareDoc(viewingDoc)}>
                            <Share2 size={20} color="#FFF" />
                            <Text style={styles.viewerActionText}>Share as PDF</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.viewerActionBtn, styles.viewerActionBtnOutline]} onPress={() => handleDownloadDoc(viewingDoc)}>
                            <Download size={20} color="#FFF" />
                            <Text style={styles.viewerActionText}>Download PDF</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>

            {isProcessing && (
                <View style={styles.loaderOverlay}>
                    <ActivityIndicator size="large" color={COLORS.primary} />
                </View>
            )}

            <StatusModal
                visible={statusModal.visible}
                type={statusModal.type}
                title={statusModal.title}
                message={statusModal.message}
                onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
            />

            <ConfirmModal
                visible={confirmModal.visible}
                title={confirmModal.title}
                message={confirmModal.message}
                type={confirmModal.type}
                confirmText={confirmModal.confirmText}
                onConfirm={confirmModal.onConfirm}
                onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
            />
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    header: { paddingHorizontal: wp('5%'), paddingVertical: hp('1%'), minHeight: hp('8%') },
    topRoundBtn: { width: wp('11%'), height: wp('11%'), borderRadius: wp('5.5%'), backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: hp('0.1%'), borderColor: '#333' },
    tabPillContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: wp('8%'),
        padding: wp('1%'),
        borderWidth: hp('0.1%'),
        borderColor: COLORS.border,
        width: wp('45%'),
        marginHorizontal: wp('4%')
    },
    tabPill: { flex: 1, paddingVertical: hp('1%'), alignItems: 'center', borderRadius: wp('8%') },
    tabPillActive: { backgroundColor: COLORS.primary },
    tabPillText: { fontSize: hp('1.5%'), fontFamily: 'Outfit-Black', color: '#888' },

    // Hero Section
    heroSection: { alignItems: 'center', paddingBottom: hp('2%'), paddingHorizontal: wp('6%') },
    heroImageFrame: { width: '100%', height: hp('28%'), marginBottom: hp('1.5%'), borderRadius: wp('3.5%'), overflow: 'hidden', backgroundColor: '#0B0B0B' },
    heroImage: { width: '100%', height: '100%' },
    brandName: { fontSize: hp('1.2%'), fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: wp('1%'), textTransform: 'uppercase', marginTop: hp('1%') },
    modelName: { fontSize: hp('2.8%'), fontWeight: '900', color: '#FFF', marginTop: hp('-0.5%') },
    heroPlateBox: { marginTop: hp('1.5%') },

    // Switcher Row
    switcherRow: { flexDirection: 'row', alignItems: 'center', gap: wp('4%'), marginTop: hp('5%'), paddingHorizontal: wp('6%'), paddingBottom: hp('3%') },
    addCircleBtn: { width: wp('16%'), height: wp('16%'), borderRadius: wp('8%'), backgroundColor: 'rgba(255, 215, 0, 0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: hp('0.15%'), borderColor: 'rgba(255, 215, 0, 0.2)' },
    miniCircleWrap: { alignItems: 'center', gap: hp('0.5%') },
    miniCircleInner: { width: wp('16%'), height: wp('16%'), borderRadius: wp('8%'), padding: wp('1%'), borderWidth: hp('0.2%'), borderColor: '#333', backgroundColor: '#1A1A1A', overflow: 'hidden' },
    miniCircleActive: { transform: [{ scale: 1.1 }] },
    miniModelOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: wp('8%') },
    miniModelText: { color: '#FFF', fontSize: hp('1.2%'), fontFamily: 'Outfit-Black', textAlign: 'center', paddingHorizontal: wp('1%') },
    activeMiniLabel: { fontSize: hp('1%'), fontFamily: 'Outfit-Bold', color: '#888', position: 'absolute', bottom: hp('-2.5%'), textAlign: 'center', width: wp('20%') },
    miniPrimaryIndicator: {
        position: 'absolute',
        top: wp('1%'),
        right: wp('1%'),
        backgroundColor: COLORS.primary,
        width: wp('4.5%'),
        height: wp('4.5%'),
        borderRadius: wp('2.25%'),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: hp('0.1%'),
        borderColor: '#000'
    },

    primaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('1.5%'),
        backgroundColor: COLORS.primary,
        paddingHorizontal: wp('4%'),
        paddingVertical: hp('0.8%'),
        borderRadius: wp('5%'),
        marginTop: hp('2%')
    },
    primaryBadgeText: {
        color: '#000',
        fontSize: hp('1.4%'),
        fontFamily: 'Outfit-Black',
        letterSpacing: wp('0.15%')
    },
    setPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('1.5%'),
        borderWidth: hp('0.15%'),
        borderColor: COLORS.primary,
        paddingHorizontal: wp('4%'),
        paddingVertical: hp('0.8%'),
        borderRadius: wp('5%'),
        marginTop: hp('2%')
    },
    setPrimaryBtnText: {
        color: COLORS.primary,
        fontSize: hp('1.4%'),
        fontFamily: 'Outfit-Bold'
    },

    sectionPad: { paddingHorizontal: wp('6%'), paddingTop: hp('2.5%') },
    sectionHeading: { fontSize: hp('1.3%'), fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: wp('0.4%'), marginBottom: hp('2%') },

    // Status List Stack
    statusVerticalStack: {
        flexDirection: 'column',
        gap: hp('1.5%')
    },
    statusBox: {
        flex: 1, backgroundColor: '#0A0A0A', padding: wp('6%'), borderRadius: wp('6%'),
        flexDirection: 'column', alignItems: 'center', gap: hp('2%'),
        borderWidth: hp('0.15%'), borderColor: '#1F1F1F'
    },

    // Glovebox
    gloveboxGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: wp('3%') },
    gloveboxItem: { width: (wp('100%') - wp('21%')) / 4, alignItems: 'center', gap: hp('1%') },
    gloveboxIconBox: { width: '100%', aspectRatio: 1, backgroundColor: '#1A1A1A', borderRadius: wp('4%'), alignItems: 'center', justifyContent: 'center', borderWidth: hp('0.15%'), borderColor: '#333' },
    gloveboxLabel: { color: '#AAA', fontSize: hp('1.3%'), fontWeight: '600', textAlign: 'center', fontFamily: 'Outfit' },
    gloveboxPreview: { width: '100%', height: '100%', borderRadius: wp('4%') },
    viewAllDocsBtn: { marginTop: hp('3%'), borderWidth: hp('0.15%'), borderColor: '#333', borderRadius: wp('3.5%'), paddingVertical: hp('1.8%'), alignItems: 'center', backgroundColor: '#1A1A1A' },
    viewAllDocsText: { color: COLORS.primary, fontSize: hp('1.6%'), fontFamily: 'Outfit-Black', textTransform: 'uppercase', letterSpacing: wp('0.4%') },

    // Health Score Styles
    subTabNav: { flexDirection: 'row', paddingBottom: hp('3%'), gap: wp('2%'), justifyContent: 'center', alignItems: 'center' },
    subTabItem: { paddingHorizontal: wp('4%'), paddingVertical: hp('1.2%'), borderRadius: wp('3%'), alignItems: 'center' },
    subTabItemActive: { backgroundColor: 'rgba(255, 215, 0, 0.05)' },
    subTabText: { fontSize: hp('1.4%'), fontFamily: 'Outfit-Bold', color: '#8E8E93', textTransform: 'uppercase' },
    subTabTextActive: { color: COLORS.primary },
    subTabIndicator: { width: wp('4%'), height: hp('0.25%'), backgroundColor: COLORS.primary, marginTop: hp('0.5%'), borderRadius: wp('1%') },

    // Health Score Styles
    healthScoreCard: {
        padding: wp('5%'),
        borderRadius: wp('7%'),
        borderWidth: hp('0.15%'),
        borderColor: 'rgba(255,255,255,0.06)',
        marginBottom: hp('1.5%')
    },
    healthHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: hp('2%')
    },
    healthTitle: {
        color: '#666',
        fontSize: hp('1.2%'),
        fontFamily: 'Outfit-Bold',
        letterSpacing: wp('0.4%')
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        paddingHorizontal: wp('2.5%'),
        paddingVertical: hp('0.5%'),
        borderRadius: wp('2%'),
        gap: wp('1.5%'),
        borderWidth: hp('0.15%'),
        borderColor: 'rgba(34, 197, 94, 0.2)'
    },
    livePulseContainer: { width: wp('2%'), height: wp('2%'), justifyContent: 'center', alignItems: 'center' },
    liveDot: { width: wp('1.5%'), height: wp('1.5%'), borderRadius: wp('0.75%'), backgroundColor: '#22C55E', position: 'absolute' },
    liveDotPing: { width: wp('2%'), height: wp('2%'), borderRadius: wp('1%'), backgroundColor: '#22C55E', opacity: 0.4 },
    liveText: { color: '#22C55E', fontSize: hp('1.2%'), fontFamily: 'Outfit-Bold', letterSpacing: wp('0.15%') },

    gaugeContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: hp(1)
    },
    gaugeCenterText: {
        position: 'absolute',
        bottom: wp(4),
        alignItems: 'center',
        justifyContent: 'center'
    },
    healthScoreValue: {
        color: '#FFF',
        fontSize: wp(18),
        fontFamily: 'Outfit-Black',
        lineHeight: wp(18)
    },
    healthStatusLabel: {
        fontSize: wp(4.5),
        fontFamily: 'Outfit-Black',
        letterSpacing: 3,
        marginTop: -hp(1)
    },
    healthDescription: {
        color: '#888',
        fontSize: hp('1.5%'),
        fontFamily: 'Outfit-Medium',
        textAlign: 'center',
        lineHeight: hp('2.2%'),
        marginTop: hp('2%'),
        paddingHorizontal: wp('5%'),
        marginBottom: hp('3%')
    },
    partsRow: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.02)',
        borderRadius: wp('5%'),
        paddingVertical: hp('2%'),
        paddingHorizontal: wp('4%'),
        borderWidth: hp('0.15%'),
        borderColor: 'rgba(255,255,255,0.04)',
        gap: wp('4%')
    },
    partStatBox: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('3%')
    },
    partIconBg: {
        width: wp('10%'),
        height: wp('10%'),
        borderRadius: wp('3%'),
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: hp('0.15%'),
        borderColor: 'rgba(255,255,255,0.03)'
    },
    partNumber: {
        fontSize: hp('2.2%'),
        fontFamily: 'Outfit-Black',
        color: '#FFF',
        lineHeight: hp('2.6%')
    },
    partLabel: {
        fontSize: hp('1.1%'),
        fontFamily: 'Outfit-Bold',
        color: '#666'
    },

    healthBasedOnCard: { backgroundColor: '#0A0A0A', padding: wp('5%'), borderRadius: wp('5%'), borderWidth: hp('0.15%'), borderColor: '#1A1A1A' },
    healthBasedOnTitle: { color: '#FFF', fontSize: hp('1.8%'), fontFamily: 'Outfit-Bold', marginBottom: hp('1.5%') },
    healthBasedOnItem: { color: '#8E8E93', fontSize: hp('1.5%'), fontFamily: 'Outfit-Medium', marginBottom: hp('0.8%') },
    healthComponentsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('3%') },
    healthComponentBox: {
        flex: 1, minWidth: wp('28%'), backgroundColor: '#111', padding: wp('4.4%'), borderRadius: wp('5%'), alignItems: 'center', borderWidth: hp('0.15%'), borderColor: '#222', gap: hp('1%')
    },
    healthComponentLabel: { color: '#8E8E8E', fontSize: hp('1.2%'), fontFamily: 'Outfit-Bold', textTransform: 'uppercase' },
    healthComponentValue: { color: '#FFF', fontSize: hp('2.4%'), fontFamily: 'Outfit-Black' },
    whyScoreRow: { flexDirection: 'row', alignItems: 'center', gap: wp('3%'), backgroundColor: '#111', padding: wp('4.5%'), borderRadius: wp('5%'), borderWidth: hp('0.15%'), borderColor: '#222', marginTop: hp('1%') },
    whyScoreLabel: { flex: 1, color: '#FFF', fontSize: hp('1.6%'), fontFamily: 'Outfit-Medium' },
    whyScoreBody: { backgroundColor: '#0A0A0A', padding: wp('4.5%'), borderRadius: wp('5%'), marginTop: hp('-1%'), borderWidth: hp('0.15%'), borderColor: '#1A1A1A' },
    whyScoreText: { color: '#FFF', fontSize: hp('1.5%'), fontFamily: 'Outfit-Medium', lineHeight: hp('2.2%') },
    explanationItem: { color: '#8E8E93', fontSize: hp('1.4%'), fontFamily: 'Outfit-Regular', lineHeight: hp('2%') },
    nextActionsBody: { gap: hp('1%'), marginTop: hp('-1%') },
    nextActionItem: { backgroundColor: '#0A0A0A', padding: wp('4.5%'), borderRadius: wp('5%'), borderWidth: hp('0.15%'), borderColor: '#1A1A1A' },
    nextActionText: { color: '#FFF', fontSize: hp('1.5%'), fontFamily: 'Outfit-Medium' },
    healthLoadingHint: { color: '#666', fontSize: hp('1.5%'), fontFamily: 'Outfit-Medium', textAlign: 'center', marginTop: hp('2.5%') },

    // RC Details section
    rcInfoSection: { marginTop: hp('3%'), paddingHorizontal: wp('1%') },
    rcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: wp('3%'), marginTop: hp('2%') },
    rcItem: { width: wp('45.5%'), flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: wp('3%'), borderRadius: wp('3%'), borderWidth: hp('0.15%'), borderColor: '#222' },
    rcItemLabel: { fontSize: hp('1.2%'), color: '#666', fontFamily: 'Outfit-Medium' },
    rcItemValue: { fontSize: hp('1.7%'), color: '#FFF', fontFamily: 'Outfit-Bold', marginTop: hp('0.15%') },

    detailsSpecsContainer: { gap: hp('2%'), marginTop: hp('1.2%') },

    // Viewer Styles (Ported)
    viewerContainer: { flex: 1, backgroundColor: '#000' },
    viewerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: wp('6%'),
        paddingVertical: hp('2%'),
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A'
    },
    viewerHeaderLeft: { flex: 1 },
    viewerHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    viewerTitle: { color: '#FFF', fontSize: hp('2.5%'), fontFamily: 'Outfit-Bold', textTransform: 'lowercase' },
    viewerSubtitle: { color: '#8E8E93', fontSize: hp('1.5%'), fontFamily: 'Outfit-Medium', marginTop: hp('0.25%'), textTransform: 'uppercase' },
    viewerHeaderIcon: { padding: wp('1%') },
    viewerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: wp('6%') },
    fullImage: { width: '100%', height: '100%' },
    viewerPlaceholder: { alignItems: 'center' },
    placeholderText: { color: '#444', marginTop: hp('2%'), fontFamily: 'Outfit-Medium' },
    viewerFooter: {
        flexDirection: 'row',
        gap: wp('3%'),
        paddingHorizontal: wp('6%'),
        paddingBottom: Platform.OS === 'ios' ? hp('5%') : hp('3%'),
        paddingTop: hp('2%'),
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
        backgroundColor: '#000'
    },
    viewerActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: wp('2.5%'),
        backgroundColor: '#1A1A1A',
        paddingVertical: hp('2%'),
        borderRadius: wp('3.5%'),
        borderWidth: hp('0.15%'),
        borderColor: '#333'
    },
    viewerActionBtnOutline: {
        backgroundColor: 'transparent',
        borderColor: '#333'
    },
    viewerActionText: { color: '#FFF', fontSize: hp('1.6%'), fontFamily: 'Outfit-Bold' },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
    },

    // Documents Tab Styles
    documentsTab: {
        gap: hp('2%')
    },
    certificate: {
        backgroundColor: '#FFF',
        borderRadius: wp('4%'),
        padding: wp('5%'),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: hp('0.5%') },
        shadowOpacity: 0.1,
        shadowRadius: wp('2.5%'),
        elevation: 5
    },
    certHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: hp('2%'),
        borderBottomWidth: hp('0.15%'),
        borderBottomColor: '#EEE',
        paddingBottom: hp('1.5%')
    },
    certHeaderTitleCol: {
        flex: 1
    },
    certTitleLine1: {
        fontSize: hp('1.2%'),
        color: '#8E8E93',
        fontFamily: 'Outfit-Bold',
        letterSpacing: wp('0.5%')
    },
    certTitleLine2: {
        fontSize: hp('1.8%'),
        color: '#000',
        fontFamily: 'Outfit-Black',
        marginTop: hp('0.25%')
    },
    certShareBtn: {
        width: wp('9%'),
        height: wp('9%'),
        borderRadius: wp('4.5%'),
        backgroundColor: 'rgba(255, 215, 0, 0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    certPlateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8F8F8',
        padding: wp('3%'),
        borderRadius: wp('2%'),
        marginBottom: hp('2%')
    },
    certPlateText: {
        fontSize: hp('2.2%'),
        color: '#000',
        fontFamily: 'Outfit-Bold',
        letterSpacing: wp('0.25%')
    },
    certStatusBadge: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: wp('2%'),
        paddingVertical: hp('0.5%'),
        borderRadius: wp('1%')
    },
    certStatusText: {
        fontSize: hp('1.2%'),
        color: '#2E7D32',
        fontFamily: 'Outfit-Bold'
    },
    certInfoGrid: {
        gap: hp('1%'),
        marginBottom: hp('2.5%')
    },
    certRow: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    certLabel: {
        fontSize: hp('1.2%'),
        color: '#8E8E93',
        fontFamily: 'Outfit-Bold'
    },
    certValue: {
        fontSize: hp('1.5%'),
        color: '#000',
        fontFamily: 'Outfit-Bold'
    },
    certViewDetailsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        paddingVertical: hp('1.5%'),
        borderRadius: wp('2%'),
        gap: wp('2%')
    },
    certViewDetailsText: {
        color: '#FFF',
        fontSize: hp('1.2%'),
        fontFamily: 'Outfit-Black',
        letterSpacing: wp('0.25%')
    },
    otherDocsList: {
        marginTop: hp('2%'),
        gap: hp('1.5%')
    },
    subSectionTitle: {
        fontSize: hp('1.5%'),
        fontFamily: 'Outfit-Bold',
        color: '#8E8E93',
        letterSpacing: wp('0.25%'),
        marginBottom: hp('0.5%')
    },
    otherDocRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surface,
        padding: wp('4%'),
        borderRadius: wp('5%'),
        borderWidth: hp('0.15%'),
        borderColor: COLORS.border
    },
    otherDocLabel: {
        color: '#FFF',
        fontSize: hp('1.8%'),
        fontFamily: 'Outfit-Bold'
    },
    otherDocValue: {
        color: '#8E8E93',
        fontSize: hp('1.4%'),
        fontFamily: 'Outfit-Medium',
        marginTop: hp('0.25%')
    },

    // Formal Certificate Styles
    formalCertContainer: {
        width: wp('92%'),
        padding: wp('1%'),
        alignSelf: 'center'
    },
    formalCert: {
        backgroundColor: '#FFF',
        borderRadius: wp('3%'),
        padding: wp('6%'),
        shadowColor: '#000',
        shadowOffset: { width: 0, height: hp('1.2%') },
        shadowOpacity: 0.2,
        shadowRadius: wp('5%'),
        elevation: 15
    },
    formalCertHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: hp('2.5%'),
        position: 'relative',
        paddingBottom: hp('3%')
    },
    formalLionLogo: {
        width: wp('12%'),
        height: wp('12%'),
        marginRight: wp('4%')
    },
    formalTitleCol: {
        flex: 1
    },
    formalCertTitle: {
        fontSize: hp('1.8%'),
        color: '#000',
        fontFamily: 'Outfit-Bold',
        textTransform: 'uppercase'
    },
    formalCertSubtitle: {
        fontSize: hp('1.1%'),
        color: '#666',
        fontFamily: 'Outfit-Medium',
        marginTop: hp('0.25%')
    },
    formalCertDivider: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: hp('0.25%'),
        backgroundColor: '#333'
    },
    formalCertMeta: {
        marginBottom: hp('2.5%')
    },
    formalCertMetaRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: hp('1.8%'),
        borderBottomWidth: hp('0.1%'),
        borderBottomColor: '#F0F0F0',
        paddingBottom: hp('0.6%')
    },
    formalCertMetaLabel: {
        fontSize: hp('1.1%'),
        color: '#666',
        fontFamily: 'Outfit-Medium',
        textTransform: 'uppercase'
    },
    formalCertMetaValue: {
        fontSize: hp('1.4%'),
        color: '#000',
        fontFamily: 'Outfit-Black',
        marginTop: hp('0.12%')
    },
    formalCertMetaLabelSmall: {
        fontSize: hp('1%'),
        color: '#666',
        fontFamily: 'Outfit-Medium'
    },
    formalCertMetaValueSmall: {
        fontSize: hp('1.2%'),
        color: '#000',
        fontFamily: 'Outfit-Bold'
    },
    formalCertInfoGrid: {
        paddingTop: hp('0.6%'),
        marginBottom: hp('3%')
    },
    formalCertInfoLayout: {
        flexDirection: 'row',
        justifyContent: 'space-between'
    },
    formalCertCols: {
        flex: 1,
        gap: hp('1.5%')
    },
    formalCertRow: {
        flexDirection: 'row',
        alignItems: 'flex-start'
    },
    formalCertLabel: {
        width: wp('22%'),
        fontSize: hp('1.2%'),
        color: '#444',
        fontFamily: 'Outfit-Bold'
    },
    formalCertSep: {
        width: wp('3%'),
        fontSize: hp('1.2%'),
        color: '#444'
    },
    formalCertValue: {
        flex: 1,
        fontSize: hp('1.2%'),
        color: '#000',
        fontFamily: 'Outfit-Black'
    },
    formalCertFooter: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        alignItems: 'center',
        borderTopWidth: hp('0.1%'),
        borderTopColor: '#F0F0F0',
        paddingTop: hp('1.8%')
    },
    formalCertNoteBox: {
        alignItems: 'flex-end',
        gap: hp('0.7%')
    },
    formalCertPowered: {
        fontSize: hp('1.1%'),
        color: '#6366F1',
        fontFamily: 'Outfit-Black',
        textTransform: 'uppercase'
    },
    formalCertSignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: wp('1%'),
        borderWidth: hp('0.15%'),
        borderColor: '#22C55E',
        paddingHorizontal: wp('2.5%'),
        paddingVertical: hp('0.8%'),
        borderRadius: wp('1.5%'),
        backgroundColor: '#F0FDF4'
    },
    formalCertSignedText: {
        fontSize: hp('1%'),
        color: '#166534',
        fontFamily: 'Outfit-Medium'
    },
    formalCertSignedDate: {
        fontSize: hp('1%'),
        color: '#166534',
        fontFamily: 'Outfit-Black'
    }
});
