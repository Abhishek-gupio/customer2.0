import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { employeeApi } from '../../api/employeeClient';
import { useEmployeeAuth } from '../../context/EmployeeAuthContext';
import { ParkingLiveStatusView } from '../../components/ParkingLiveStatusView';

export default function EmployeeListingLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useEmployeeAuth();
  const [hasMultipleLots, setHasMultipleLots] = useState(false);
  const [listingName, setListingName] = useState('');

  useEffect(() => {
    employeeApi.listListings().then((res) => {
      if (res.success) {
        if (res.data.length > 1) {
          setHasMultipleLots(true);
        }
        const current = res.data.find((l) => l.id === id);
        if (current) {
          setListingName(current.name);
        }
      }
    });
  }, [id]);

  if (!id) return null;

  return (
    <div className="space-y-6">
      {hasMultipleLots && (
        <button onClick={() => navigate('/employee/listings')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to lots
        </button>
      )}

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Live Gate Entry{listingName ? ` — ${listingName}` : ''}</h1>
        <p className="text-sm text-white/60">Log physical walk-ins (on-the-spot parking) in and out of the lot</p>
      </div>

      <ParkingLiveStatusView
        listingId={id}
        fetchStatus={employeeApi.getListingLiveStatus}
        fetchSlotWindows={employeeApi.listSlotWindows}
        fetchHistory={employeeApi.getWalkInHistory}
        onCheckIn={(listingId, slotId, data) => employeeApi.checkInWalkIn(listingId, slotId, data)}
        onCheckOut={employeeApi.checkOutWalkIn}
        socketToken={token}
        socketActorType="parkingEmployee"
      />
    </div>
  );
}
