import axios from 'axios';
import { Client } from 'pg';
import { createAccessKey, saveAccessKey, removeAccessKey, getAccessKeyByLabel } from './linode';

jest.mock('axios');
jest.mock('pg', () => {
  const mClient = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn(),
  };
  return { Client: jest.fn(() => mClient) };
});

describe('Linode API functions', () => {
  const mockClient = new Client();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create an access key', async () => {
    const mockResponse = {
      data: {
        id: '123',
        label: 'my-access-key',
        access_key: 'access_key_value',
        secret_key: 'secret_key_value',
      },
    };
    (axios.post as jest.Mock).mockResolvedValue(mockResponse);

    const accessKey = await createAccessKey('my-access-key');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.linode.com/v4/object-storage/keys',
      { label: 'my-access-key' },
      { headers: { Authorization: 'Bearer your_linode_api_token' } }
    );
    expect(accessKey).toEqual(mockResponse.data);
  });

  it('should save the access key to the database', async () => {
    const accessKey = {
      id: '123',
      label: 'my-access-key',
      access_key: 'access_key_value',
      secret_key: 'secret_key_value',
    };

    await saveAccessKey(accessKey);

    expect(mockClient.query).toHaveBeenCalledWith(
      'INSERT INTO access_keys (id, label, access_key, secret_key) VALUES ($1, $2, $3, $4)',
      [accessKey.id, accessKey.label, accessKey.access_key, accessKey.secret_key]
    );
  });

  it('should remove an access key', async () => {
    (axios.delete as jest.Mock).mockResolvedValue({});

    await removeAccessKey('123');

    expect(axios.delete).toHaveBeenCalledWith(
      'https://api.linode.com/v4/object-storage/keys/123',
      { headers: { Authorization: 'Bearer your_linode_api_token' } }
    );
  });

  it('should get an access key by label from the database', async () => {
    const mockResponse = {
      rows: [
        {
          id: '123',
          label: 'my-access-key',
          access_key: 'access_key_value',
          secret_key: 'secret_key_value',
        },
      ],
    };
    mockClient.query.mockResolvedValue(mockResponse);

    const accessKey = await getAccessKeyByLabel('my-access-key');

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM access_keys WHERE label = $1',
      ['my-access-key']
    );
    expect(accessKey).toEqual(mockResponse.rows[0]);
  });

  it('should throw an error if access key not found', async () => {
    const mockResponse = { rows: [] };
    mockClient.query.mockResolvedValue(mockResponse);

    await expect(getAccessKeyByLabel('non-existent-key')).rejects.toThrow('Access key not found');

    expect(mockClient.query).toHaveBeenCalledWith(
      'SELECT * FROM access_keys WHERE label = $1',
      ['non-existent-key']
    );
  });
});