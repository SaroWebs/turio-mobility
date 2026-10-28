import api from './api';

export type CmsPayload = Record<string, Record<string, Record<string, unknown>>>;

export async function fetchCms(app: 'customer-mobile' | 'driver-app'): Promise<CmsPayload> {
  const response = await api.get(`/public/cms/${app}`, { timeout: 5000 });
  return response.data?.data || {};
}

export function cmsText(cms: CmsPayload, page: string, section: string, key: string, fallback: string) {
  const value = cms[page]?.[section]?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}
