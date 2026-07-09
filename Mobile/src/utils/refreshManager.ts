// Simple global refresh manager
let warrantyStatusNeedsRefresh = false;

export const setWarrantyStatusNeedsRefresh = () => {
  warrantyStatusNeedsRefresh = true;
};

export const getAndClearWarrantyStatusRefresh = (): boolean => {
  const needsRefresh = warrantyStatusNeedsRefresh;
  warrantyStatusNeedsRefresh = false;
  return needsRefresh;
};
