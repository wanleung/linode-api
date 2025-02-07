import { Command } from 'commander';
import { createAccessKey, saveAccessKey, removeAccessKey, getAccessKeyByLabel} from './linode';
import { Client } from 'pg';

const program = new Command();

// PostgreSQL client setup
const client = new Client({
  user: 'your_pg_user',
  host: 'your_pg_host',
  database: 'your_pg_database',
  password: 'your_pg_password',
  port: 5432, // Default PostgreSQL port
});

client.connect();

program
  .command('create <label>')
  .description('Create an access key')
  .action(async (label) => {
    try {
      const accessKey = await createAccessKey(label);
      await saveAccessKey(accessKey);
      console.log('Access key created and saved:', accessKey);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      client.end();
    }
  });

program
  .command('remove <keyId>')
  .description('Remove an access key')
  .action(async (keyId) => {
    try {
      await removeAccessKey(keyId);
      console.log('Access key removed:', keyId);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      client.end();
    }
  });

program
  .command('get <label>')
  .description('Get an access key by label')
  .action(async (label) => {
  try {
    const accessKey = await getAccessKeyByLabel(label);
    console.log('Access key retrieved:', accessKey);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.end();
  }
});

program.parse(process.argv);