import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'X-API-Key': import.meta.env.VITE_API_KEY,
    'Content-Type': 'application/json',
  },
});

export interface RegisterRequest {
  img: string;
  full_name: string;
  email?: string;
  external_id?: string | null;
}

export interface RegisterResponse {
  id: number;
  full_name: string;
  email: string | null;
  external_id: string | null;
  model_name: string;
  detector_backend: string;
  is_active: boolean;
  created_at: string;
}

export interface IdentifyMatch {
  email: string | null;
  score: number;
  threshold: number;
}

export interface IdentifyResponse {
  matches: IdentifyMatch[];
  is_real: boolean | null;
  antispoof_score: number | null;
}

export async function registerFace(data: RegisterRequest): Promise<RegisterResponse> {
  const res = await api.post<RegisterResponse>('/register', data);
  return res.data;
}

export async function identifyFace(img: string): Promise<IdentifyResponse> {
  const res = await api.post<IdentifyResponse>('/identify', { img });
  return res.data;
}
