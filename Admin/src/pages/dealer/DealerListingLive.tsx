import { dealerApi } from '../../api/dealerClient';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { ParkingLivePage } from '../../components/ParkingLivePage';

export default function DealerListingLive() {
  const { token } = useDealerAuth();
  return (
    <ParkingLivePage
      token={token}
      socketActorType="dealer"
      backTo="/dealer/listings"
      backLabel="Back to listings"
      subtitle="Who's parked right now — app bookings and walk-ins"
      api={{
        fetchStatus: dealerApi.getListingLiveStatus,
        fetchSlotWindows: dealerApi.listSlotWindows,
        fetchHistory: dealerApi.getWalkInHistory,
        onCheckIn: (listingId, slotId, data) => dealerApi.checkInWalkIn(listingId, slotId, data),
        onCheckOut: dealerApi.checkOutWalkIn,
      }}
    />
  );
}
