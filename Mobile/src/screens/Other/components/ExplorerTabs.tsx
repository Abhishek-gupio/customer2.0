import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Hotel, Compass, Bike, CheckCircle } from 'lucide-react-native';
import HotelList from './HotelList';
import ActivityList from './ActivityList';
import TransportOptions from './TransportOptions';
import { PlanningState } from '../tripPlannerTypes';
import { TripExpenseResult } from '../../../services/tripExpenseService';

interface Props {
  planning: PlanningState;
  onChange: (partial: Partial<PlanningState>) => void;
  onFinish: () => void;
  tripResult?: TripExpenseResult | null;
}

const ExplorerTabs = ({ planning, onChange, onFinish, tripResult }: Props) => {
  const [activeTab, setActiveTab] = useState<'hotels' | 'activities' | 'transport'>('hotels');

  const tabs = [
    { id: 'hotels', label: 'Hotels', icon: Hotel },
    { id: 'activities', label: 'Activities', icon: Compass },
    { id: 'transport', label: 'Transport', icon: Bike },
  ];

  return (
    <View style={styles.container}>
      {/* Custom Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, isActive && styles.activeTab]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Icon size={16} color={isActive ? '#000' : '#888'} />
              <Text style={[styles.tabText, isActive && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Main Content Area */}
      <View style={styles.contentArea}>
        {activeTab === 'hotels' && <HotelList planning={planning} onChange={onChange} tripResult={tripResult} />}
        {activeTab === 'activities' && <ActivityList planning={planning} onChange={onChange} tripResult={tripResult} />}
        {activeTab === 'transport' && <TransportOptions planning={planning} onChange={onChange} tripResult={tripResult} />}
      </View>

      {/* Floating Footer */}
      <View style={styles.floatingFooter}>
        <View style={styles.footerInfo}>
           <Text style={styles.footerTotal}>
             Selected: {planning.selectedHotelId ? 1 : 0} Hotel, {planning.selectedActivities?.length || 0} Activities
           </Text>
           <Text style={styles.footerBudget}>Budget Limit: ₹{planning.budget}</Text>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={onFinish}>
           <CheckCircle size={18} color="#000" />
           <Text style={styles.finishBtnText}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#111',
    gap: 6,
  },
  activeTab: { backgroundColor: '#FFD700' },
  tabText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  activeTabText: { color: '#000' },
  contentArea: { flex: 1 },
  floatingFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 1,
    borderTopColor: '#222',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerInfo: { flex: 1 },
  footerTotal: { color: '#FFF', fontSize: 13, fontWeight: 'bold' },
  footerBudget: { color: '#FFD700', fontSize: 12, marginTop: 2 },
  finishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  finishBtnText: { color: '#000', fontSize: 14, fontWeight: 'bold' },
});

export default ExplorerTabs;
