import type { AxiosRequestConfig, AxiosResponse } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { api, loginUser } from './studentApi';

let requests: AxiosRequestConfig[];

function responseFor(config: AxiosRequestConfig): AxiosResponse {
  return {
    config: config as AxiosResponse['config'],
    data: { message: 'ok' },
    headers: config.url === '/api/me' ? { 'x-csrf-token': 'csrf-token' } : {},
    status: 200,
    statusText: 'OK',
  };
}

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear();
    requests = [];
    api.defaults.adapter = async (config) => {
      requests.push(config);
      return responseFor(config);
    };
  });

  it('sends credentials and user authorization for regular requests', async () => {
    localStorage.setItem('token', 'user-token');

    await api.get('/api/tasks/');

    expect(requests[0].withCredentials).toBe(true);
    expect(requests[0].headers?.Authorization).toBe('Bearer user-token');
  });

  it('uses the admin token for admin routes', async () => {
    localStorage.setItem('token', 'user-token');
    localStorage.setItem('adminToken', 'admin-token');

    await api.get('/admin/users');

    expect(requests[0].headers?.Authorization).toBe('Bearer admin-token');
  });

  it('adds the issued CSRF token to later mutations', async () => {
    await api.get('/api/me');
    await api.put('/api/me/update', { username: 'updated' });

    expect(requests[1].headers?.['X-CSRF-Token']).toBe('csrf-token');
  });

  it('returns response data from login requests', async () => {
    await expect(loginUser('student@example.com', 'password123')).resolves.toEqual({
      message: 'ok',
    });
    expect(requests[0].url).toBe('/api/login/');
    expect(requests[0].method).toBe('post');
  });
});
