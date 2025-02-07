import axios from 'axios';
import { Client } from 'pg';

// Linode API base URL
const LINODE_API_URL = 'https://api.linode.com/v4';
const LINODE_API_TOKEN = 'your_linode_api_token'; // Replace with your Linode API token

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
      { label },
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

// Example usage
(async () => {
  try {
    const accessKey = await createAccessKey('my-access-key');
    await saveAccessKey(accessKey);
    // To remove the access key, uncomment the following line
    // await removeAccessKey(accessKey.id);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    client.end();
  }
})();

