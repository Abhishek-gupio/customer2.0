
import { dbInstances } from './src/index';

async function main() {
  const intervals = await dbInstances.oemSuggestedInterval.findMany({
    where: {
      make: 'tata'
    }
  });
  console.log(`TATA Intervals: ${intervals.length}`);
  console.log(JSON.stringify(intervals, null, 2).substring(0, 1000));
}

main().finally(() => dbInstances.$disconnect());
