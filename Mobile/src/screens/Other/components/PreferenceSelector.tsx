import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Compass, Leaf, Landmark, Utensils, Moon } from 'lucide-react-native';
import { PlanningState, Preference } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const preferences: { id: Preference; label: string; icon: any }[] = [
  { id: 'adventure', label: 'Adventure', icon: Compass },
  { id: 'relaxation', label: 'Relaxation', icon: Leaf },
  { id: 'culture', label: 'Culture', icon: Landmark },
  { id: 'food', label: 'Food', icon: Utensils },
  { id: 'nightlife', label: 'Nightlife', icon: Moon },
];

const PreferenceSelector = ({ planning, onChange }: Props) => {
  const togglePreference = (pref: Preference) => {
    const current = planning.preferences || [];
    if (current.includes(pref)) {
      onChange({ preferences: current.filter((p) => p !== pref) });
    } else {
      onChange({ preferences: [...current, pref] });
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>What are you interested in?</Text>
      <View style={styles.chipRow}>
        {preferences.map((item) => {
          const IconComp = item.icon;
          const isActive = planning.preferences?.includes(item.id);
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.chip, isActive && styles.activeChip]}
              onPress={() => togglePreference(item.id)}
            >
              <IconComp size={16} color={isActive ? '#000' : '#FFD700'} />
              <Text style={[styles.chipLabel, isActive && styles.activeChipLabel]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  label: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 30,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  activeChip: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  chipLabel: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  activeChipLabel: { color: '#000' },
});

export default PreferenceSelector;
