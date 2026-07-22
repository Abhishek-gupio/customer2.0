import { employeeApi } from '../../api/employeeClient';
import { ParkingSlotsPanel } from '../../components/ParkingSlotsPanel';

export default function EmployeeSlots() {
  return <ParkingSlotsPanel api={employeeApi} basePath="/employee/listings" canManage={false} />;
}
