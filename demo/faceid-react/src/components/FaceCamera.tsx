import { useEffect, useRef, useCallback, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import {
  MP_MODEL_URL, MP_DELEGATE, MP_MIN_DETECTION, MP_MIN_SUPPRESS,
  AUTO_CAPTURE_MS, CAPTURE_QUALITY, MIN_FRAME_CONFIDENCE,
  MAX_MOVEMENT, MAX_FACE_ASYMMETRY,
} from '../config/mediapipe';
import { useLang } from '../context/LangContext';

interface FaceCameraProps {
  onCapture: (base64: string) => void;
  onFaceDetected: (detected: boolean) => void;
  autoCapture?: boolean;
}

const TEAL   = '#00e5c0';
const AMBER  = '#f5a623';

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
  const [label, setLabel]       = useState<{ status: string; conf: string; color: string }>({
    status: '', conf: '', color: TEAL,
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
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      detectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MP_MODEL_URL, delegate: MP_DELEGATE },
        runningMode: 'VIDEO',
        minDetectionConfidence: MP_MIN_DETECTION,
        minSuppressionThreshold: MP_MIN_SUPPRESS,
      });

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
      const color  = stable ? TEAL : detected ? AMBER : TEAL;

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

      // --- Scan line (when no stable face) ---
      if (!stable) {
        const period = 3000;
        const scanT  = (performance.now() % period) / period;
        const scanY  = H * 0.05 + H * 0.9 * scanT;
        const grad   = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0,   'transparent');
        grad.addColorStop(0.5, color);
        grad.addColorStop(1,   'transparent');
        ctx.globalAlpha  = 0.5;
        ctx.strokeStyle  = grad;
        ctx.lineWidth    = 1.5;
        ctx.shadowColor  = color;
        ctx.shadowBlur   = 6;
        ctx.beginPath();
        ctx.moveTo(0, scanY);
        ctx.lineTo(W, scanY);
        ctx.stroke();
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }

      // --- Face guide brackets (center of frame) ---
      const gx = W * 0.2, gy = H * 0.08;
      const gw = W * 0.6, gh = H * 0.84;
      const bs = Math.min(W, H) * 0.06; // bracket arm length

      ctx.strokeStyle  = color;
      ctx.lineWidth    = 2;
      ctx.globalAlpha  = stable ? 1 : detected ? 0.7 : 0.3;
      ctx.shadowColor  = color;
      ctx.shadowBlur   = stable ? 8 : 0;

      // draw one bracket corner
      const bracket = (x: number, y: number, dx: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(x, y + dy * bs);
        ctx.lineTo(x, y);
        ctx.lineTo(x + dx * bs, y);
        ctx.stroke();
      };

      bracket(gx,      gy,      1,  1);  // TL
      bracket(gx + gw, gy,     -1,  1);  // TR
      bracket(gx,      gy + gh, 1, -1);  // BL
      bracket(gx + gw, gy + gh,-1, -1);  // BR

      ctx.shadowBlur  = 0;
      ctx.globalAlpha = 1;

      // --- Keypoint dots ---
      if (detected) {
        const dots = [rightEye, leftEye, noseTip, mouth].filter(Boolean);
        dots.forEach((p, i) => {
          if (!p) return;
          const px = mx(p.x * W);
          const py = my(p.y * H);
          const delay = i * 0.4;
          const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 500) + delay);

          ctx.fillStyle   = color;
          ctx.shadowColor = color;
          ctx.globalAlpha = 0.4 + 0.6 * pulse;
          ctx.shadowBlur  = 6;
          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fill();

          // glow ring
          ctx.globalAlpha = 0.15 * pulse;
          ctx.beginPath();
          ctx.arc(px, py, 8, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur  = 0;
        ctx.globalAlpha = 1;
      }

      // --- Labels ---
      ctx.font        = `500 9px 'DM Mono', monospace`;
      ctx.fillStyle   = color;
      ctx.globalAlpha = 0.75;

      ctx.fillText('MESH', 10, 18);

      const liveW = ctx.measureText('LIVE').width;
      ctx.fillText('LIVE', W - liveW - 10, 18);

      if (detected) {
        const confStr = `${Math.round(frameConf * 100)}%`;
        const confW   = ctx.measureText(confStr).width;
        ctx.fillText(confStr, W - confW - 10, H - 10);

        const stStr = stable ? 'LOCK' : 'SCAN';
        ctx.fillText(stStr, 10, H - 10);
      }

      ctx.globalAlpha = 1;
      ctx.restore();
      // ────────────────────────────────────────────────────────────

      // update label state only on changes (avoid re-render flood)
      const newColor  = color;
      const newStatus = stable ? 'LOCK' : detected ? 'SCAN' : '';
      const newConf   = detected ? `${Math.round(frameConf * 100)}%` : '';
      setLabel(prev =>
        prev.status !== newStatus || prev.conf !== newConf || prev.color !== newColor
          ? { status: newStatus, conf: newConf, color: newColor }
          : prev
      );

      animFrameRef.current = requestAnimationFrame(detect);
    }

    init().catch(console.error);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      stream?.getTracks().forEach((t) => t.stop());
      detectorRef.current?.close();
      lastNoseRef.current = null;
    };
  }, [onFaceDetected, autoCapture, doCapture]);

  return (
    <div className="cam-card">
      <div style={{ position: 'relative', width: '100%', background: '#060a0d' }}>
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
          <div style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: '#060a0d', color: 'var(--muted)',
            fontFamily: 'var(--font-mono)', fontSize: 11,
            letterSpacing: '0.1em', textTransform: 'uppercase',
          }}>
            {t.camera.starting}
          </div>
        )}
      </div>

      {autoCapture && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
      )}

      <div className="cam-bar">
        <div className="sdot" style={{ background: label.color, boxShadow: `0 0 6px ${label.color}` }} />
        <span>{t.camera.active}</span>
        {label.status && (
          <span style={{ marginLeft: 8, fontSize: 9, color: label.color, letterSpacing: '0.12em' }}>
            {label.status}
          </span>
        )}
        {!autoCapture && (
          <button
            onClick={doCapture}
            className="btn-main"
            style={{ margin: '0 0 0 auto', width: 'auto', padding: '6px 18px', marginBottom: 0 }}
          >
            {t.camera.btnCapture}
          </button>
        )}
      </div>
    </div>
  );
}
