import { create } from 'zustand';

export interface LastCreatedExpense {
  id: string;
  amount: number;
  category: string;
  vehicleId?: string | null;
}

interface ExpenseStoreState {
  /** Bumped on every expense create/update so subscribers can react without polling. */
  version: number;
  lastCreated: LastCreatedExpense | null;
  notifyCreated: (expense?: LastCreatedExpense) => void;
}

export const useExpenseStore = create<ExpenseStoreState>((set) => ({
  version: 0,
  lastCreated: null,
  notifyCreated: (expense) =>
    set((state) => ({
      version: state.version + 1,
      lastCreated: expense ?? state.lastCreated,
    })),
}));
