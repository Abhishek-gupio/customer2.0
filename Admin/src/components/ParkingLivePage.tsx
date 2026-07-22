import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { ParkingLiveStatusView, type ParkingLiveStatusViewProps } from './ParkingLiveStatusView';

type LiveApi = Pick<ParkingLiveStatusViewProps, 'fetchStatus' | 'fetchSlotWindows' | 'fetchHistory' | 'onCheckIn' | 'onCheckOut'>;

/**
 * Dealer, employee, and admin "Live status" pages are the exact same
 * ParkingLiveStatusView, differing only in which API client feeds it, the
 * back-link target, and whether it's read-only — one page, not three
 * near-identical wrapper files.
 */
export function ParkingLivePage({
  api,
  token,
  socketActorType,
  backTo,
  backLabel,
  subtitle,
  readOnly = false,
}: {
  api: LiveApi;
  token: string | null;
  socketActorType: 'dealer' | 'parkingEmployee' | 'admin';
  backTo: string;
  backLabel: string;
  subtitle: string;
  readOnly?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (!id) return null;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate(backTo)} className="flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
      </button>

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">Live status</h1>
        <p className="text-sm text-white/60">{subtitle}</p>
      </div>

      <ParkingLiveStatusView
        listingId={id}
        fetchStatus={api.fetchStatus}
        fetchSlotWindows={api.fetchSlotWindows}
        fetchHistory={api.fetchHistory}
        onCheckIn={api.onCheckIn}
        onCheckOut={api.onCheckOut}
        socketToken={token}
        socketActorType={socketActorType}
        readOnly={readOnly}
      />
    </div>
  );
}
