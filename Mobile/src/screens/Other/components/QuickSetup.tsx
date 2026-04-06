import React from 'react';
import { View, StyleSheet } from 'react-native';
import DateSelector from './DateSelector';
import TravelerConfig from './TravelerConfig';
import PreferenceSelector from './PreferenceSelector';
import BudgetInput from './BudgetInput';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const QuickSetup = ({ planning, onChange }: Props) => {
  return (
    <View style={styles.container}>
      <DateSelector planning={planning} onChange={onChange} />
      <View style={styles.divider} />
      
      <TravelerConfig planning={planning} onChange={onChange} />
      <View style={styles.divider} />
      
      <PreferenceSelector planning={planning} onChange={onChange} />
      <View style={styles.divider} />
      
      <BudgetInput planning={planning} onChange={onChange} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginVertical: 20,
    marginHorizontal: 10,
  },
});

export default QuickSetup;
