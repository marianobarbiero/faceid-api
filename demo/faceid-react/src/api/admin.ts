import axios from 'axios';

// The admin key is typed in by the operator and kept only for the browser tab session.
// It is never read from VITE_* env vars, so it is not compiled into the public bundle.
const STORAGE_KEY = 'adminKey';

export function getAdminKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string | null): void {
  try {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private mode): the key just won't survive a reload
  }
}

const admin = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/admin` });

admin.interceptors.request.use((config) => {
  const key = getAdminKey();
  if (key) config.headers.set('X-Admin-Key', key);
  return config;
});

export interface UserSummary {
  id: number;
  full_name: string;
  email: string | null;
  external_id: string | null;
  model_name: string;
  detector_backend: string;
  is_active: boolean;
  created_at: string;
  photos_count: number;
}

export interface UserListResponse {
  items: UserSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface ListUsersParams {
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listUsers(params: ListUsersParams = {}): Promise<UserListResponse> {
  const res = await admin.get<UserListResponse>('/users', {
    params: { ...params, q: params.q?.trim() || undefined },
  });
  return res.data;
}

export interface PhotoInfo {
  photo_id: number | null; // null = photo taken at registration
  created_at: string;
}

export interface UserDetail extends UserSummary {
  photos: PhotoInfo[];
}

export async function getUser(id: number): Promise<UserDetail> {
  const res = await admin.get<UserDetail>(`/users/${id}`);
  return res.data;
}

export async function deleteUser(id: number): Promise<void> {
  await admin.delete(`/users/${id}`);
}

// <img> cannot send the X-Admin-Key header, so images are fetched as blobs
export async function fetchUserImageUrl(id: number, photoId: number | null = null): Promise<string> {
  const path = photoId == null ? `/users/${id}/image` : `/users/${id}/photos/${photoId}/image`;
  const res = await admin.get<Blob>(path, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}

export function isUnauthorized(err: unknown): boolean {
  return axios.isAxiosError(err) && err.response?.status === 401;
}

export function errorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === 'string') return detail;
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}
