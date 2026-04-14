import { useEffect, useRef, useCallback, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';
import { MP_MODEL_URL, MP_DELEGATE, MP_MIN_DETECTION, MP_MIN_SUPPRESS, AUTO_CAPTURE_MS, CAPTURE_QUALITY, MIN_FRAME_CONFIDENCE, MAX_MOVEMENT, MAX_FACE_ASYMMETRY } from '../config/mediapipe';
import { useLang } from '../context/LangContext';

interface FaceCameraProps {
  onCapture: (base64: string) => void;
  onFaceDetected: (detected: boolean) => void;
  autoCapture?: boolean;
}

export default function FaceCamera({ onCapture, onFaceDetected, autoCapture = false }: FaceCameraProps) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<FaceDetector | null>(null);
  const animFrameRef = useRef<number>(0);
  const lastDetectedRef = useRef<boolean>(false);
  const faceStartRef = useRef<number | null>(null);
  const capturedRef = useRef<boolean>(false);
  const lastNoseRef = useRef<{ x: number; y: number } | null>(null);

  const [progress, setProgress] = useState(0); // 0–100
  const [ready, setReady] = useState(false);

  const doCapture = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const offscreen = document.createElement('canvas');
    offscreen.width = video.videoWidth;
    offscreen.height = video.videoHeight;
    offscreen.getContext('2d')!.drawImage(video, 0, 0);
    const base64 = offscreen.toDataURL('image/jpeg', CAPTURE_QUALITY).split(',')[1];
    onCapture(base64);
  }, [onCapture]);

  useEffect(() => {
    let stream: MediaStream;

    async function init() {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );
      detectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MP_MODEL_URL,
          delegate: MP_DELEGATE,
        },
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
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;
      if (!video || !canvas || !detector || video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(detect);
        return;
      }

      const result = detector.detectForVideo(video, performance.now());
      const ctx = canvas.getContext('2d')!;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const detected = result.detections.length > 0;

      // best detection by confidence
      const bestDet = detected
        ? result.detections.reduce((a, b) =>
            (a.categories?.[0]?.score ?? 0) >= (b.categories?.[0]?.score ?? 0) ? a : b)
        : null;

      const frameConfidence = bestDet?.categories?.[0]?.score ?? 0;

      // keypoints: [right_eye, left_eye, nose_tip, mouth, right_ear, left_ear]
      const kp = bestDet?.keypoints ?? [];
      const rightEye = kp[0];
      const leftEye  = kp[1];
      const noseTip  = kp[2];

      // frontal check — nose must be centered between eyes
      let isFrontal = true;
      if (rightEye && leftEye && noseTip) {
        const eyeMidX   = (rightEye.x + leftEye.x) / 2;
        const eyeSpan   = Math.abs(rightEye.x - leftEye.x) || 0.01;
        const asymmetry = Math.abs(noseTip.x - eyeMidX) / eyeSpan;
        isFrontal = asymmetry < MAX_FACE_ASYMMETRY;
      }

      // movement check — nose must not move more than threshold between frames
      let isStill = true;
      if (noseTip) {
        if (lastNoseRef.current) {
          const moved = Math.hypot(
            noseTip.x - lastNoseRef.current.x,
            noseTip.y - lastNoseRef.current.y
          );
          isStill = moved < MAX_MOVEMENT;
        }
        lastNoseRef.current = { x: noseTip.x, y: noseTip.y };
      }

      const stableDetection =
        detected &&
        frameConfidence >= MIN_FRAME_CONFIDENCE &&
        isFrontal &&
        isStill;

      if (detected !== lastDetectedRef.current) {
        lastDetectedRef.current = detected;
        onFaceDetected(detected);
      }

      // auto-capture logic — only counts frames where confidence >= MIN_FRAME_CONFIDENCE
      if (autoCapture && !capturedRef.current) {
        if (stableDetection) {
          if (faceStartRef.current === null) {
            faceStartRef.current = performance.now();
          }
          const elapsed = performance.now() - faceStartRef.current;
          const pct = Math.min((elapsed / AUTO_CAPTURE_MS) * 100, 100);
          setProgress(pct);
          if (elapsed >= AUTO_CAPTURE_MS) {
            capturedRef.current = true;
            setProgress(0);
            doCapture();
          }
        } else {
          // reset if face disappears or confidence drops
          faceStartRef.current = null;
          setProgress(0);
        }
      }

      for (const det of result.detections) {
        const bb = det.boundingBox;
        if (!bb) continue;
        // green = stable (high confidence), amber = detected but low confidence, red = none
        ctx.strokeStyle = stableDetection ? '#00e5c0' : detected ? '#f5a623' : '#ff4d6d';
        ctx.lineWidth = 2;
        ctx.strokeRect(bb.originX, bb.originY, bb.width, bb.height);
      }

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
      <div style={{ position: 'relative', width: '100%' }}>
        <video
          ref={videoRef}
          style={{ display: 'block', width: '100%', transform: 'scaleX(-1)' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', transform: 'scaleX(-1)' }}
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
        <div className="sdot" />
        <span>{t.camera.active}</span>
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
