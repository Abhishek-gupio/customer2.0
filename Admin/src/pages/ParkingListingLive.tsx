import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ParkingLivePage } from '../components/ParkingLivePage';

export default function ParkingListingLive() {
  const { token } = useAuth();
  return (
    <ParkingLivePage
      token={token}
      socketActorType="admin"
      backTo="/parking-live"
      backLabel="Back to all listings"
      subtitle="Who's parked right now — app bookings and walk-ins"
      readOnly
      api={{
        fetchStatus: adminApi.getParkingListingLiveStatus,
        fetchHistory: adminApi.getParkingWalkInHistory,
      }}
    />
  );
}
