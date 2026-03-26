import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import { User, Users, Heart, Home } from 'lucide-react-native';
import { PlanningState, TravelerType } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const travelerTypes: { id: TravelerType; label: string; icon: any }[] = [
  { id: 'solo', label: 'Solo', icon: User },
  { id: 'couple', label: 'Couple', icon: Heart },
  { id: 'family', label: 'Family', icon: Home },
  { id: 'friends', label: 'Friends', icon: Users },
];

const TravelerConfig = ({ planning, onChange }: Props) => {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Who are you planning for?</Text>
      <View style={styles.grid}>
        {travelerTypes.map((item) => {
          const IconComp = item.icon;
          const isActive = planning.travelerType === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, isActive && styles.activeCard]}
              onPress={() => onChange({ travelerType: item.id })}
            >
              <View style={[styles.iconBox, isActive && styles.activeIconBox]}>
                <IconComp size={22} color={isActive ? '#000' : '#FFD700'} />
              </View>
              <Text style={[styles.cardLabel, isActive && styles.activeCardLabel]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.label, { marginTop: 30 }]}>Number of People</Text>
      <View style={styles.inputWrapper}>
        <Users size={18} color="#FFD700" />
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="Enter count"
          placeholderTextColor="#666"
          value={planning.numberOfPeople?.toString() || ''}
          onChangeText={(t) => onChange({ numberOfPeople: parseInt(t) || 0 })}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  label: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '48%',
    backgroundColor: '#111',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  activeCard: { backgroundColor: '#FFD700', borderColor: '#FFD700' },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeIconBox: { backgroundColor: 'rgba(0, 0, 0, 0.1)' },
  cardLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  activeCardLabel: { color: '#000' },
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
});

export default TravelerConfig;
