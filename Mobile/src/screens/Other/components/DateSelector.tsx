import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Calendar, Clock } from 'lucide-react-native';
import { format, differenceInDays, isBefore, parse } from 'date-fns';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const DateSelector = ({ planning, onChange }: Props) => {
  const handleDateChange = (dateStr: string, type: 'arrival' | 'departure') => {
    const newState: Partial<PlanningState> = {};
    if (type === 'arrival') newState.arrivalDate = dateStr;
    else newState.departureDate = dateStr;

    // Auto-calculate stayDays if both exist
    const arrival = type === 'arrival' ? dateStr : planning.arrivalDate;
    const departure = type === 'departure' ? dateStr : planning.departureDate;

    if (arrival && departure) {
      try {
        const d1 = new Date(arrival);
        const d2 = new Date(departure);
        if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
          if (isBefore(d1, d2) || d1.getTime() === d2.getTime()) {
            newState.stayDays = Math.max(0, differenceInDays(d2, d1));
          }
        }
      } catch (e) {}
    }

    onChange(newState);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Arrival Date</Text>
      <View style={styles.inputWrapper}>
        <Calendar size={18} color="#FFD700" />
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#666"
          value={planning.arrivalDate || ''}
          onChangeText={(t) => handleDateChange(t, 'arrival')}
        />
      </View>

      <Text style={[styles.label, { marginTop: 20 }]}>Departure Date</Text>
      <View style={styles.inputWrapper}>
        <Calendar size={18} color="#FFD700" />
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#666"
          value={planning.departureDate || ''}
          onChangeText={(t) => handleDateChange(t, 'departure')}
        />
      </View>

      {planning.stayDays > 0 && (
        <View style={styles.infoBox}>
          <Clock size={16} color="#FFD700" />
          <Text style={styles.infoText}>Duration: {planning.stayDays} Days Stay</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 8, textTransform: 'uppercase' },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222',
    paddingHorizontal: 12,
    height: 54,
  },
  input: { flex: 1, color: '#FFF', marginLeft: 10, fontSize: 15 },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 12,
    borderRadius: 8,
    marginTop: 20,
    gap: 8,
  },
  infoText: { color: '#FFD700', fontWeight: 'bold', fontSize: 14 },
});

export default DateSelector;
