import { employeeApi } from '../../api/employeeClient';
import { ParkingHistoryPanel } from '../../components/ParkingHistoryPanel';

export default function EmployeeHistory() {
  return <ParkingHistoryPanel api={employeeApi} scopeLabel="all your assigned lots" />;
}
