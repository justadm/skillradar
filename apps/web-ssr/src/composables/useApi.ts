import { demoData } from '../demo';
import { useAuth } from './useAuth';

const apiBase = '/api/v1';

async function apiGet<T>(path: string): Promise<T> {
  const { token } = useAuth();
  if (!token.value) {
    return (demoData as any)[path] as T;
  }
  const res = await fetch(`${apiBase}/${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.value}`
    }
  });
  if (!res.ok) throw new Error('API_ERROR');
  return res.json();
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const { token } = useAuth();
  if (!token.value) throw new Error('UNAUTHORIZED');
  const res = await fetch(`${apiBase}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.value}`
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('API_ERROR');
  return res.json();
}

async function apiDelete<T>(path: string): Promise<T> {
  const { token } = useAuth();
  if (!token.value) throw new Error('UNAUTHORIZED');
  const res = await fetch(`${apiBase}/${path}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.value}`
    }
  });
  if (!res.ok) throw new Error('API_ERROR');
  return res.json();
}

async function apiDownload(path: string): Promise<Blob> {
  const { token } = useAuth();
  if (!token.value) throw new Error('UNAUTHORIZED');
  const res = await fetch(`${apiBase}/${path}`, {
    headers: {
      Authorization: `Bearer ${token.value}`
    }
  });
  if (!res.ok) throw new Error('API_ERROR');
  return res.blob();
}

export function useApi() {
  return {
    getDashboard: () => apiGet('dashboard'),
    getReports: () => apiGet('reports'),
    getRoles: () => apiGet('roles'),
    getCompetitors: () => apiGet('competitors'),
    getTemplate: () => apiGet('template'),
    getTeam: () => apiGet('team'),
    getBilling: () => apiGet('billing'),
    getSettings: () => apiGet('settings'),
    createReport: (payload: any) => apiPost('reports', payload),
    deleteReport: (id: string) => apiDelete(`reports/${id}`),
    exportReport: (id: string, format: 'pdf' | 'csv' = 'pdf') => apiDownload(`reports/${id}/export?format=${format}`),
    createRole: (payload: any) => apiPost('roles', payload),
    inviteTeam: (payload: any) => apiPost('team/invite', payload),
    deleteRole: (id: string) => apiDelete(`roles/${id}`)
  };
}
