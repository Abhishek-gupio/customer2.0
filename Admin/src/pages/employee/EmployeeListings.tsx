import { employeeApi } from '../../api/employeeClient';
import { ParkingListingsPanel } from '../../components/ParkingListingsPanel';

export default function EmployeeListings() {
  return (
    <ParkingListingsPanel
      api={employeeApi}
      basePath="/employee/listings"
      canManage={false}
      heading="Listings"
      subheading="Choose a parking lot to manage gate entry, walk-ins, and availability"
      emptyDescription="Ask your parking lot owner to add a listing first."
    />
  );
}
