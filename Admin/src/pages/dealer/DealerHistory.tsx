import { dealerApi } from '../../api/dealerClient';
import { ParkingHistoryPanel } from '../../components/ParkingHistoryPanel';

export default function DealerHistory() {
  return <ParkingHistoryPanel api={dealerApi} scopeLabel="all your parking lots" />;
}
