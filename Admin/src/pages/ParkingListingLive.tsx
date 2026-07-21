import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { adminApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ParkingLiveStatusView } from '../components/ParkingLiveStatusView';

export default function ParkingListingLive() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/parking-live')} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Back to all listings
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Live status</h1>
        <p className="text-sm text-white/60">Read-only — ops visibility across every dealer</p>
      </div>

      <ParkingLiveStatusView
        listingId={id}
        fetchStatus={adminApi.getParkingListingLiveStatus}
        fetchHistory={adminApi.getParkingWalkInHistory}
        socketToken={token}
        socketActorType="admin"
      />
    </div>
  );
}
