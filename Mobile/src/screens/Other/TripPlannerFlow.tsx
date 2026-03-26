import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import QuickSetup from './components/QuickSetup';
import ExplorerTabs from './components/ExplorerTabs';
import SuccessScreen from './components/SuccessScreen';
import { PlanningState } from './tripPlannerTypes';
import { savePlanningState, loadPlanningState } from '../../services/tripPlannerPersistence';
import { saveToHistory } from '../../services/tripHistoryPersistence';
import { TripExpenseResult } from '../../services/tripExpenseService';

const steps = [
  'Trip Setup',
  'Explore Add-ons',
  'Trip Summary',
];

interface Props {
  onClose: () => void;
  tripId?: string;
  tripResult?: TripExpenseResult | null;
  from?: string;
  to?: string;
  initialStep?: number;
}

const TripPlannerFlow = ({ onClose, tripId, tripResult, from, to, initialStep }: Props) => {
  const [currentStep, setCurrentStep] = useState(initialStep ?? 0);
  const [planning, setPlanning] = useState<PlanningState>({
    arrivalDate: null,
    departureDate: null,
    stayDays: 0,
    travelerType: 'solo',
    preferences: [],
    budget: 0,
    selectedActivities: [],
    currentStep: 0,
  });

  useEffect(() => {
    (async () => {
      const saved = await loadPlanningState(tripId);
      if (saved) {
        setPlanning(saved);
        // Only override step if initialStep wasn't provided
        if (initialStep === undefined) {
          // Map old steps (0-5) to new steps (0-2)
          let mappedStep = 0;
          if (saved.currentStep && saved.currentStep >= 4) {
             mappedStep = 1; // Used to be hub
          }
          setCurrentStep(mappedStep);
        }
      }
    })();
  }, [tripId, initialStep]);

  const updatePlanning = (partial: Partial<PlanningState>) => {
    const newState = { ...planning, ...partial, currentStep };
    setPlanning(newState);
    savePlanningState(newState, tripId);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      updatePlanning({ currentStep: next });
    } else {
      onClose();
    }
  };

  const handleSaveTrip = async () => {
    if (tripResult && from && to) {
      await saveToHistory({
        id: tripId || `manual_${Date.now()}`,
        from,
        to,
        tripResult,
        planning,
        timestamp: Date.now()
      });
    }
    onClose();
  };

  const handleBack = () => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      updatePlanning({ currentStep: prev });
    } else {
      onClose();
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <QuickSetup planning={planning} onChange={updatePlanning} />;
      case 1:
        return (
          <ExplorerTabs 
            planning={planning} 
            onChange={updatePlanning} 
            onFinish={() => setCurrentStep(2)}
            tripResult={tripResult}
          />
        );
      case 2: return <SuccessScreen 
                        planning={planning} 
                        tripResult={tripResult}
                        from={from}
                        to={to}
                        onSave={handleSaveTrip} 
                        onKeepExploring={handleBack} 
                      />;
      default: return null;
    }
  };

  const isSuccess = currentStep === 2;
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <View style={styles.container}>
      {/* Header */}
      {!isSuccess && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <ChevronLeft size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.titleGroup}>
              <Text style={styles.stepIndicator}>Step {currentStep + 1} of {steps.length}</Text>
              <Text style={styles.stepTitle}>{steps[currentStep]}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        </View>
      )}

      {/* Content Area */}
      {currentStep === 0 ? (
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          {renderStep()}
        </ScrollView>
      ) : (
        <View style={styles.content}>
          {renderStep()}
        </View>
      )}

      {/* Footer Nav (Only for Quick Setup) */}
      {currentStep === 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
            <Text style={styles.nextBtnText}>Start Exploring</Text>
            <ChevronRight size={20} color="#000" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 15 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  titleGroup: { alignItems: 'center' },
  stepIndicator: { color: '#FFD700', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
  stepTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginTop: 2 },
  closeBtn: { padding: 5 },
  closeText: { color: '#666', fontSize: 18 },
  progressContainer: { height: 4, backgroundColor: '#111', borderRadius: 2, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#FFD700' },
  content: { flex: 1 },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 20, 
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1,
    borderTopColor: '#111',
  },
  nextBtn: { 
    height: 56, 
    backgroundColor: '#FFD700', 
    borderRadius: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    gap: 8,
  },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
});

export default TripPlannerFlow;
