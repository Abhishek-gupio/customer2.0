// Simple global refresh manager
let expenseListNeedsRefresh = false;
let warrantyStatusNeedsRefresh = false;

export const setExpenseListNeedsRefresh = () => {
  expenseListNeedsRefresh = true;
};

export const getAndClearExpenseListRefresh = (): boolean => {
  const needsRefresh = expenseListNeedsRefresh;
  expenseListNeedsRefresh = false;
  return needsRefresh;
};

export const setWarrantyStatusNeedsRefresh = () => {
  warrantyStatusNeedsRefresh = true;
};

export const getAndClearWarrantyStatusRefresh = (): boolean => {
  const needsRefresh = warrantyStatusNeedsRefresh;
  warrantyStatusNeedsRefresh = false;
  return needsRefresh;
};