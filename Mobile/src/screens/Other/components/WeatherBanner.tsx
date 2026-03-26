import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CloudRain, Sun, Cloud, Thermometer } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const WeatherBanner = ({ planning, onChange }: Props) => {
  // Simple mock: if it's "relaxation" or "culture", assume clear. If they're in Pune (dummy), etc.
  const isRainy = planning.preferences?.includes('relaxation'); // Mock logic

  return (
    <View style={styles.container}>
      <View style={styles.banner}>
        <View style={styles.weatherInfo}>
          {isRainy ? <CloudRain size={32} color="#4A90E2" /> : <Sun size={32} color="#FFD700" />}
          <View style={styles.textGroup}>
            <Text style={styles.temp}>24°C</Text>
            <Text style={styles.condition}>{isRainy ? 'Occasional Showers' : 'Mostly Sunny'}</Text>
          </View>
        </View>
        <View style={styles.verticalDivider} />
        <View style={styles.advice}>
          <Text style={styles.adviceTitle}>Smart Tip</Text>
          <Text style={styles.adviceText}>
            {isRainy 
              ? 'Rain forecast: We recommend more indoor activities like museums and dining.' 
              : 'Clear skies: Perfect for outdoor trekking and street food exploration.'}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { padding: 10 },
  banner: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#222',
    alignItems: 'center',
  },
  weatherInfo: { alignItems: 'center', minWidth: 80 },
  textGroup: { alignItems: 'center', marginTop: 8 },
  temp: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  condition: { color: '#888', fontSize: 10, textAlign: 'center' },
  verticalDivider: { width: 1, height: '80%', backgroundColor: '#222', marginHorizontal: 15 },
  advice: { flex: 1 },
  adviceTitle: { color: '#FFD700', fontSize: 13, fontWeight: 'bold', marginBottom: 4 },
  adviceText: { color: '#BBB', fontSize: 11, lineHeight: 16 },
});

export default WeatherBanner;
