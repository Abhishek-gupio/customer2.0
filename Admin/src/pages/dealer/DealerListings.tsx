import { dealerApi } from '../../api/dealerClient';
import { ParkingListingsPanel } from '../../components/ParkingListingsPanel';

export default function DealerListings() {
  return (
    <ParkingListingsPanel
      api={dealerApi}
      basePath="/dealer/listings"
      canManage
      heading="Your Listings"
      subheading="Manage lots, pricing and availability"
      emptyDescription="Add your first parking lot to start taking bookings."
    />
  );
}
