const MODEL_URLS: Record<string, string> = {
  short_range: 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite',
  full_range:  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_full_range/float16/1/blaze_face_full_range.tflite',
};

export const MP_MODEL_URL     = MODEL_URLS[import.meta.env.VITE_MP_MODEL] ?? MODEL_URLS.short_range;
export const MP_DELEGATE      = (import.meta.env.VITE_MP_DELEGATE || 'GPU') as 'GPU' | 'CPU';
export const MP_MIN_DETECTION = Number(import.meta.env.VITE_MP_MIN_DETECTION_CONFIDENCE) || 0.5;
export const MP_MIN_SUPPRESS  = Number(import.meta.env.VITE_MP_MIN_SUPPRESSION_THRESHOLD) || 0.3;
export const AUTO_CAPTURE_MS       = Number(import.meta.env.VITE_AUTO_CAPTURE_MS) || 1500;
export const CAPTURE_QUALITY       = Number(import.meta.env.VITE_CAPTURE_QUALITY)  || 0.9;
export const MIN_FRAME_CONFIDENCE  = Number(import.meta.env.VITE_MIN_FRAME_CONFIDENCE) || 0.85;
export const MAX_MOVEMENT          = Number(import.meta.env.VITE_MAX_MOVEMENT) || 0.02;
export const MAX_FACE_ASYMMETRY    = Number(import.meta.env.VITE_MAX_FACE_ASYMMETRY) || 0.35;
