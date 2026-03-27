import React from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { Wallet, Info } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const BudgetInput = ({ planning, onChange }: Props) => {
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
          onChangeText={(t) => onChange({ budget: parseFloat(t) || 0 })}
        />
      </View>

      <View style={styles.infoBox}>
        <Info size={16} color="#888" />
        <Text style={styles.infoText}>
          This budget will be used to filter and rank accommodation and activity suggestions.
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 15,
    marginTop: 30,
    gap: 12,
  },
  infoText: { color: '#888', fontSize: 13, flex: 1, lineHeight: 18 },
});

export default BudgetInput;
