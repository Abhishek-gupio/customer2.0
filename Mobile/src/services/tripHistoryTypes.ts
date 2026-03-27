import { TripExpenseResult } from './tripExpenseService';
import { PlanningState } from '../screens/Other/tripPlannerTypes';

export interface HistoryEntry {
  id: string;
  from: string;
  to: string;
  tripResult: TripExpenseResult;
  planning: PlanningState;
  timestamp: number;
}
