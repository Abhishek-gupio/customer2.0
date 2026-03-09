// Simple global refresh manager for expense list
let expenseListNeedsRefresh = false;

export const setExpenseListNeedsRefresh = () => {
  expenseListNeedsRefresh = true;
};

export const getAndClearExpenseListRefresh = (): boolean => {
  const needsRefresh = expenseListNeedsRefresh;
  expenseListNeedsRefresh = false;
  return needsRefresh;
};