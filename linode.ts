import axios from 'axios';
import { Client } from 'pg';
import AWS from 'aws-sdk';
import fs from 'fs';
import { readdirSync, statSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import path from 'path';
import mime from 'mime-types';
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

  async function uploadSingleFile(file: string) {
    const fileContent = readFileSync(file);
    const contentType = mime.lookup(file) || 'application/octet-stream';
    const key = file;

    const params = {
      Bucket: bucketName,
      Key: key,
      Body: fileContent,
      ContentType: contentType,
    };

    try {
      await s3.upload(params).promise();
      console.log(`File uploaded successfully to ${bucketName}/${key}`);
    } catch (error) {
      console.error(`Error uploading file ${file}:`, error);
      throw error;
    }
  }

  async function uploadDirectory(directory: string) {
    const items = readdirSync(directory);

    for (const item of items) {
      const fullPath = join(directory, item);
      const stats = statSync(fullPath);

      if (stats.isDirectory()) {
        // Create a folder in the bucket
        const folderKey = fullPath;
        //await s3.putObject({
        //  Bucket: bucketName,
        //  Key: folderKey,
        //}).promise();
        //console.log(`Folder created successfully in ${bucketName}/${folderKey}`);

        await uploadDirectory(fullPath);
      } else {
        await uploadSingleFile(fullPath);
      }
    }
  }

  const stats = statSync(filePath);
  if (stats.isDirectory()) {
    await uploadDirectory(filePath);
  } else {
    await uploadSingleFile(filePath);
  }
}

  export async function createWebsite(bucketName: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
    const s3 = new AWS.S3({
      accessKeyId,
      secretAccessKey,
      endpoint: `https://${LINODE_REGION}.linodeobjects.com`,
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
    });
  
    const websiteParams = {
      Bucket: bucketName,
      WebsiteConfiguration: {
        IndexDocument: {
          Suffix: 'index.html',
        },
        ErrorDocument: {
          Key: 'error.html',
        },
      },
    };
  
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicReadGetObject',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: `arn:aws:s3:::${bucketName}/*`,
        },
      ],
    };
  
    try {
      await s3.putBucketWebsite(websiteParams).promise();
      await s3.putBucketPolicy({
        Bucket: bucketName,
        Policy: JSON.stringify(bucketPolicy),
      }).promise();
  
      // Add Cache-Control header for 1 year
      const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();
      //const cacheControlHeader = 'max-age=31536000'; // 1 year in seconds
  
      for (const object of objects.Contents || []) {
        if (object.Key) {
          await s3.copyObject({
            Bucket: bucketName,
            CopySource: `${bucketName}/${object.Key}`,
            Key: object.Key,
            MetadataDirective: 'REPLACE',
      //      CacheControl: cacheControlHeader,
          }).promise();
        }
      }
  
      console.log(`Website configuration applied to bucket ${bucketName}`);
    } catch (error) {
      console.error('Error creating website configuration:', error);
      throw error;
    }
  }

export async function deleteFile(filePath: string, bucketName: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${LINODE_REGION}.linodeobjects.com`,
    region: LINODE_REGION,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  });

  const fileName = path.basename(filePath);

  const params = {
    Bucket: bucketName,
    Key: fileName,
  };

  try {
    await s3.deleteObject(params).promise();
    console.log(`File ${fileName} deleted from bucket ${bucketName}`);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
}

// Function to delete all files from a bucket in Linode Object Storage
export async function deleteAllFiles(bucketName: string, accessKeyId: string, secretAccessKey: string): Promise<void> {
  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    endpoint: `https://${LINODE_REGION}.linodeobjects.com`,
    region: LINODE_REGION,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  });

  try {
    const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise();

    for (const object of objects.Contents || []) {
      //console.log(object);
      if (object.Key) {
        console.log(object.Key);
        await s3.deleteObject({
          Bucket: bucketName,
          Key: object.Key,
        }).promise();
      }
    }

    console.log(`All files deleted from bucket ${bucketName}`);
  } catch (error) {
    console.error('Error deleting all files:', error);
    throw error;
  }
}

// Export the client for use in other modules
export { client };

