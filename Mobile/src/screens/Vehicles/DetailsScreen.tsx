import React, { useEffect, useState, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image, ScrollView,
    StyleSheet, ActivityIndicator, Alert, Dimensions, Modal, Platform, PermissionsAndroid
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { generatePDF as convertToPDF } from 'react-native-html-to-pdf';
import RNShareCustom from 'react-native-share';
import RNFS from 'react-native-fs';

const { width } = Dimensions.get('window');

import {
    Trash2, FileText, Wrench, AlertCircle, User, Settings,
    ShieldCheck, Droplets, Cpu, CheckCircle2, Star, Tag, Gauge,
    Clock, FileCheck, Activity, IdCard, Weight, Building, Plus, Type,
    Calendar, Bookmark, Upload, X, Download, Share2, Info, ChevronUp, ChevronDown, Hash
} from 'lucide-react-native';

import BackButton from '../../components/BackButton';
import { useNavigation, useFocusEffect } from '../../lib/react-navigation-native';
import type { NativeStackNavigationProp } from '../../lib/react-navigation-native-stack';
import type { RootStackParamList } from '../../navigation/types';
import { COLORS, FALLBACK_IMAGE, InfoCard, INDPlate, GloveboxItem, StatusCard } from '../../components/Vehicles/VehicleUI';
import { Vehicle, vehicleService } from '../../services/vehicleService';
import { api } from '../../services/api';
import ShareScreen from './Share';
import { getProfile } from '../../services/profileService';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { RootState } from '../../store';
import { fetchDocuments, removeDocumentAsync } from '../../store/slices/documentsSlice';

const CarImage = require('../../assets/images/car_vehicle_demo.png') as any;
const BikeImage = require('../../assets/images/bike.png') as any;

type DetailsScreenProps = {
    vehicles: Vehicle[];
    activeVehicle: Vehicle | null;
    setActiveVehicle: (v: Vehicle) => void;
    onBack: () => void;
    onAddNew: () => void;
    onDelete: (id: string) => void;
    onSetPrimary: (id: string) => void;
};

type MainTab = 'Alerts' | 'Details';
type SubTab = 'Health' | 'Owner' | 'Vehicle' | 'More';

export const DetailsScreen = ({
    vehicles, activeVehicle, setActiveVehicle, onBack, onAddNew, onDelete, onSetPrimary
}: DetailsScreenProps) => {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [mainTab, setMainTab] = useState<MainTab>('Alerts');
    const [subTab, setSubTab] = useState<SubTab>('Health');
    const [healthScoreDetail, setHealthScoreDetail] = useState<{
        overallScore?: number;
        scoreChangeReason?: string;
        components?: { name: string; score: number | null; label: string }[];
        recommendations?: string[];
        explanations?: string[];
    } | null>(null);
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

    if (!activeVehicle) return null;

    // rtoDetails comes from the Gemini lookup, merged into the vehicle object
    // by AddVehicleScreen → onDone → GupioGarageApp state.
    const rto = activeVehicle.rtoDetails || activeVehicle;

    // Hero image source
    const heroSrc = activeVehicle.vehicleType === 'BIKE' ? BikeImage : CarImage;

    const handleFeedbackSubmit = () => {
        if (!rating) return;
        setIsSubmitting(true);
        setTimeout(() => {
            setSubmittedFeedback({ rating, text: feedback });
            setIsSubmitting(false);
            setRating(0);
            setFeedback('');
        }, 1500);
    };

    const handleDeletePress = () => {
        Alert.alert(
            'Remove Vehicle',
            `Remove ${activeVehicle.registrationNumber} from your garage?`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => onDelete(activeVehicle.id) },
            ]
        );
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
        if (!doc?.imageUri) return;
        try {
            setIsProcessing(true);
            const pdfPath = await createPDFFromImage(doc);
            
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
            Alert.alert('Error', 'Could not share document as PDF. Please try again.');
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
            Alert.alert('Success', `Document downloaded successfully! You can find it in your Downloads folder as ${fileName}`);
        } catch (error: any) {
            setIsProcessing(false);
            Alert.alert('Error', error.message || 'Could not download document as PDF');
        }
    };

    const handleDeleteDoc = async (id: string, type: string) => {
        Alert.alert(
            'Delete Document',
            `Are you sure you want to delete your ${type}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await dispatch(removeDocumentAsync(id)).unwrap();
                            setShowViewerModal(false);
                            Alert.alert('Success', `${type} deleted successfully`);
                        } catch (err: any) {
                            Alert.alert('Error', err.message || 'Failed to delete');
                        }
                    }
                }
            ]
        );
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
        <View style={styles.screen}>
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

                <View style={{ flexDirection: 'row', gap: 8 }}>
                    {currentCustomerId && activeVehicle.customerId === currentCustomerId && (
                        <TouchableOpacity onPress={openShare} style={styles.topRoundBtn}>
                            <User size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity onPress={handleDeletePress} style={styles.topRoundBtn}>
                        <Trash2 size={22} color="#FF453A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {/* ── Hero section as per mockup ── */}
                <View style={styles.heroSection}>
                    <Image
                        source={heroSrc}
                        style={styles.heroImage}
                        resizeMode="contain"
                        onError={() => setHeroError(true)}
                    />

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
                        <TouchableOpacity
                            style={styles.setPrimaryBtn}
                            onPress={() => onSetPrimary(activeVehicle.id)}
                        >
                            <Star size={14} color={COLORS.primary} />
                            <Text style={styles.setPrimaryBtnText}>SET AS PRIMARY</Text>
                        </TouchableOpacity>
                    )}

                    {/* ── Vehicle switcher circle icons ── */}
                    <View style={styles.switcherRow}>
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
                                            source={v.vehicleType === 'BIKE' ? BikeImage : CarImage}
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
                    </View>
                </View>

                {/* ── Tab Content ── */}
                <View style={styles.sectionPad}>
                    {mainTab === 'Alerts' ? (
                        <>
                            {/* ── Status Grid (Challans & PUCC) ── */}
                            <View style={styles.statusGrid}>
                                <StatusCard
                                    icon={FileText}
                                    label="challans"
                                    value="CHECK NOW"
                                />
                                <StatusCard
                                    icon={ShieldCheck}
                                    label="PUCC"
                                    value="ACTIVE"
                                />
                            </View>



                            {/* ── Your GloverBox ── */}
                            <View style={{ marginTop: 32 }}>
                                <Text style={styles.sectionHeading}>YOUR GLOVERBOX</Text>
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
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                 contentContainerStyle={[styles.subTabNav, { flexGrow: 1, justifyContent: 'center' }]}
                             >
                                 {(['Health', 'Owner', 'Vehicle', 'More'] as SubTab[]).map(st => (
                                    <TouchableOpacity
                                        key={st}
                                        onPress={() => setSubTab(st)}
                                        style={[styles.subTabItem, subTab === st && styles.subTabItemActive]}
                                    >
                                        <Text style={[styles.subTabText, subTab === st && styles.subTabTextActive]}>
                                            {st}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={{ gap: 16 }}>
                                {subTab === 'Health' && (
                                    <>
                                        <View style={styles.healthScoreCard}>
                                            <Text style={styles.healthScoreValue}>
                                                {healthScoreDetail?.overallScore ?? activeVehicle.healthScore?.overallScore ?? '—'}
                                            </Text>
                                            <Text style={styles.healthScoreLabel}>/ 100 Health</Text>
                                        </View>
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
                                                        <Text style={styles.healthComponentLabel}>{c.label}</Text>
                                                        <Text style={styles.healthComponentValue}>{c.score != null ? c.score : '—'}%</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                        {(healthScoreDetail?.scoreChangeReason || healthScoreDetail?.explanations?.length) ? (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.whyScoreRow}
                                                    onPress={() => setExpandWhyScore((v) => !v)}
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
                                                            healthScoreDetail.explanations.slice(1, 4).map((e: string, i: number) => (
                                                                <Text key={i} style={styles.explanationItem}>• {e}</Text>
                                                            ))
                                                        )}
                                                    </View>
                                                )}
                                            </>
                                        ) : null}
                                        {healthScoreDetail?.recommendations && healthScoreDetail.recommendations.length > 0 && (
                                            <>
                                                <TouchableOpacity
                                                    style={styles.whyScoreRow}
                                                    onPress={() => setExpandNextActions((v) => !v)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Activity size={18} color={COLORS.primary} />
                                                    <Text style={styles.whyScoreLabel}>What to do next</Text>
                                                    {expandNextActions ? <ChevronUp size={18} color="#888" /> : <ChevronDown size={18} color="#888" />}
                                                </TouchableOpacity>
                                                {expandNextActions && (
                                                    <View style={styles.nextActionsBody}>
                                                        {healthScoreDetail.recommendations.map((r: string, i: number) => (
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
                                        <InfoCard icon={User} label="Owner Name" value={rto?.ownerName || 'Unknown'} />
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
                                    </>
                                )}
                                {subTab === 'More' && (
                                    <>
                                        <InfoCard icon={Tag} label="Registration Number" value={rto?.registrationNumber || activeVehicle.registrationNumber || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="RC Status" value={rto?.rcStatus || 'ACTIVE'} />
                                        <InfoCard icon={Clock} label="RC Expiry" value={rto?.fitnessUpto || 'N/A'} />
                                        <InfoCard icon={ShieldCheck} label="Insurance Upto" value={rto?.insuranceUpto || 'N/A'} />
                                    </>
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
                                style={[styles.viewerHeaderIcon, { marginLeft: 16 }]}
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
                        {viewingDoc?.imageUri ? (
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
        </View>
    );
};

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#000000' },
    header: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 20, minHeight: 80 },
    topRoundBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    tabPillContainer: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 30,
        padding: 4,
        borderWidth: 1,
        borderColor: COLORS.border,
        width: 180,
        marginHorizontal: 16
    },
    tabPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 30 },
    tabPillActive: { backgroundColor: COLORS.primary },
    tabPillText: { fontSize: 12, fontFamily: 'Outfit-Black', color: '#888' },

    // Hero Section
    heroSection: { alignItems: 'center', paddingBottom: 16 },
    heroImage: { width: width * 0.8, height: 160, marginBottom: -10 },
    brandName: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 4, textTransform: 'uppercase' },
    modelName: { fontSize: 32, fontWeight: '900', color: '#FFF', marginTop: -5 },
    heroPlateBox: { marginTop: 12 },

    // Switcher Row
    switcherRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 40, paddingHorizontal: 24 },
    addCircleBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255, 215, 0, 0.05)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.2)' },
    miniCircleWrap: { alignItems: 'center', gap: 4 },
    miniCircleInner: { width: 64, height: 64, borderRadius: 32, padding: 4, borderWidth: 2, borderColor: '#333', backgroundColor: '#1A1A1A', overflow: 'hidden' },
    miniCircleActive: { transform: [{ scale: 1.1 }] },
    miniModelOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 32 },
    miniModelText: { color: '#FFF', fontSize: 10, fontFamily: 'Outfit-Black', textAlign: 'center', paddingHorizontal: 4 },
    activeMiniLabel: { fontSize: 8, fontFamily: 'Outfit-Bold', color: '#888', position: 'absolute', bottom: -18, textAlign: 'center', width: 80 },
    miniPrimaryIndicator: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: COLORS.primary,
        width: 18,
        height: 18,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#000'
    },

    primaryBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 16
    },
    primaryBadgeText: {
        color: '#000',
        fontSize: 11,
        fontFamily: 'Outfit-Black',
        letterSpacing: 0.5
    },
    setPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        marginTop: 16
    },
    setPrimaryBtnText: {
        color: COLORS.primary,
        fontSize: 11,
        fontFamily: 'Outfit-Bold'
    },

    sectionPad: { paddingHorizontal: 24, paddingTop: 20 },
    sectionHeading: { fontSize: 10, fontFamily: 'Outfit-Bold', color: '#8E8E93', letterSpacing: 1.5, marginBottom: 16 },

    // Status Boxes
    statusGrid: { flexDirection: 'row', gap: 12 },
    statusBox: {
        flex: 1, backgroundColor: '#0A0A0A', padding: 24, borderRadius: 24,
        flexDirection: 'column', alignItems: 'center', gap: 16,
        borderWidth: 1, borderColor: '#1F1F1F'
    },



    // Glovebox
    gloveboxGrid: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
    gloveboxItem: { width: (width - 84) / 4, alignItems: 'center', gap: 8 },
    gloveboxIconBox: { width: '100%', aspectRatio: 1, backgroundColor: '#1A1A1A', borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#333' },
    gloveboxLabel: { color: '#AAA', fontSize: 10, fontWeight: '600', textAlign: 'center', fontFamily: 'Outfit' },
    gloveboxPreview: { width: '100%', height: '100%', borderRadius: 16 },
    viewAllDocsBtn: { marginTop: 24, borderWidth: 1, borderColor: '#333', borderRadius: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: '#1A1A1A' },
    viewAllDocsText: { color: COLORS.primary, fontSize: 13, fontFamily: 'Outfit-Black', textTransform: 'uppercase', letterSpacing: 1.5 },

    // Health Score Styles
    healthScoreCard: {
        backgroundColor: '#111',
        padding: 24,
        borderRadius: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222'
    },
    healthScoreValue: {
        color: COLORS.primary,
        fontSize: 48,
        fontFamily: 'Outfit-Black'
    },
    healthScoreLabel: {
        color: '#8E8E93',
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        marginTop: -5
    },
    healthBasedOnCard: {
        backgroundColor: '#0A0A0A',
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#1A1A1A'
    },
    healthBasedOnTitle: {
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Outfit-Bold',
        marginBottom: 12
    },
    healthBasedOnItem: {
        color: '#8E8E93',
        fontSize: 12,
        fontFamily: 'Outfit-Medium',
        marginBottom: 6
    },
    healthComponentsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12
    },
    healthComponentBox: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222'
    },
    healthComponentLabel: {
        color: '#8E8E93',
        fontSize: 10,
        fontFamily: 'Outfit-Bold',
        textTransform: 'uppercase',
        marginBottom: 4
    },
    healthComponentValue: {
        color: '#FFF',
        fontSize: 16,
        fontFamily: 'Outfit-Black'
    },
    whyScoreRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#222'
    },
    whyScoreLabel: {
        flex: 1,
        color: '#FFF',
        fontSize: 14,
        fontFamily: 'Outfit-Medium'
    },
    whyScoreBody: {
        backgroundColor: '#0A0A0A',
        padding: 16,
        borderRadius: 16,
        marginTop: -8,
        borderWidth: 1,
        borderColor: '#1A1A1A',
        gap: 8
    },
    whyScoreText: {
        color: '#FFF',
        fontSize: 13,
        fontFamily: 'Outfit-Medium',
        lineHeight: 20
    },
    explanationItem: {
        color: '#8E8E93',
        fontSize: 12,
        fontFamily: 'Outfit-Regular',
        lineHeight: 18
    },
    nextActionsBody: {
        gap: 12,
        marginTop: -8
    },
    nextActionItem: {
        backgroundColor: '#0A0A0A',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#1A1A1A'
    },
    nextActionText: {
        color: '#FFF',
        fontSize: 13,
        fontFamily: 'Outfit-Medium'
    },
    healthLoadingHint: {
        color: '#666',
        fontSize: 12,
        fontFamily: 'Outfit-Medium',
        textAlign: 'center',
        marginTop: 20
    },

    // Details Sub-Tabs
    subTabNav: { paddingBottom: 16, gap: 12, width: '100%' },
    subTabItem: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
    subTabItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    subTabText: { fontSize: 13, fontFamily: 'Outfit-Bold', color: '#888' },
    subTabTextActive: { color: '#000' },

    // RC Details section
    rcInfoSection: { marginTop: 24, paddingHorizontal: 4 },
    rcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
    rcItem: { width: '47%', flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#222' },
    rcItemLabel: { fontSize: 10, color: '#666', fontFamily: 'Outfit-Medium' },
    rcItemValue: { fontSize: 13, color: '#FFF', fontFamily: 'Outfit-Bold', marginTop: 1 },

    detailsSpecsContainer: { gap: 16, marginTop: 10 },

    // Viewer Styles (Ported)
    viewerContainer: { flex: 1, backgroundColor: '#000' },
    viewerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#1A1A1A'
    },
    viewerHeaderLeft: { flex: 1 },
    viewerHeaderRight: { flexDirection: 'row', alignItems: 'center' },
    viewerTitle: { color: '#FFF', fontSize: 20, fontFamily: 'Outfit-Bold', textTransform: 'lowercase' },
    viewerSubtitle: { color: '#8E8E93', fontSize: 12, fontFamily: 'Outfit-Medium', marginTop: 2, textTransform: 'uppercase' },
    viewerHeaderIcon: { padding: 4 },
    viewerContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    fullImage: { width: '100%', height: '100%' },
    viewerPlaceholder: { alignItems: 'center' },
    placeholderText: { color: '#444', marginTop: 16, fontFamily: 'Outfit-Medium' },
    viewerFooter: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 24,
        paddingBottom: Platform.OS === 'ios' ? 40 : 24,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#1A1A1A',
        backgroundColor: '#000'
    },
    viewerActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#1A1A1A',
        paddingVertical: 16,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#333'
    },
    viewerActionBtnOutline: {
        backgroundColor: 'transparent',
        borderColor: '#333'
    },
    viewerActionText: { color: '#FFF', fontSize: 13, fontFamily: 'Outfit-Bold' },
    loaderOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
    }
});
