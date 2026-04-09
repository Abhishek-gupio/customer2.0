
import { dbInstances } from './src/index';

async function main() {
  const vehicleId = 'cmn8wlbda000i5outvnvi7pio';
  const records = await dbInstances.serviceRecord.findMany({
    where: { vehicleId }
  });
  console.log(`RECORDS: ${records.length}`);
  console.log(JSON.stringify(records, null, 2));

  const parts = await dbInstances.servicePart.findMany({
    where: { serviceRecord: { vehicleId } }
  });
  console.log(`PARTS: ${parts.length}`);
}

main()
  .catch(console.error)
  .finally(() => dbInstances.$disconnect())
