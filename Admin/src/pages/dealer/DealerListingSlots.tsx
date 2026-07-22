import { dealerApi } from '../../api/dealerClient';
import { ParkingSlotsPanel } from '../../components/ParkingSlotsPanel';

export default function DealerListingSlots() {
  return <ParkingSlotsPanel api={dealerApi} basePath="/dealer/listings" canManage />;
}
