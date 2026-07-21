import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { dealerApi } from '../../api/dealerClient';
import { useDealerAuth } from '../../context/DealerAuthContext';
import { ParkingLiveStatusView } from '../../components/ParkingLiveStatusView';

export default function DealerListingLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useDealerAuth();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/dealer/listings')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to listings
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Live status</h1>
        <p className="text-sm text-white/60">Who's parked right now — app bookings and walk-ins</p>
      </div>

      <ParkingLiveStatusView
        listingId={id}
        fetchStatus={dealerApi.getListingLiveStatus}
        fetchSlotWindows={dealerApi.listSlotWindows}
        fetchHistory={dealerApi.getWalkInHistory}
        onCheckIn={(listingId, slotId, data) => dealerApi.checkInWalkIn(listingId, slotId, data)}
        onCheckOut={dealerApi.checkOutWalkIn}
        socketToken={token}
        socketActorType="dealer"
      />
    </div>
  );
}
