
import { dbInstances } from './src/index';

async function main() {
  const vehicleId = 'cmn8wlbda000i5outvnvi7pio';
  const nexonHeroUrl = 'https://gupio-customer-app-bucket.s3.ap-south-1.amazonaws.com/vehicle-catalog/car/assets/tata/nexon/default/hero/0/1774274601549-HERO-0-0e10000f9b81134276aa50b27fb89503030927f1f89dfe4034f94d87fa2a65f5.png';

  const updated = await dbInstances.customerVehicle.update({
    where: { id: vehicleId },
    data: {
      imageUrl: nexonHeroUrl
    }
  });

  console.log('--- Updated Vehicle Image ---')
  console.log(JSON.stringify(updated, null, 2))
}

main()
  .catch(console.error)
  .finally(() => dbInstances.$disconnect())
