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

export interface FaceRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FaceAnalysis {
  age?: number;
  dominant_gender?: string;
  gender?: Record<string, number>;
  dominant_emotion?: string;
  emotion?: Record<string, number>;
  dominant_race?: string;
  race?: Record<string, number>;
  region: FaceRegion;
  face_confidence: number;
}

export interface AnalyzeResponse {
  faces: FaceAnalysis[];
}

export async function analyzeFace(img: string): Promise<AnalyzeResponse> {
  const res = await api.post<AnalyzeResponse>('/analyze', {
    img,
    actions: ['age', 'gender', 'emotion', 'race'],
  });
  return res.data;
}

export interface AddPhotoResponse {
  photo_id: number;
  registration_id: number;
  photos_count: number;
  distance: number;
}

export async function addPhoto(registrationId: number, img: string): Promise<AddPhotoResponse> {
  const res = await api.post<AddPhotoResponse>(`/register/${registrationId}/photos`, { img });
  return res.data;
}

export interface ApiInfo {
  model_name: string;
  detector_backend: string;
  distance_metric: string;
  match_threshold: number;
  anti_spoofing: boolean;
}

export async function getInfo(): Promise<ApiInfo> {
  const res = await api.get<ApiInfo>('/info');
  return res.data;
}
