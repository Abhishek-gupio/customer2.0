import { getPartTypeLabel } from '../constants/partTypes';
import { api } from './api';
import { vehicleService, type Vehicle } from './vehicleService';

export type WarrantyUrgency = 'OVERDUE' | 'DUE_BY_KM' | 'DUE_SOON' | 'ACTIVE';

type WarrantySnapshotResponse = {
  activeCount?: number;
  expiredCount?: number;
};

type WarrantyUpcomingResponse = {
  partType: string;
  message?: string;
  urgency?: WarrantyUrgency | string;
  predictedReplacementDate?: string;
  garageName?: string;
  serviceType?: string;
  warrantyMonths?: number | null;
  lastReplacedOdo?: number | null;
  kmSinceReplacement?: number | null;
  lifecycleKm?: number | null;
  lifecycleMonths?: number | null;
  lastReplacedAt?: string | null;
  overdueByKm?: number | null;
  intervalSource?: string | null;
};

export type WarrantyDashboardPart = {
  id: string;
  title: string;
  subtitle: string;
  percentage: number;
  statusText: string;
  color: string;
  icon: string;
  urgency: WarrantyUrgency;
  predictedDate?: string;
  garageName?: string;
  serviceType?: string;
  warrantyMonths?: number;
  lastReplacedOdo?: number;
  kmSinceReplacement?: number;
  lifecycleKm?: number;
  lifecycleMonths?: number;
  lastReplacedAt?: string;
  currentOdo?: number;
  overdueByKm?: number;
  intervalSource?: string;
};

export type WarrantyDashboardSummary = {
  active: number;
  expired: number;
  critical: number;
  overdue: number;
  dueSoon: number;
};

export type WarrantyDashboardResult = {
  vehicle: Vehicle | null;
  parts: WarrantyDashboardPart[];
  summary: WarrantyDashboardSummary;
};

export type WarrantyHistoryCard = {
  id: string;
  title: string;
  serviceType: string;
  serviceLabel: string;
  partLabels: string[];
  garage: string;
  date: string;
  odometer?: string;
  parts?: string;
  nextService?: string;
};

export type WarrantyPrimaryHistoryResult = {
  vehicle: Vehicle | null;
  records: WarrantyHistoryCard[];
};

export type WarrantyHomeSummary = {
  serviceDueText: string;
  serviceAlertCount: number;
  serviceDueSoonCount: number;
};

export type WarrantyLocalStatusSummary = {
  message: string;
  contextUsed: number;
};

export type WarrantyManualUpdateInput = {
  amount: number;
  vehicleId: string;
  notes?: string;
  date: string;
  odometerReading: number;
  partTypes: string[];
};

export type WarrantyServiceRecordSyncInput = {
  vehicleId: string;
  expenseId?: string;
  serviceType: string;
  serviceDate: string;
  notes?: string;
  odometerAtService?: number;
  parts: Array<{
    partType: string;
    cost: number;
  }>;
};

const UPCOMING_URGENCY_SET = new Set(['DUE_SOON', 'DUE_BY_KM', 'UPCOMING']);

function unwrapData<T>(response: unknown): T {
  return ((response as { data?: T })?.data ?? response) as T;
}

export function normalizeSelectedWarrantyPartTypes(partTypes: string[]): string[] {
  const normalized = new Set<string>();

  for (const partType of partTypes) {
    const value = String(partType || '').trim().toUpperCase();
    if (!value) continue;

    if (value === 'TYRES') {
      normalized.add('TYRES_FRONT');
      normalized.add('TYRES_REAR');
      continue;
    }

    normalized.add(value);
  }

  return Array.from(normalized);
}

export function getWarrantyPartIcon(type: string): string {
  switch (type) {
    case 'ENGINE_OIL':
      return 'oil';
    case 'BATTERY':
      return 'battery';
    case 'TYRES_FRONT':
    case 'TYRES_REAR':
      return 'car-tire-alert';
    case 'BRAKE_PADS':
      return 'disc';
    case 'AIR_FILTER':
      return 'air-filter';
    case 'COOLANT':
      return 'coolant-temperature';
    default:
      return 'wrench';
  }
}

export function getWarrantyUrgencyColor(urgency?: string): string {
  switch (urgency) {
    case 'OVERDUE':
      return '#EF4444';
    case 'DUE_BY_KM':
      return '#F59E0B';
    case 'DUE_SOON':
      return '#F97316';
    default:
      return '#22C55E';
  }
}

export function getWarrantyUrgencyLabel(urgency?: string): string {
  switch (urgency) {
    case 'OVERDUE':
      return 'Overdue';
    case 'DUE_BY_KM':
      return 'Due by km';
    case 'DUE_SOON':
      return 'Due soon';
    case 'ACTIVE':
      return 'Active';
    default:
      return (urgency || '')
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (char) => char.toUpperCase());
  }
}

function mapWarrantyUpcomingPart(
  item: WarrantyUpcomingResponse,
  currentOdo?: number,
): WarrantyDashboardPart {
  const lifecycleKm = Number(item.lifecycleKm ?? 10000);
  const kmSinceReplacement = Number(item.kmSinceReplacement ?? 0);
  const percentage = Math.round((1 - kmSinceReplacement / lifecycleKm) * 100);
  const urgency = String(item.urgency || 'ACTIVE').toUpperCase() as WarrantyUrgency;

  return {
    id: item.partType,
    title: getPartTypeLabel(item.partType),
    subtitle: item.message || '',
    percentage: Math.max(0, Math.min(100, percentage)),
    statusText: getWarrantyUrgencyLabel(urgency),
    color: getWarrantyUrgencyColor(urgency),
    icon: getWarrantyPartIcon(item.partType),
    urgency,
    predictedDate: item.predictedReplacementDate
      ? new Date(item.predictedReplacementDate).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
        })
      : undefined,
    garageName: item.garageName || undefined,
    serviceType: item.serviceType || undefined,
    warrantyMonths: item.warrantyMonths ?? undefined,
    lastReplacedOdo: item.lastReplacedOdo ?? undefined,
    kmSinceReplacement: item.kmSinceReplacement ?? undefined,
    lifecycleKm: item.lifecycleKm ?? undefined,
    lifecycleMonths: item.lifecycleMonths ?? undefined,
    lastReplacedAt: item.lastReplacedAt ?? undefined,
    currentOdo,
    overdueByKm: item.overdueByKm ?? undefined,
    intervalSource: item.intervalSource ?? undefined,
  };
}

function buildWarrantyDashboardSummary(
  statusData: WarrantySnapshotResponse | null,
  parts: WarrantyDashboardPart[],
): WarrantyDashboardSummary {
  const overdue = parts.filter((part) => part.urgency === 'OVERDUE').length;
  const dueSoon = parts.filter((part) => UPCOMING_URGENCY_SET.has(part.urgency)).length;
  const activeByPercentage = parts.filter((part) => part.percentage > 15).length;
  const expiredByPercentage = parts.filter((part) => part.percentage <= 15).length;

  return {
    active:
      typeof statusData?.activeCount === 'number' ? statusData.activeCount : activeByPercentage,
    expired:
      typeof statusData?.expiredCount === 'number' ? statusData.expiredCount : expiredByPercentage,
    critical: overdue,
    overdue,
    dueSoon,
  };
}

function buildWarrantyHomeSummaryFromUpcoming(
  upcomingItems: WarrantyUpcomingResponse[],
): WarrantyHomeSummary {
  const serviceAlertCount = upcomingItems.filter((item) => item?.urgency === 'OVERDUE').length;
  const serviceDueSoonCount = upcomingItems.filter((item) =>
    UPCOMING_URGENCY_SET.has(String(item?.urgency || '').toUpperCase()),
  ).length;
  const overdue = upcomingItems.find((item) => item?.urgency === 'OVERDUE');

  if (overdue) {
    return {
      serviceDueText: 'Overdue!',
      serviceAlertCount,
      serviceDueSoonCount,
    };
  }

  const first = upcomingItems[0];
  if (first) {
    const lifecycleKm = Number(first.lifecycleKm ?? 10000);
    const kmSinceReplacement = Number(first.kmSinceReplacement ?? 0);
    const kmLeft = Math.max(0, lifecycleKm - kmSinceReplacement);
    return {
      serviceDueText: `${kmLeft} km`,
      serviceAlertCount,
      serviceDueSoonCount,
    };
  }

  return {
    serviceDueText: 'Healthy',
    serviceAlertCount: 0,
    serviceDueSoonCount: 0,
  };
}

function mapWarrantyHistoryRecord(record: any): WarrantyHistoryCard {
  const serviceType = record.serviceType || 'SERVICE';
  const serviceLabel = serviceType.replace(/_/g, ' ');
  const partLabels = Array.isArray(record.parts)
    ? record.parts.map((part: any) => getPartTypeLabel(part.partType || ''))
    : [];
  const date = record.serviceDate
    ? new Date(record.serviceDate).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : '';
  const nextService = record.nextServiceKm
    ? `Next at ${record.nextServiceKm.toLocaleString()} km`
    : record.nextServiceDate
      ? new Date(record.nextServiceDate).toLocaleDateString('en-IN')
      : '';

  return {
    id: String(record.id),
    title: serviceLabel || 'Service',
    serviceType,
    serviceLabel,
    partLabels,
    garage: record.garageName || '-',
    date,
    odometer: record.odometerAtService
      ? `${record.odometerAtService.toLocaleString()} km`
      : undefined,
    parts: partLabels.join(', ') || undefined,
    nextService: nextService || undefined,
  };
}

async function getPrimaryVehicle(refreshHealth = false): Promise<Vehicle | null> {
  const vehicles = await vehicleService.getVehicles();
  const primary = vehicles.find((vehicle) => vehicle.isPrimary) || vehicles[0];
  if (!primary) {
    return null;
  }

  if (!refreshHealth) {
    return primary;
  }

  try {
    await vehicleService.recalculateHealth(primary.id);
    return (await vehicleService.getVehicleById(primary.id)) || primary;
  } catch {
    return primary;
  }
}

async function getWarrantySnapshot(vehicleId: string): Promise<{
  status: WarrantySnapshotResponse | null;
  upcoming: WarrantyUpcomingResponse[];
}> {
  const [statusRes, upcomingRes] = await Promise.all([
    api.get<WarrantySnapshotResponse>(`/v1/expenses/warranty/vehicles/${vehicleId}/status`),
    api.get<WarrantyUpcomingResponse[]>(`/v1/expenses/warranty/vehicles/${vehicleId}/upcoming`),
  ]);

  const status = unwrapData<WarrantySnapshotResponse | null>(statusRes);
  const upcoming = unwrapData<WarrantyUpcomingResponse[] | null>(upcomingRes);

  return {
    status: status || null,
    upcoming: Array.isArray(upcoming) ? upcoming : [],
  };
}

async function fetchPrimaryWarrantyDashboard(): Promise<WarrantyDashboardResult> {
  const vehicle = await getPrimaryVehicle(true);
  if (!vehicle) {
    return {
      vehicle: null,
      parts: [],
      summary: { active: 0, expired: 0, critical: 0, overdue: 0, dueSoon: 0 },
    };
  }

  api.post('/v1/expenses/warranty/primary/refresh-oem').catch(() => {});

  const snapshot = await getWarrantySnapshot(vehicle.id);
  const parts = snapshot.upcoming.map((item) =>
    mapWarrantyUpcomingPart(item, vehicle.currentOdometer),
  );

  return {
    vehicle,
    parts,
    summary: buildWarrantyDashboardSummary(snapshot.status, parts),
  };
}

async function fetchPrimaryWarrantyHistory(): Promise<WarrantyPrimaryHistoryResult> {
  const vehicle = await getPrimaryVehicle(false);
  if (!vehicle) {
    return {
      vehicle: null,
      records: [],
    };
  }

  const response = await api.get<any[]>(
    `/v1/expenses/warranty/vehicles/${vehicle.id}/history`,
  );
  const records = unwrapData<any[] | null>(response);

  return {
    vehicle,
    records: Array.isArray(records) ? records.map(mapWarrantyHistoryRecord) : [],
  };
}

async function createManualWarrantyUpdate(
  input: WarrantyManualUpdateInput,
): Promise<void> {
  const parsedDate = new Date(input.date);
  await api.post('/v1/expenses', {
    amount: input.amount,
    category: 'SERVICE',
    vehicleId: input.vehicleId,
    notes: input.notes?.trim() || undefined,
    date: parsedDate.toISOString(),
    source: 'MANUAL',
    odometerReading: input.odometerReading,
    parts: input.partTypes.map((partType) => ({
      partType,
      cost: input.amount,
    })),
  });
}

async function syncExpenseToWarrantyRecord(
  input: WarrantyServiceRecordSyncInput,
): Promise<void> {
  await api.post('/v1/expenses/warranty/service-records', input);
}

async function getWarrantyHomeSummary(vehicleId: string): Promise<WarrantyHomeSummary> {
  const snapshot = await getWarrantySnapshot(vehicleId);
  return buildWarrantyHomeSummaryFromUpcoming(snapshot.upcoming);
}

async function getPrimaryWarrantyHomeSummary(): Promise<WarrantyHomeSummary> {
  const vehicle = await getPrimaryVehicle(false);
  if (!vehicle) {
    return {
      serviceDueText: 'Add vehicle',
      serviceAlertCount: 0,
      serviceDueSoonCount: 0,
    };
  }

  return getWarrantyHomeSummary(vehicle.id);
}

async function getLocalWarrantyStatusSummary(
  vehicleId: string,
): Promise<WarrantyLocalStatusSummary> {
  const snapshot = await getWarrantySnapshot(vehicleId);
  const items = snapshot.upcoming;

  const overdueCount = items.filter((item) => item?.urgency === 'OVERDUE').length;
  const dueSoonCount = items.filter((item) =>
    UPCOMING_URGENCY_SET.has(String(item?.urgency || '').toUpperCase()),
  ).length;
  const activeCount = items.filter((item) => item?.urgency === 'ACTIVE').length;

  const summaryParts: string[] = [];
  if (typeof snapshot.status?.activeCount === 'number') {
    summaryParts.push(`${snapshot.status.activeCount} active`);
  } else if (activeCount > 0) {
    summaryParts.push(`${activeCount} active`);
  }
  if (typeof snapshot.status?.expiredCount === 'number') {
    summaryParts.push(`${snapshot.status.expiredCount} expired`);
  } else if (overdueCount > 0) {
    summaryParts.push(`${overdueCount} overdue`);
  }
  if (dueSoonCount > 0) {
    summaryParts.push(`${dueSoonCount} due soon`);
  }

  const firstUpcoming = items.find((item) => item?.message);
  const detail = firstUpcoming?.message ? ` ${firstUpcoming.message}` : '';

  return {
    message:
      summaryParts.length > 0
        ? `Your warranty status is ${summaryParts.join(', ')}.${detail}`.trim()
        : items.length > 0
          ? `I found ${items.length} warranty items for your vehicle.${detail}`.trim()
          : 'I could not find any warranty status details right now.',
    contextUsed: items.length,
  };
}

export const warrantyService = {
  getWarrantySnapshot,
  fetchPrimaryWarrantyDashboard,
  fetchPrimaryWarrantyHistory,
  createManualWarrantyUpdate,
  syncExpenseToWarrantyRecord,
  getWarrantyHomeSummary,
  getPrimaryWarrantyHomeSummary,
  getLocalWarrantyStatusSummary,
};
