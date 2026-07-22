import { employeeApi } from '../../api/employeeClient';
import { ParkingBookingsPanel } from '../../components/ParkingBookingsPanel';

export default function EmployeeBookings() {
  return <ParkingBookingsPanel api={employeeApi} />;
}
