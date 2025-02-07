import axios from 'axios';
import { Client } from 'pg';
import AWS from 'aws-sdk';
import fs from 'fs';
import dotenv from 'dotenv';

// Linode API base URL
const LINODE_API_URL = 'https://api.linode.com/v4';
const LINODE_API_TOKEN = 'your_linode_api_token'; // Replace with your Linode API token
const LINODE_BUKET_NAME = 'my-bucket';
const LINODE_REGION = 'us-east-1';
const LINODE_PERMISSION = 'read_write';

// PostgreSQL client setup
const client = new Client({
  user: 'your_pg_user',
  host: 'your_pg_host',
  database: 'your_pg_database',
  password: 'your_pg_password',
  port: 5432, // Default PostgreSQL port
});

client.connect();

// Function to create an access key
export async function createAccessKey(label: string): Promise<any> {
  try {
    const response = await axios.post(
      `${LINODE_API_URL}/object-storage/keys`,
      { label,
        bucket_access: [
            {
              bucket_name: LINODE_BUKET_NAME,
              permissions: LINODE_PERMISSION,
              region: LINODE_REGION,
            },
          ],
      },
      {
        headers: {
          Authorization: `Bearer ${LINODE_API_TOKEN}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error creating access key:', error);
    throw error;
  }
}

// Function to save the access key in PostgreSQL
export async function saveAccessKey(accessKey: any): Promise<void> {
  const query = 'INSERT INTO access_keys (id, label, access_key, secret_key) VALUES ($1, $2, $3, $4)';
  const values = [accessKey.id, accessKey.label, accessKey.access_key, accessKey.secret_key];

  try {
    await client.query(query, values);
    console.log('Access key saved to database');
  } catch (error) {
    console.error('Error saving access key to database:', error);
    throw error;
  }
}

// Function to remove an access key
export async function removeAccessKey(keyId: string): Promise<void> {
  try {
    await axios.delete(`${LINODE_API_URL}/object-storage/keys/${keyId}`, {
      headers: {
        Authorization: `Bearer ${LINODE_API_TOKEN}`,
      },
    });
    console.log('Access key removed from Object Storage');
  } catch (error) {
    console.error('Error removing access key:', error);
    throw error;
  }
}

// Function to get an access key by label from PostgreSQL
export async function getAccessKeyByLabel(label: string): Promise<any> {
  const query = 'SELECT * FROM access_keys WHERE label = $1';
  const values = [label];
  
  try {
    const res = await client.query(query, values);
    if (res.rows.length > 0) {
      return res.rows[0];
    } else {
      throw new Error('Access key not found');
    }
  } catch (error) {
    console.error('Error getting access key from database:', error);
    throw error;
  }
}

// Function to remove an access key by label
export async function removeAccessKeyByLabel(label: string): Promise<void> {
  try {
    const accessKey = await getAccessKeyByLabel(label);
    await removeAccessKey(accessKey.id);
    const query = 'DELETE FROM access_keys WHERE label = $1';
    const values = [label];
    await client.query(query, values);
    console.log('Access key removed from database and Object Storage');
  } catch (error) {
    console.error('Error removing access key by label:', error);
    throw error;
  }
}
  
// Function to list all access keys
export async function listAllAccessKeys(): Promise<any[]> {
  const query = 'SELECT * FROM access_keys';
  
  try {
    const res = await client.query(query);
    return res.rows;
  } catch (error) {
    console.error('Error listing all access keys:', error);
    throw error;
  }
}

// Function to upload a file to Linode Object Storage
export async function uploadFile(filePath: string, bucketName: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
    const s3 = new AWS.S3({
      accessKeyId,
      secretAccessKey,
      endpoint: `https://${LINODE_REGION}.linodeobjects.com`,
      region: LINODE_REGION,
      s3ForcePathStyle: true, // needed with minio?
      signatureVersion: 'v4',
    });
  
    const fileContent = fs.readFileSync(filePath);
    const fileName = filePath.split('/').pop();
  
    if (!fileName) {
      throw new Error('Invalid file path');
    }
  
    const params = {
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
    };
  
    try {
      await s3.upload(params).promise();
      console.log(`File uploaded successfully to ${bucketName}/${fileName}`);
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }
  
// Export the client for use in other modules
export { client };

