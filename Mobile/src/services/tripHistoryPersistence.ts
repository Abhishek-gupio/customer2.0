import { HistoryEntry } from './tripHistoryTypes';
import { tripExpenseService } from './tripExpenseService';

export const saveToHistory = async (entry: HistoryEntry) => {
  try {
    await tripExpenseService.saveTrip(entry);
  } catch (e) {
    console.error('Error saving to history DB:', e);
  }
};

export const getHistory = async (): Promise<HistoryEntry[]> => {
  try {
    const data = await tripExpenseService.getHistory();
    return data;
  } catch (e) {
    console.error('Error loading history from DB:', e);
    return [];
  }
};

export const deleteHistoryItem = async (id: string) => {
  try {
    await tripExpenseService.deleteTrip(id);
  } catch (e) {
    console.error('Error deleting history item from DB:', e);
  }
};
