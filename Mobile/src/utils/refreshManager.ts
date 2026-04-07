// Simple global refresh manager
let expenseListNeedsRefresh = false;
let warrantyStatusNeedsRefresh = false;

const expenseListListeners = new Set<() => void>();
const warrantyStatusListeners = new Set<() => void>();

function notifyListeners(listeners: Set<() => void>) {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Refresh listener failed:', error);
    }
  });
}

export const setExpenseListNeedsRefresh = () => {
  expenseListNeedsRefresh = true;
  notifyListeners(expenseListListeners);
};

export const getAndClearExpenseListRefresh = (): boolean => {
  const needsRefresh = expenseListNeedsRefresh;
  expenseListNeedsRefresh = false;
  return needsRefresh;
};

export const setWarrantyStatusNeedsRefresh = () => {
  warrantyStatusNeedsRefresh = true;
  notifyListeners(warrantyStatusListeners);
};

export const getAndClearWarrantyStatusRefresh = (): boolean => {
  const needsRefresh = warrantyStatusNeedsRefresh;
  warrantyStatusNeedsRefresh = false;
  return needsRefresh;
};

export const subscribeExpenseListRefresh = (listener: () => void) => {
  expenseListListeners.add(listener);
  return () => {
    expenseListListeners.delete(listener);
  };
};

export const subscribeWarrantyStatusRefresh = (listener: () => void) => {
  warrantyStatusListeners.add(listener);
  return () => {
    warrantyStatusListeners.delete(listener);
  };
};
