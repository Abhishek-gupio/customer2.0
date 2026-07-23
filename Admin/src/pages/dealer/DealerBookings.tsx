import { dealerApi } from '../../api/dealerClient';
import { ParkingBookingsPanel } from '../../components/ParkingBookingsPanel';

export default function DealerBookings() {
  return <ParkingBookingsPanel api={dealerApi} />;
}
