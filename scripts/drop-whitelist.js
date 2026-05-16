const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: "postgres://gamestore_dev:NWv4aD9KpRYyIBIy%21%40%23012@127.0.0.1:5433/gamestore_test",
  });

  try {
    await client.connect();
    await client.query('DROP TABLE IF EXISTS "user_whitelist_access" CASCADE');
    console.log('Dropped user_whitelist_access table');
  } catch (err) {
    console.error('Error dropping table:', err);
  } finally {
    await client.end();
  }
}

main();
