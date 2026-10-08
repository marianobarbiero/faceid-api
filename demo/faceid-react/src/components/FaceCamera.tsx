import { useEffect, useRef, useCallback, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  MP_MODEL_URL, MP_WASM_URL, MP_DELEGATE, MP_MIN_DETECTION, MP_MIN_SUPPRESS,
  AUTO_CAPTURE_MS, CAPTURE_QUALITY, MIN_FRAME_CONFIDENCE,
  MAX_MOVEMENT, MAX_FACE_ASYMMETRY,
} from '../config/mediapipe';
import { useLang } from '../context/LangContext';

interface FaceCameraProps {
  onCapture: (base64: string) => void;
  onFaceDetected: (detected: boolean) => void;
  autoCapture?: boolean;
}

// Overlay colors drawn on top of the (dark) video feed
const IDLE     = 'rgba(255,255,255,0.65)';
const DETECTED = '#fbbf24';
const STABLE   = '#22c55e';

type CamStatus = '' | 'detected' | 'stable';

export default function FaceCamera({ onCapture, onFaceDetected, autoCapture = false }: FaceCameraProps) {
  const { t } = useLang();
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastDetectedRef = useRef<boolean>(false);
  const faceStartRef    = useRef<number | null>(null);
  const capturedRef     = useRef<boolean>(false);
  const lastNoseRef     = useRef<{ x: number; y: number } | null>(null);

  const [progress, setProgress] = useState(0);
  const [ready, setReady]       = useState(false);
  const [initError, setInitError] = useState<'permission' | 'noCamera' | 'init' | null>(null);
  const [label, setLabel]       = useState<{ status: CamStatus; conf: string; color: string }>({
    status: '', conf: '', color: STABLE,
  });

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const offscreen = document.createElement('canvas');
    offscreen.width  = video.videoWidth;
    offscreen.height = video.videoHeight;
    offscreen.getContext('2d')!.drawImage(video, 0, 0);
    onCapture(offscreen.toDataURL('image/jpeg', CAPTURE_QUALITY).split(',')[1]);
  }, [onCapture]);

  useEffect(() => {
    let stream: MediaStream;

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(MP_WASM_URL);
      const create = (delegate: 'GPU' | 'CPU') => FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        minDetectionConfidence: MP_MIN_DETECTION,
        minSuppressionThreshold: MP_MIN_SUPPRESS,
      });
      try {
        detectorRef.current = await create(MP_DELEGATE);
      } catch (err) {
        // Some phones' GPUs don't support MediaPipe's WebGL path: retry on the CPU
        if (MP_DELEGATE !== 'GPU') throw err;
        console.warn('MediaPipe GPU delegate failed, falling back to CPU', err);
        detectorRef.current = await create('CPU');
      }

      stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          videoRef.current!.play();
          setReady(true);
          detect();
        };
      }
    }

    function detect() {
      const video    = videoRef.current;
      const canvas   = canvasRef.current;
      const detector = detectorRef.current;
      if (!video || !canvas || !detector || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const W = canvas.width  = video.videoWidth;
      const H = canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, W, H);

      const result   = detector.detectForVideo(video, performance.now());
      const detected = result.detections.length > 0;

      const bestDet = detected
        ? result.detections.reduce((a, b) =>
            (a.categories?.[0]?.score ?? 0) >= (b.categories?.[0]?.score ?? 0) ? a : b)
        : null;

      const frameConf = bestDet?.categories?.[0]?.score ?? 0;
      const kp        = bestDet?.keypoints ?? [];
      const rightEye  = kp[0];
      const leftEye   = kp[1];
      const noseTip   = kp[2];
      const mouth     = kp[3];

      // frontal check
      let isFrontal = true;
      if (rightEye && leftEye && noseTip) {
        const eyeMidX   = (rightEye.x + leftEye.x) / 2;
        const eyeSpan   = Math.abs(rightEye.x - leftEye.x) || 0.01;
        isFrontal = Math.abs(noseTip.x - eyeMidX) / eyeSpan < MAX_FACE_ASYMMETRY;
      }

      // movement check
      let isStill = true;
      if (noseTip) {
        if (lastNoseRef.current) {
          isStill = Math.hypot(
            noseTip.x - lastNoseRef.current.x,
            noseTip.y - lastNoseRef.current.y
          ) < MAX_MOVEMENT;
        }
        lastNoseRef.current = { x: noseTip.x, y: noseTip.y };
      }

      const stable = detected && frameConf >= MIN_FRAME_CONFIDENCE && isFrontal && isStill;
      const color  = stable ? STABLE : detected ? DETECTED : IDLE;

      if (detected !== lastDetectedRef.current) {
        lastDetectedRef.current = detected;
        onFaceDetected(detected);
      }

      // auto-capture
      if (autoCapture && !capturedRef.current) {
        if (stable) {
          faceStartRef.current ??= performance.now();
          const elapsed = performance.now() - faceStartRef.current;
          const pct = Math.min((elapsed / AUTO_CAPTURE_MS) * 100, 100);
          setProgress(pct);
          if (elapsed >= AUTO_CAPTURE_MS) {
            capturedRef.current = true;
            setProgress(0);
            doCapture();
          }
        } else {
          faceStartRef.current = null;
          setProgress(0);
        }
      }

      // ── CANVAS DRAWING ──────────────────────────────────────────
      // Mirror x: canvas has no CSS scaleX(-1), we mirror manually
      const mx = (x: number) => W - x; // mirror normalized x to pixel
      const my = (y: number) => y;     // y unchanged

      ctx.save();

      // --- Face guide: a centered oval that turns amber/green ---
      const r = Math.min(W, H);
      ctx.strokeStyle = color;
      ctx.lineWidth   = Math.max(2, r * 0.008);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.ellipse(W / 2, H / 2, r * 0.3, r * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();

      // --- Keypoint dots ---
      if (detected) {
        ctx.fillStyle = color;
        [rightEye, leftEye, noseTip, mouth].forEach((p) => {
          if (!p) return;
          ctx.beginPath();
          ctx.arc(mx(p.x * W), my(p.y * H), 3, 0, Math.PI * 2);
          ctx.fill();
        });
      }

      ctx.globalAlpha = 1;
      ctx.restore();
      // ────────────────────────────────────────────────────────────

      // update label state only on changes (avoid re-render flood)
      const newColor  = color;
      const newStatus: CamStatus = stable ? 'stable' : detected ? 'detected' : '';
      const newConf   = detected ? `${Math.round(frameConf * 100)}%` : '';
      setLabel(prev =>
        prev.status !== newStatus || prev.conf !== newConf || prev.color !== newColor
          ? { status: newStatus, conf: newConf, color: newColor }
          : prev
      );

      animFrameRef.current = requestAnimationFrame(detect);
    }

    init().catch((err: unknown) => {
      console.error(err);
      const name = err instanceof DOMException ? err.name : '';
      setInitError(
        name === 'NotAllowedError' ? 'permission'
        : name === 'NotFoundError' || name === 'NotReadableError' ? 'noCamera'
        : 'init'
      );
    });

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close();
      lastNoseRef.current = null;
    };
  }, [onFaceDetected, autoCapture, doCapture]);

  return (
    <div className="cam-card">
      <div className="cam-stage">
        <video
          ref={videoRef}
          style={{ display: 'block', width: '100%', transform: 'scaleX(-1)' }}
          playsInline
          muted
        />
        {/* canvas WITHOUT scaleX(-1) — we mirror coordinates manually */}
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        />
        {!ready && (
          <div className="cam-placeholder">
            {initError === 'permission' ? t.camera.errorPermission
              : initError === 'noCamera' ? t.camera.errorNoCamera
              : initError === 'init' ? t.camera.errorInit
              : t.camera.starting}
          </div>
        )}
      </div>

      {autoCapture && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="cam-bar">
        <div className="sdot" />
        <span>{t.camera.active}</span>
        {label.status && (
          <span className="cam-status" style={{ marginLeft: 'auto', color: label.status === 'stable' ? 'var(--success)' : 'var(--warn)' }}>
            {label.status === 'stable' ? t.camera.statusStable : t.camera.statusDetected}
            {label.conf && ` · ${label.conf}`}
          </span>
        )}
        {!autoCapture && (
          <button
            onClick={doCapture}
            className="btn-main"
            style={{ margin: '0 0 0 auto', width: 'auto', padding: '6px 16px', fontSize: 14 }}
          >
            {t.camera.btnCapture}
          </button>
        )}
      </div>
    </div>
  );
}
