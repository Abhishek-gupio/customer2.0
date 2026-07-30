import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Calendar, Clock, MapPin, Zap } from 'lucide-react-native';
import { PlanningState } from '../tripPlannerTypes';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
}

const ItineraryGenerator = ({ planning, onChange }: Props) => {
  const days = Array.from({ length: planning.stayDays || 1 }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Your Optimized Day-Wise Plan</Text>
      <ScrollView showsVerticalScrollIndicator={false}>
        {days.map((day) => (
          <View key={day} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}>
                <Text style={styles.dayBadgeText}>DAY {day}</Text>
              </View>
              <Text style={styles.dayTitle}>
                {day === 1 ? 'Arrival & Exploration' : day === days.length ? 'Final Sightseeing & Departure' : 'Immersive Experience'}
              </Text>
            </View>

            <View style={styles.timeline}>
              <TimelineItem time="09:00 AM" activity="Morning Breakfast & Briefing" sub="Local Cafe nearby" icon={Zap} />
              <TimelineItem 
                time="11:30 AM" 
                activity={planning.selectedActivities?.length ? 'Visit Selected Attraction' : 'Local Sightseeing'} 
                sub="Optimized by proximity" 
                icon={MapPin} 
              />
              <TimelineItem time="02:00 PM" activity="Lunch Break" sub="Recommended restaurant" icon={Zap} />
              <TimelineItem time="04:30 PM" activity="Evening Leisure Walk" sub="Market area" icon={Clock} />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const TimelineItem = ({ time, activity, sub, icon: IconComp }: any) => (
  <View style={styles.itemRow}>
    <View style={styles.itemLeft}>
      <Text style={styles.itemTime}>{time}</Text>
      <View style={styles.verticalLine} />
    </View>
    <View style={styles.itemRight}>
      <View style={styles.iconBox}>
        <IconComp size={14} color="#5F9EA0" />
      </View>
      <View style={styles.itemTextGroup}>
        <Text style={styles.itemActivity}>{activity}</Text>
        <Text style={styles.itemSub}>{sub}</Text>
      </View>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  label: { color: '#888', fontSize: 13, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase' },
  dayCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#222',
  },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  dayBadge: { backgroundColor: '#5F9EA0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  dayBadgeText: { color: '#000', fontSize: 11, fontWeight: 'bold' },
  dayTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  timeline: { paddingLeft: 4 },
  itemRow: { flexDirection: 'row', minHeight: 70 },
  itemLeft: { alignItems: 'center', width: 60 },
  itemTime: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  verticalLine: { width: 1, flex: 1, backgroundColor: '#333', marginVertical: 4 },
  itemRight: { flex: 1, flexDirection: 'row', gap: 12, paddingBottom: 15 },
  iconBox: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(95, 158, 160, 0.2)', alignItems: 'center', justifyContent: 'center', marginTop: -4 },
  itemTextGroup: { flex: 1 },
  itemActivity: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  itemSub: { color: '#888', fontSize: 11, marginTop: 2 },
});

export default ItineraryGenerator;
