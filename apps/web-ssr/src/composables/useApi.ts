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

export function useApi() {
  return {
    getDashboard: () => apiGet('dashboard'),
    getReports: () => apiGet('reports'),
    getRoles: () => apiGet('roles'),
    getCompetitors: () => apiGet('competitors'),
    getTemplate: () => apiGet('template'),
    getTeam: () => apiGet('team'),
    getBilling: () => apiGet('billing'),
    getSettings: () => apiGet('settings')
  };
}
