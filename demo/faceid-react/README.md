# FaceVault

Web app for real-time facial registration and identification, built with React + MediaPipe. Consumes the [faceid-api](https://github.com/mbarbiero/faceid-api) backend.

## Stack

- React + Vite (TypeScript)
- MediaPipe Tasks Vision — real-time face detection
- i18n — Spanish / English

## Setup

```bash
cp .env.example .env
# Edit .env with your API URL and key

npm install
npm run dev
```

## Environment Variables

| Variable | Description |
|---|---|
| `VITE_API_URL` | faceid-api base URL |
| `VITE_API_KEY` | API key (`X-API-Key` header) |
| `VITE_MP_DELEGATE` | MediaPipe delegate: `GPU` or `CPU` |
| `VITE_MP_MODEL` | Face model: `short_range` or `full_range` |
| `VITE_AUTO_CAPTURE_MS` | ms of stable face before auto-capture |
| `VITE_MIN_FRAME_CONFIDENCE` | Min detection confidence per frame (0–1) |
| `VITE_MAX_MOVEMENT` | Max face movement allowed (normalized 0–1) |
| `VITE_MAX_FACE_ASYMMETRY` | Max face asymmetry — rejects sideways faces (0–1) |

## Features

- **Identify** — auto-captures when a stable frontal face is detected, queries the backend and shows matches
- **Register** — step-by-step flow: fill data → auto-capture → result
