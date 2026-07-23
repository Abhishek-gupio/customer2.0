import { employeeApi } from '../../api/employeeClient';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import { ParkingLivePage } from '../../components/ParkingLivePage';

export default function EmployeeListingLive() {
  const { token } = useEmployeeAuth();
  return (
    <ParkingLivePage
      token={token}
      socketActorType="parkingEmployee"
      backTo="/employee/listings"
      backLabel="Back to listings"
      subtitle="Log physical walk-ins (on-the-spot parking) in and out of the lot"
      api={{
        fetchStatus: employeeApi.getListingLiveStatus,
        fetchSlotWindows: employeeApi.listSlotWindows,
        fetchHistory: employeeApi.getWalkInHistory,
        onCheckIn: (listingId, slotId, data) => employeeApi.checkInWalkIn(listingId, slotId, data),
        onCheckOut: employeeApi.checkOutWalkIn,
      }}
    />
  );
}
