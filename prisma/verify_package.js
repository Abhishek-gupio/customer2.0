const { dbInstances } = require('./dist/src/index');

async function main() {
  try {
    console.log('Fetching first customer from dbInstances...');
    const customer = await dbInstances.customer.findFirst();
    console.log('Success:', customer);
  } catch (err) {
    console.error('Error fetching customer:', err);
  }
}

main();
