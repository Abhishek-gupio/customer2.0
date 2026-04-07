export const PART_TYPE_OPTIONS = [
  { label: 'Battery', value: 'BATTERY' },
  { label: 'Engine Oil', value: 'ENGINE_OIL' },
  { label: 'Oil Filter', value: 'OIL_FILTER' },
  { label: 'Air Filter', value: 'AIR_FILTER' },
  { label: 'Brake Pads', value: 'BRAKE_PADS' },
  { label: 'Brake Discs', value: 'BRAKE_DISCS' },
  { label: 'Tyres (All)', value: 'TYRES' },
  { label: 'Tyres (Front)', value: 'TYRES_FRONT' },
  { label: 'Tyres (Rear)', value: 'TYRES_REAR' },
  { label: 'Clutch Plate', value: 'CLUTCH_PLATE' },
  { label: 'Spark Plugs', value: 'SPARK_PLUGS' },
  { label: 'Coolant', value: 'COOLANT' },
  { label: 'Timing Belt', value: 'TIMING_BELT' },
  { label: 'AC Filter', value: 'AC_FILTER' },
  { label: 'Wiper Blades', value: 'WIPER_BLADES' },
  { label: 'Headlight Bulb', value: 'HEADLIGHT_BULB' },
  { label: 'Other Part', value: 'OTHER_PART' },
] as const;

export const PART_TYPE_LABELS = PART_TYPE_OPTIONS.reduce<Record<string, string>>(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {},
);

export function getPartTypeLabel(partType: string | null | undefined): string {
  if (!partType) return 'Unknown Part';
  return PART_TYPE_LABELS[partType] || partType.replace(/_/g, ' ');
}
