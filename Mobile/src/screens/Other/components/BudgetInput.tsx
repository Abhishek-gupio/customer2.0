import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Wallet, Info, Hotel, Compass, Bike } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const toBudgetValue = (raw: string) => {
  const normalized = raw.replace(/[^0-9.]/g, '');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const BudgetInput = ({ planning, onChange }: Props) => {
  const renderCategoryBudget = (
    label: string,
    value: number | undefined,
    onChangeValue: (next: number) => void,
    Icon: React.ComponentType<{ size?: number; color?: string }>
  ) => (
    <View style={styles.categoryCard}>
      <View style={styles.categoryHead}>
        <Icon size={14} color="#FFD700" />
        <Text style={styles.categoryLabel}>{label}</Text>
      </View>
      <View style={styles.categoryInputWrap}>
        <Text style={styles.categoryCurrency}>₹</Text>
        <TextInput
          style={styles.categoryInput}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor="#666"
          value={(value || 0) > 0 ? String(value) : ''}
          onChangeText={(text) => onChangeValue(toBudgetValue(text))}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Set your trip budget</Text>
      <View style={styles.inputWrapper}>
        <Wallet size={18} color="#FFD700" />
        <Text style={styles.currencySymbol}>₹</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor="#666"
          value={planning.budget > 0 ? planning.budget.toString() : ''}
          onChangeText={(t) => onChange({ budget: toBudgetValue(t) })}
        />
      </View>

      <Text style={styles.sectionTitle}>Category budgets (optional)</Text>
      <Text style={styles.sectionSubTitle}>Set custom caps for each category.</Text>
      <View style={styles.categoryRow}>
        {renderCategoryBudget('Stay', planning.hotelBudget, (next) => onChange({ hotelBudget: next }), Hotel)}
        {renderCategoryBudget('Activities', planning.activityBudget, (next) => onChange({ activityBudget: next }), Compass)}
        {renderCategoryBudget('Transport', planning.transportBudget, (next) => onChange({ transportBudget: next }), Bike)}
      </View>

      <View style={styles.infoBox}>
        <Info size={16} color="#888" />
        <Text style={styles.infoText}>
          Category budgets are used first. If left empty, total budget is used as fallback.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  label: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 12,
    height: 60,
  },
  currencySymbol: { color: '#FFD700', fontSize: 20, fontWeight: 'bold', marginLeft: 10 },
  input: { flex: 1, color: '#FFF', marginLeft: 8, fontSize: 22, fontWeight: 'bold' },
  sectionTitle: {
    color: '#C8C8C8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: 18,
  },
  sectionSubTitle: {
    color: '#777',
    fontSize: 12,
    marginTop: 5,
    marginBottom: 10,
  },
  categoryRow: {
    gap: 10,
  },
  categoryCard: {
    backgroundColor: '#0F0F0F',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    borderRadius: 12,
    padding: 10,
  },
  categoryHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  categoryLabel: {
    color: '#CFCFCF',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262626',
    paddingHorizontal: 10,
    height: 46,
  },
  categoryCurrency: {
    color: '#FFD700',
    fontSize: 15,
    fontWeight: '700',
  },
  categoryInput: {
    flex: 1,
    color: '#FFF',
    marginLeft: 6,
    fontSize: 16,
    fontWeight: '700',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 15,
    marginTop: 16,
    gap: 12,
  },
  infoText: { color: '#888', fontSize: 13, flex: 1, lineHeight: 18 },
});

export default BudgetInput;
