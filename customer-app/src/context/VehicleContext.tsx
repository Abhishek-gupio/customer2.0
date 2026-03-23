import React, { createContext, useContext, useState, useCallback, memo, useEffect } from 'react';
import { customerLocationService } from '../services/customerLocationService';

export interface VehicleInfo {
  vehicleNumberFull: string;
  vehicleNumberMasked: string;
  pickedBy: string;
  pickupTime: string;
  pickupLocation: string;
  valetName?: string;
  status?: 'pending' | 'picked_up' | 'delivered' | 'cancelled';
  // Additional vehicle details
  vehicleType?: string;
  vehicleModel?: string;
  vehicleColor?: string;
  ownerName?: string;
  ownerPhone?: string;
}

export interface PickupInfo {
  pickedBy: string;
  valetPhone: string;
  pickupTime: string;
  pickupLocation: string;
  parkLocation: string;
  notes: string;
  status: string;
}

export interface VehicleRequestData {
  hasRequest: boolean;
  requestStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'RETURNED';
  vehicleStatus?: 'PARKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'RETURNED';
  requestType?: 'PICKUP' | 'DROPOFF';
  createdAt?: string;
  updatedAt?: string;
  vehicleNumber?: string;
  message?: string;
  vehicleInfo?: VehicleInfo;
  pickupInfo?: PickupInfo | null;
}

export interface RequestStatus {
  hasRequest: boolean;
  requestStatus?: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'COMPLETED' | 'RETURNED';
  vehicleStatus?: 'PARKED' | 'PICKED_UP' | 'IN_TRANSIT' | 'RETURNED';
  requestType?: 'PICKUP' | 'DROPOFF';
  message?: string;
  createdAt?: string;
  updatedAt?: string;
  vehicleNumber?: string;
}

interface VehicleContextType {
  vehicleInfo: VehicleInfo | null;
  requestStatus: RequestStatus | null;
  vehicleRequestData: VehicleRequestData | null;
  updateVehicleInfo: (info: VehicleInfo) => void;
  updateRequestStatus: (status: RequestStatus) => void;
  updateVehicleRequestData: (data: VehicleRequestData) => void;
  clearVehicleInfo: () => void;
  clearRequestStatus: () => void;
  clearVehicleRequestData: () => void;
  markDeliveryComplete: () => void;
  isVehicleRequested: boolean;
  isRequestPending: boolean;
  isValetOnWay: boolean;
  isDeliveryComplete: boolean;
}

const VehicleContext = createContext<VehicleContextType | undefined>(undefined);

export const VehicleProvider: React.FC<{ children: React.ReactNode }> = memo(({ children }) => {
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null);
  const [requestStatus, setRequestStatus] = useState<RequestStatus | null>(null);
  const [vehicleRequestData, setVehicleRequestData] = useState<VehicleRequestData | null>(null);

  const updateVehicleInfo = useCallback((info: VehicleInfo) => {
    console.log('🚗 Updating vehicle info:', info);
    setVehicleInfo(info);
  }, []);

  const updateRequestStatus = useCallback((status: RequestStatus) => {
    console.log('📋 Updating request status:', status);
    setRequestStatus(status);
  }, []);

  const updateVehicleRequestData = useCallback((data: VehicleRequestData) => {
    console.log('🚗📋 Updating vehicle request data:', data);
    setVehicleRequestData(data);

    // Also update individual vehicle info and request status for backward compatibility
    if (data.vehicleInfo) {
      setVehicleInfo(data.vehicleInfo);
    }
    if (data.requestStatus || data.vehicleStatus || data.message) {
      setRequestStatus({
        hasRequest: data.hasRequest,
        requestStatus: data.requestStatus,
        vehicleStatus: data.vehicleStatus,
        requestType: data.requestType,
        message: data.message,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        vehicleNumber: data.vehicleNumber
      });
    }
  }, []);

  const clearVehicleInfo = useCallback(() => {
    console.log('🗑️ Clearing vehicle info');
    setVehicleInfo(null);
  }, []);

  const clearRequestStatus = useCallback(() => {
    console.log('🗑️ Clearing request status');
    setRequestStatus(null);
  }, []);

  const clearVehicleRequestData = useCallback(() => {
    console.log('🗑️ Clearing vehicle request data');
    setVehicleRequestData(null);
    setVehicleInfo(null);
    setRequestStatus(null);
  }, []);

  const markDeliveryComplete = useCallback(() => {
    console.log('🎉 Marking delivery as complete');
    setVehicleInfo(null);
    setRequestStatus({
      hasRequest: true,
      requestStatus: 'COMPLETED',
      message: 'Vehicle has been delivered successfully.'
    });
    // Stop customer location polling when delivery is complete
    customerLocationService.stopPolling();
  }, []);

  // Automatically start customer location polling when request is made (so valet can see customer location immediately when accepting)
  // IMPORTANT: Start as soon as we have a vehicle number, even if valet hasn't accepted yet
  useEffect(() => {
    // Check all possible sources for vehicle number
    const vehicleNumber =
      vehicleInfo?.vehicleNumberFull ||
      requestStatus?.vehicleNumber ||
      vehicleRequestData?.vehicleNumber ||
      vehicleRequestData?.vehicleInfo?.vehicleNumberFull;

    // Check if request is completed, cancelled, or rejected
    const isCompleted =
      vehicleRequestData?.requestStatus === 'COMPLETED' ||
      vehicleRequestData?.requestStatus === 'RETURNED' ||
      vehicleRequestData?.requestStatus === 'CANCELLED' ||
      vehicleRequestData?.requestStatus === 'REJECTED' ||
      requestStatus?.requestStatus === 'COMPLETED' ||
      requestStatus?.requestStatus === 'RETURNED' ||
      requestStatus?.requestStatus === 'CANCELLED' ||
      requestStatus?.requestStatus === 'REJECTED';

    // Also check if we have an active request (hasRequest = true) and not completed/cancelled/rejected
    const hasActiveRequest =
      (vehicleRequestData?.hasRequest === true ||
        requestStatus?.hasRequest === true ||
        vehicleInfo !== null) && !isCompleted;

    // Start location sharing if we have a vehicle number AND an active request (not completed)
    // This ensures valet can see customer location as soon as they accept
    if (vehicleNumber && hasActiveRequest && !isCompleted) {
      const vnum = String(vehicleNumber).toUpperCase().trim();

      // Check if already polling for this vehicle
      const currentVehicle = customerLocationService.getCurrentVehicle();
      if (customerLocationService.isActive() && currentVehicle === vnum) {
        console.log('📍 VehicleContext: Customer location polling already active for vehicle:', vnum);
        return;
      }

      console.log('🚀 VehicleContext: Starting customer location polling for vehicle:', vnum);
      console.log('🚀 VehicleContext: Request status:', vehicleRequestData?.requestStatus || requestStatus?.requestStatus || 'UNKNOWN');
      console.log('✅ VehicleContext: Valet will be able to see customer location when they accept');

      customerLocationService.startPolling(vnum)
        .then(() => {
          console.log('✅ VehicleContext: Customer location polling started successfully');
          console.log('✅ VehicleContext: Location updates will be sent every 10 seconds');
          console.log('✅ VehicleContext: Works even when TrackLive screen is not open');
        })
        .catch((error) => {
          console.error('❌ VehicleContext: Failed to start customer location polling:', error);
        });
    } else {
      // Stop polling if no vehicle number, no active request, or request is completed/cancelled/rejected
      if (customerLocationService.isActive()) {
        if (isCompleted) {
          const status = vehicleRequestData?.requestStatus || requestStatus?.requestStatus;
          if (status === 'CANCELLED') {
            console.log('🛑 VehicleContext: Request cancelled - stopping customer location polling');
          } else if (status === 'REJECTED') {
            console.log('🛑 VehicleContext: Request rejected - stopping customer location polling');
          } else if (status === 'COMPLETED' || status === 'RETURNED') {
            console.log('🛑 VehicleContext: Request completed - stopping customer location polling');
          } else {
            console.log('🛑 VehicleContext: Request ended - stopping customer location polling');
          }
        } else if (!vehicleNumber) {
          console.log('🛑 VehicleContext: No vehicle number available - stopping customer location polling');
        } else if (!hasActiveRequest) {
          console.log('🛑 VehicleContext: No active request - stopping customer location polling');
        }
        customerLocationService.stopPolling();
      }
    }

    // Cleanup: Only stop polling if we're actually clearing everything
    // Don't stop if dependencies are just updating (the effect will handle restarting if needed)
    return () => {
      // Only cleanup if we're unmounting or completely clearing
      // The effect will restart polling if vehicle/request still exists
    };
  }, [
    vehicleInfo?.vehicleNumberFull,
    requestStatus?.vehicleNumber,
    vehicleRequestData?.vehicleNumber,
    vehicleRequestData?.vehicleInfo?.vehicleNumberFull,
    vehicleRequestData?.hasRequest,
    vehicleRequestData?.requestStatus,
    requestStatus?.hasRequest,
    requestStatus?.requestStatus
  ]);

  // Stop customer location polling when vehicle info is cleared
  useEffect(() => {
    if (!vehicleInfo && !requestStatus) {
      if (customerLocationService.isActive()) {
        console.log('🧹 VehicleContext: All vehicle data cleared - stopping customer location polling');
        customerLocationService.stopPolling();
      }
    }
  }, [vehicleInfo, requestStatus]);

  const value = {
    vehicleInfo,
    requestStatus,
    vehicleRequestData,
    updateVehicleInfo,
    updateRequestStatus,
    updateVehicleRequestData,
    clearVehicleInfo,
    clearRequestStatus,
    clearVehicleRequestData,
    markDeliveryComplete,
    isVehicleRequested: vehicleInfo !== null || vehicleRequestData?.hasRequest === true,
    isRequestPending: requestStatus?.requestStatus === 'PENDING' || vehicleRequestData?.requestStatus === 'PENDING',
    isValetOnWay: requestStatus?.requestStatus === 'ACCEPTED' || vehicleRequestData?.requestStatus === 'ACCEPTED',
    isDeliveryComplete:
      requestStatus?.requestStatus === 'COMPLETED' ||
      vehicleRequestData?.requestStatus === 'COMPLETED' ||
      requestStatus?.requestStatus === 'RETURNED' ||
      vehicleRequestData?.requestStatus === 'RETURNED' ||
      requestStatus?.requestStatus === 'CANCELLED' ||
      vehicleRequestData?.requestStatus === 'CANCELLED' ||
      requestStatus?.requestStatus === 'REJECTED' ||
      vehicleRequestData?.requestStatus === 'REJECTED',
  };

  return (
    <VehicleContext.Provider value={value}>
      {children}
    </VehicleContext.Provider>
  );
});

VehicleProvider.displayName = 'VehicleProvider';

export const useVehicle = () => {
  const context = useContext(VehicleContext);
  if (context === undefined) {
    throw new Error('useVehicle must be used within a VehicleProvider');
  }
  return context;
};
