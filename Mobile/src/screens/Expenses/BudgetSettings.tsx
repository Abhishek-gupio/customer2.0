import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    TextInput,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { widthPercentageToDP as wp } from 'react-native-responsive-screen';
import StatusModal from '../../components/common/Modals/StatusModal';
import { api } from '../../services/api';
import BackButton from '../../components/BackButton';
import type { RootStackParamList } from '../../navigation/types';

type BudgetSettingsRouteProp = RouteProp<RootStackParamList, 'BudgetSettings'>;

const CATEGORIES = [
    { id: 'FUEL', label: 'Fuel', icon: 'water-outline' },
    { id: 'SERVICE', label: 'Service & Maintenance', icon: 'build-outline' },
    { id: 'TOLL', label: 'Tolls', icon: 'card-outline' },
    { id: 'INSURANCE', label: 'Insurance', icon: 'shield-checkmark-outline' },
    { id: 'PARKING', label: 'Parking', icon: 'car-outline' },
    { id: 'CHALLAN', label: 'Challans/Fines', icon: 'document-text-outline' },
    { id: 'EMI', label: 'Vehicle EMI', icon: 'cash-outline' },
    { id: 'REPAIR', label: 'Repairs', icon: 'hammer-outline' },
    { id: 'OTHER', label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

const PERIODS = [
    { id: 'WEEKLY', label: 'Weekly' },
    { id: 'MONTHLY', label: 'Monthly' },
];

export default function BudgetSettings() {
    const navigation = useNavigation();
    const route = useRoute<BudgetSettingsRouteProp>();
    const [loading, setLoading] = useState(false);

    // Display-seed from voice-set params only — the voice-action framework already committed
    // the budget server-side before navigating here, so this never re-submits on mount.
    const [selectedCategory, setSelectedCategory] = useState<string>(
        route.params?.initialCategory || 'FUEL',
    );
    const [amount, setAmount] = useState<string>(
        route.params?.initialAmount != null ? String(route.params.initialAmount) : '',
    );
    const [period, setPeriod] = useState<'WEEKLY' | 'MONTHLY'>('MONTHLY');
    const [notifyThreshold, setNotifyThreshold] = useState<string>('80');
    const [statusModal, setStatusModal] = useState({
        visible: false,
        type: 'success' as 'success' | 'delete' | 'error',
        title: '',
        message: '',
    });
    const showStatus = (title: string, message: string, type: 'success' | 'delete' | 'error' = 'success') => {
        setStatusModal({ visible: true, type, title, message });
    };

    useEffect(() => {
        if (route.params?.justSetViaVoice) {
            showStatus('Budget updated', 'Set via voice command.', 'success');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSaveBudget = async () => {
        if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
            showStatus('Invalid Amount', 'Please enter a valid amount.', 'error');
            return;
        }

        if (!notifyThreshold || isNaN(Number(notifyThreshold)) || Number(notifyThreshold) < 1 || Number(notifyThreshold) > 100) {
            showStatus('Invalid Threshold', 'Please enter a valid notification threshold between 1 and 100.', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/v1/expenses/budgets', {
                category: selectedCategory,
                amount: Number(amount),
                period: period,
                notifyThreshold: Number(notifyThreshold),
            });

            const resData = response as any;
            const result = resData?.data?.data ?? resData?.data ?? resData;

            if (result?.success || result?.id) {
                showStatus('Success', 'Budget saved successfully!');
                setTimeout(() => navigation.goBack(), 1500);
            } else {
                throw new Error(result?.error?.message || 'Unknown error occurred');
            }
        } catch (error: any) {
            console.error('Save budget error:', error);
            showStatus('Error', error?.message || 'Failed to save budget. Please try again.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <View style={styles.header}>
                <BackButton onPress={() => navigation.goBack()} />
                <Text style={styles.headerTitle}>Set Budget</Text>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <Text style={styles.sectionTitle}>Category</Text>
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.categoriesContainer}
                    contentContainerStyle={{ paddingRight: 20 }}
                >
                    {CATEGORIES.map((cat) => (
                        <TouchableOpacity
                            key={cat.id}
                            style={[
                                styles.categoryChip,
                                selectedCategory === cat.id && styles.categoryChipSelected,
                            ]}
                            onPress={() => setSelectedCategory(cat.id)}
                        >
                            <Ionicons
                                name={cat.icon}
                                size={20}
                                color={selectedCategory === cat.id ? '#fff' : '#888'}
                                style={styles.categoryIcon}
                            />
                            <Text
                                style={[
                                    styles.categoryText,
                                    selectedCategory === cat.id && styles.categoryTextSelected,
                                ]}
                            >
                                {cat.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.sectionTitle}>Budget Amount (₹)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={setAmount}
                    maxLength={10}
                />

                <Text style={styles.sectionTitle}>Budget Period</Text>
                <View style={styles.periodsContainer}>
                    {PERIODS.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            style={[
                                styles.periodChip,
                                period === p.id && styles.periodChipSelected,
                            ]}
                            onPress={() => setPeriod(p.id as 'WEEKLY' | 'MONTHLY')}
                        >
                            <Text
                                style={[
                                    styles.periodText,
                                    period === p.id && styles.periodTextSelected,
                                ]}
                            >
                                {p.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Alert Threshold (%)</Text>
                <Text style={styles.helpText}>
                    We'll notify you when your spending reaches this percentage of the budget.
                </Text>
                <TextInput
                    style={styles.input}
                    placeholder="80"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={notifyThreshold}
                    onChangeText={setNotifyThreshold}
                    maxLength={3}
                />

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSaveBudget}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <>
                            <Text style={styles.saveBtnText}>Save Budget</Text>
                            <Ionicons name="checkmark" size={20} color="#000" />
                        </>
                    )}
                </TouchableOpacity>
            </ScrollView>

            <StatusModal
                visible={statusModal.visible}
                type={statusModal.type}
                title={statusModal.title}
                message={statusModal.message}
                onClose={() => setStatusModal(prev => ({ ...prev, visible: false }))}
            />
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 20,
        paddingBottom: 20,
        backgroundColor: '#1C1C1C',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTitle: {
        flex: 1,
        color: '#fff',
        fontSize: wp(5.5),
        fontWeight: '700',
        marginLeft: 12,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-start',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 12,
    },
    categoriesContainer: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    categoryChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#222',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    categoryChipSelected: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    categoryIcon: {
        marginRight: 8,
    },
    categoryText: {
        color: '#888',
        fontSize: 14,
        fontWeight: '500',
    },
    categoryTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    input: {
        backgroundColor: '#222',
        color: '#fff',
        fontSize: 24,
        fontWeight: '600',
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: '#333',
        marginBottom: 10,
    },
    periodsContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 10,
    },
    periodChip: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: '#222',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
    },
    periodChipSelected: {
        backgroundColor: '#4CAF50',
        borderColor: '#4CAF50',
    },
    periodText: {
        color: '#888',
        fontSize: 15,
        fontWeight: '500',
    },
    periodTextSelected: {
        color: '#fff',
        fontWeight: '600',
    },
    helpText: {
        color: '#666',
        fontSize: 13,
        marginBottom: 12,
        marginTop: -8,
    },
    saveBtn: {
        backgroundColor: '#4CAF50',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        marginTop: 30,
        marginBottom: 50,
    },
    saveBtnText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
        marginRight: 8,
    },
});
