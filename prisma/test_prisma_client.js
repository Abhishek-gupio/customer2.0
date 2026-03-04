require('dotenv').config();
console.log('DATABASE_URL from process.env:', process.env.DATABASE_URL);
const { dbInstances } = require('./dist/index');

async function test() {
    try {
        const customers = await dbInstances.customer.findMany({ take: 1 });
        console.log('SUCCESS: ', JSON.stringify(customers));
    } catch (err) {
        console.error('FULL ERROR:', err);
    }
}
test();
