import { api } from './api';

export type ValetRequestStatus =
  | 'PENDING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'RETURNED';

export type VehicleRequestData = {
  hasRequest: boolean;
  requestStatus?: ValetRequestStatus;
  vehicleStatus?: string;
  requestType?: string;
  message?: string;
  vehicleNumber?: string;
  createdAt?: string;
  updatedAt?: string;
  vehicleInfo?: {
    vehicleNumberFull: string;
    vehicleNumberMasked: string;
    pickedBy?: string;
    pickupTime?: string;
    pickupLocation?: string;
  };
  pickupInfo?: {
    pickedBy?: string;
    valetPhone?: string;
    pickupTime?: string;
    pickupLocation?: string;
    parkLocation?: string;
    notes?: string;
    status?: string;
  } | null;
};

type ApiResponse<T> = { success: boolean; data: T };

export async function requestDrop(vehicleNumber?: string): Promise<VehicleRequestData> {
  const res = await api.post<ApiResponse<VehicleRequestData>>('/v1/customer/request-drop', {
    vehicleNumber,
  });
  return res.data;
}

export async function getVehicleRequestData(vehicleNumber?: string): Promise<VehicleRequestData> {
  const suffix = vehicleNumber
    ? `?vehicleNumber=${encodeURIComponent(vehicleNumber)}`
    : '';
  const res = await api.get<ApiResponse<VehicleRequestData>>(
    `/v1/customer/vehicle-request-data${suffix}`,
  );
  return res.data;
}

export async function cancelDropRequest(vehicleNumber?: string): Promise<VehicleRequestData> {
  const res = await api.post<ApiResponse<VehicleRequestData>>(
    '/v1/customer/cancel-drop-request',
    { vehicleNumber },
  );
  return res.data;
}

export async function getValetLocation(vehicleNumber: string): Promise<{
  latitude?: number;
  longitude?: number;
  speed?: number;
  timestamp?: number;
  dropCompleted?: boolean;
  message?: string;
}> {
  const normalized = vehicleNumber.toUpperCase().trim();
  const res = await api.get<
    ApiResponse<{
      latitude?: number;
      longitude?: number;
      speed?: number;
      timestamp?: number;
      dropCompleted?: boolean;
      message?: string;
    }>
  >(`/v1/customer/valet-location/${encodeURIComponent(normalized)}`);
  return res.data;
}
