import { Command } from 'commander';
import { createAccessKey, saveAccessKey, removeAccessKey, getAccessKeyByLabel, removeAccessKeyByLabel, listAllAccessKeys, client } from './linode';

const program = new Command();

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
    }
  });

program
  .command('remove-by-label <label>')
  .description('Remove an access key by label')
  .action(async (label) => {
    try {
      await removeAccessKeyByLabel(label);
      console.log('Access key removed by label:', label);
    } catch (error) {
      console.error('Error:', error);
    }
  });

program
  .command('list')
  .description('List all access keys')
  .action(async () => {
    try {
      const accessKeys = await listAllAccessKeys();
      console.log('Access keys:', accessKeys);
    } catch (error) {
      console.error('Error:', error);
    }
  });

program.parse(process.argv);

// Ensure the PostgreSQL client connection is closed when the process exits
process.on('exit', () => {
  client.end();
});