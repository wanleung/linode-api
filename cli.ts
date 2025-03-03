import { Command } from 'commander';
import { createAccessKey, saveAccessKey, removeAccessKey, getAccessKeyByLabel, removeAccessKeyByLabel, listAllAccessKeys, uploadFile, createWebsite, deleteFile, deleteAllFiles, client } from './linode';

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

program
  .command('remove-by-label <label>')
  .description('Remove an access key by label')
  .action(async (label) => {
    try {
      await removeAccessKeyByLabel(label);
      console.log('Access key removed by label:', label);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      client.end();
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
    } finally {
      client.end();
    }
  });

program
  .command('upload <filePath> <bucketName> <label>')
  .description('Upload a file or directory to Linode Object Storage')
  .action(async (filePath, bucketName, label) => {
    try {
      const accessKey = await getAccessKeyByLabel(label);
      await uploadFile(filePath, bucketName, accessKey.access_key, accessKey.secret_key);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await client.end();
    }
  });

program
  .command('create-website <bucketName> <label>')
  .description('Create a website configuration for a bucket')
  .action(async (bucketName, label) => {
    try {
      const accessKey = await getAccessKeyByLabel(label);
      await createWebsite(bucketName, accessKey.access_key, accessKey.secret_key);
      console.log(`Website configuration applied to bucket ${bucketName}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await client.end();
    }
  });

program
  .command('deletefile <filePath> <bucketName> <label>')
  .description('Delete a file from Linode Object Storage')
  .action(async (filePath, bucketName, label) => {
    try {
      const accessKey = await getAccessKeyByLabel(label);
      await deleteFile(filePath, bucketName, accessKey.access_key, accessKey.secret_key);
      console.log(`File ${filePath} deleted from bucket ${bucketName}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await client.end();
    }
  });

program
  .command('deleteall <bucketName> <label>')
  .description('Delete all files from a bucket in Linode Object Storage')
  .action(async (bucketName, label) => {
    try {
      const accessKey = await getAccessKeyByLabel(label);
      await deleteAllFiles(bucketName, accessKey.access_key, accessKey.secret_key);
      console.log(`All files deleted from bucket ${bucketName}`);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      await client.end();
    }
  });

program.parse(process.argv);

// Ensure the PostgreSQL client connection is closed when the process exits
process.on('exit', () => {
  client.end();
});
