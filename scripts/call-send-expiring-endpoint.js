const fetch = global.fetch || require('node-fetch');

async function main() {
  const ports = [3000, 3001];
  const body = { days: 5, channel: 'both', scope: 'all_active_tenants' };

  for (const port of ports) {
    const url = `http://localhost:${port}/api/reminders/send-expiring`;
    try {
      console.log('Trying', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-bypass': '1' },
        body: JSON.stringify(body),
      });
      const text = await res.text();
      console.log('Status', res.status);
      console.log('Response:', text);
      if (res.ok) return;
    } catch (err) {
      console.log('Error contacting', url, err.message || err);
    }
  }
  console.log('All attempts failed.');
}

main();
