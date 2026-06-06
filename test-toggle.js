const fetch = require('node-fetch');

async function test() {
  const adminId = 'some-support-id'; // Replace with a real ID if needed for local test
  const res = await fetch('http://localhost:9000/api/v1/admin/manage/admins/test-id/toggle-support-customers', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer YOUR_TOKEN_HERE',
      'Content-Type': 'application/json'
    }
  });
  const json = await res.json();
  console.log(json);
}

test();
