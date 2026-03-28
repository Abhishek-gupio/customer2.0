import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { ChevronRight, ChevronLeft } from 'lucide-react-native';
import QuickSetup from './components/QuickSetup';
import ExplorerTabs from './components/ExplorerTabs';
import SuccessScreen from './components/SuccessScreen';
import { PlanningState } from './tripPlannerTypes';
import { savePlanningState, loadPlanningState } from '../../services/tripPlannerPersistence';
import { saveToHistory } from '../../services/tripHistoryPersistence';
import { TripExpenseResult } from '../../services/tripExpenseService';
import { analyticsService, tripPlannerAnalytics } from '../../services/analytics';

const steps = [
  'Trip Setup',
  'Explore Add-ons',
  'Trip Summary',
];

const stepKeys = ['trip_setup', 'explore_addons', 'trip_summary'] as const;

interface Props {
  onClose: () => void;
  tripId?: string;
  tripResult?: TripExpenseResult | null;
  from?: string;
  to?: string;
  initialStep?: number;
  initialPlanning?: PlanningState | null;
}

const TripPlannerFlow = ({ onClose, tripId, tripResult, from, to, initialStep, initialPlanning }: Props) => {
  const [currentStep, setCurrentStep] = useState(initialStep ?? 0);
  const [isSavingTrip, setIsSavingTrip] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [planning, setPlanning] = useState<PlanningState>({
    arrivalDate: null,
    departureDate: null,
    stayDays: 0,
    travelerType: 'solo',
    preferences: [],
    budget: 0,
    hotelBudget: 0,
    activityBudget: 0,
    transportBudget: 0,
    selectedHotelDetails: undefined,
    selectedActivities: [],
    selectedActivityDetails: [],
    selectedTransportDetails: undefined,
    currentStep: 0,
  });

  useEffect(() => {
    if (!initialPlanning) return;
    setPlanning(initialPlanning);
    if (initialStep !== undefined) {
      setCurrentStep(initialStep);
    }
  }, [initialPlanning, initialStep]);

  useEffect(() => {
    if (initialPlanning) return;
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
  }, [tripId, initialStep, initialPlanning]);

  useEffect(() => {
    analyticsService.trackScreenView('trip_planner_flow');
  }, []);

  useEffect(() => {
    tripPlannerAnalytics.plannerStepViewed({
      step_index: currentStep,
      step_key: stepKeys[currentStep] || 'unknown',
      total_steps: steps.length,
      has_trip_result: !!tripResult,
    });
  }, [currentStep, tripResult]);

  const getPlanningSnapshot = () => ({
    has_hotel: !!planning.selectedHotelId,
    activity_count: planning.selectedActivities?.length || 0,
    has_transport: !!planning.selectedBikeId,
    budget: planning.budget || 0,
    stay_days: planning.stayDays || 0,
  });

  const closePlanner = (source: string) => {
    tripPlannerAnalytics.plannerExited({
      source,
      step_index: currentStep,
      ...getPlanningSnapshot(),
    });
    onClose();
  };

  const updatePlanning = (partial: Partial<PlanningState>) => {
    // Keep currentStep in sync, but allow explicit step overrides from callers.
    const newState = { ...planning, currentStep, ...partial };
    setPlanning(newState);
    savePlanningState(newState, tripId);
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      updatePlanning({ currentStep: next });
      tripPlannerAnalytics.plannerStepChanged({
        source: 'next',
        from_step: currentStep,
        to_step: next,
      });
    } else {
      closePlanner('next_on_last_step');
    }
  };

  const handleSaveTrip = async () => {
    if (isSavingTrip) return;
    setIsSavingTrip(true);
    setSaveError(null);
    try {
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
      tripPlannerAnalytics.plannerSaved({
        source: 'summary_save',
        ...getPlanningSnapshot(),
      });
      onClose();
    } catch (error) {
      console.warn('Failed to save trip plan', error);
      setSaveError('Could not save your trip right now. Please try again.');
      Alert.alert('Save failed', 'Could not save your trip right now. Please try again.');
      tripPlannerAnalytics.plannerSaveFailed({
        source: 'summary_save',
      });
    } finally {
      setIsSavingTrip(false);
    }
  };

  const handleBack = () => {
    setSaveError(null);
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      updatePlanning({ currentStep: prev });
      tripPlannerAnalytics.plannerStepChanged({
        source: 'back',
        from_step: currentStep,
        to_step: prev,
      });
    } else {
      closePlanner('back_from_first_step');
    }
  };

  const handleFinishExplorer = () => {
    setSaveError(null);
    const next = 2;
    setCurrentStep(next);
    updatePlanning({ currentStep: next });
    tripPlannerAnalytics.explorerFinished({
      source: 'explorer_finish',
      to_step: next,
      ...getPlanningSnapshot(),
    });
    tripPlannerAnalytics.plannerStepChanged({
      source: 'explorer_finish',
      from_step: currentStep,
      to_step: next,
    });
  };

  const jumpToStep = (step: number, source: string = 'jump') => {
    setSaveError(null);
    setCurrentStep(step);
    updatePlanning({ currentStep: step });
    tripPlannerAnalytics.plannerStepChanged({
      source,
      from_step: currentStep,
      to_step: step,
    });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <QuickSetup planning={planning} onChange={updatePlanning} />;
      case 1:
        return (
          <ExplorerTabs 
            planning={planning} 
            onChange={updatePlanning} 
            onFinish={handleFinishExplorer}
            tripResult={tripResult}
          />
        );
      case 2: return <SuccessScreen 
                        planning={planning} 
                        tripResult={tripResult}
                        from={from}
                        to={to}
                        onSave={handleSaveTrip} 
                        isSaving={isSavingTrip}
                        saveError={saveError}
                        onEditSetup={() => jumpToStep(0, 'summary_edit_setup')}
                        onEditAddOns={() => jumpToStep(1, 'summary_edit_addons')}
                        onKeepExploring={handleBack} 
                      />;
      default: return null;
    }
  };

  const isSuccess = currentStep === 2;
  const progress = ((currentStep + 1) / steps.length) * 100;
  const hasSetupValues = !!(
    planning.arrivalDate ||
    planning.departureDate ||
    (planning.preferences?.length || 0) > 0 ||
    planning.budget > 0 ||
    (planning.hotelBudget || 0) > 0 ||
    (planning.activityBudget || 0) > 0 ||
    (planning.transportBudget || 0) > 0
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      {!isSuccess && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint={currentStep > 0 ? 'Return to previous planner step' : 'Close planner'}
            >
              <ChevronLeft size={24} color="#FFF" />
            </TouchableOpacity>
            <View style={styles.titleGroup}>
              <Text style={styles.stepIndicator}>Step {currentStep + 1} of {steps.length}</Text>
              <Text style={styles.stepTitle}>{steps[currentStep]}</Text>
            </View>
            <TouchableOpacity
              onPress={() => closePlanner('header_close')}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Close planner"
              accessibilityHint="Exit trip planning and return to trip screen"
            >
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
          {!hasSetupValues && (
            <Text style={styles.footerHint}>
              You can skip setup for now and refine details after exploring hotels and activities.
            </Text>
          )}
          <TouchableOpacity
            style={styles.nextBtn}
            onPress={handleNext}
            accessibilityRole="button"
            accessibilityLabel={hasSetupValues ? 'Start exploring add-ons' : 'Skip setup and start exploring add-ons'}
            accessibilityHint="Moves to the add-ons step"
          >
            <Text style={styles.nextBtnText}>{hasSetupValues ? 'Start Exploring' : 'Skip & Start Exploring'}</Text>
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
  footerHint: { color: '#999', fontSize: 12, textAlign: 'center', marginBottom: 10, lineHeight: 16 },
});

export default TripPlannerFlow;
