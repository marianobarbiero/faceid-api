import { useCallback, useRef, useState } from 'react';
import FaceCamera from '../components/FaceCamera';
import Icon from '../components/Icon';
import { analyzeFace, type FaceAnalysis } from '../api/faceid';
import { fileToJpegBase64 } from '../utils/image';
import { useLang } from '../context/LangContext';

type Mode = 'camera' | 'upload';
type Status = 'input' | 'loading' | 'done' | 'error';

interface Captured {
  base64: string;
  // Camera frames are shown mirrored (like a selfie); uploaded photos are shown as-is
  mirrored: boolean;
}

function Bars({ values, labels }: { values: Record<string, number>; labels: Record<string, string> }) {
  const rows = Object.entries(values).sort(([, a], [, b]) => b - a);
  return (
    <div className="bars">
      {rows.map(([key, value], i) => (
        <div key={key} className={`bar-row ${i === 0 ? 'top' : ''}`}>
          <span className="bar-label">{labels[key] ?? key}</span>
          <div className="bar-track"><div className="bar-fill" style={{ width: `${Math.max(value, 0.5)}%` }} /></div>
          <span className="bar-val">{value.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function FaceCard({ face, index }: { face: FaceAnalysis; index: number }) {
  const { t } = useLang();
  const a = t.analyze;
  const genderPct = face.dominant_gender && face.gender ? face.gender[face.dominant_gender] : null;

  return (
    <div className="panel face-card">
      <div className="face-card-head">
        <span className="face-badge">{index + 1}</span>
        <span className="panel-title" style={{ margin: 0 }}>{a.person} {index + 1}</span>
        <span className="face-conf">{a.detection} {Math.round(face.face_confidence * 100)}%</span>
      </div>

      <div className="face-stats">
        {face.age != null && (
          <div>
            <div className="stat-label">{a.age}</div>
            <div className="face-age">{face.age} <span>{a.years}</span></div>
          </div>
        )}
        {face.dominant_gender && (
          <div>
            <div className="stat-label">{a.gender}</div>
            <div className="face-gender">
              {a.genders[face.dominant_gender as keyof typeof a.genders] ?? face.dominant_gender}
              {genderPct != null && <span> {genderPct.toFixed(0)}%</span>}
            </div>
          </div>
        )}
      </div>

      {face.emotion && (
        <div className="face-section">
          <div className="stat-label">{a.emotion}</div>
          <Bars values={face.emotion} labels={a.emotions} />
        </div>
      )}
      {face.race && (
        <div className="face-section">
          <div className="stat-label">{a.race}</div>
          <Bars values={face.race} labels={a.races} />
        </div>
      )}
    </div>
  );
}

export default function AnalyzePage() {
  const { t } = useLang();
  const a = t.analyze;
  const [mode, setMode] = useState<Mode>('camera');
  const [status, setStatus] = useState<Status>('input');
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [faces, setFaces] = useState<FaceAnalysis[]>([]);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const analyze = useCallback(async (base64: string, mirrored: boolean) => {
    setCaptured({ base64, mirrored });
    setSize(null);
    setStatus('loading');
    setError(null);
    const start = performance.now();
    try {
      const res = await analyzeFace(base64);
      setFaces(res.faces);
      setElapsed(performance.now() - start);
      setStatus('done');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
      setStatus('error');
    }
  }, []);

  const handleCapture = useCallback((base64: string) => analyze(base64, true), [analyze]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      analyze(await fileToJpegBase64(file), false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus('error');
    }
  };

  const reset = () => {
    setStatus('input');
    setCaptured(null);
    setFaces([]);
    setElapsed(null);
    setError(null);
    setCameraKey((k) => k + 1);
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    reset();
  };

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-tag">{a.tag}</div>
        <h2 className="page-title">{a.title}</h2>
      </div>

      {status === 'input' && (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="segmented">
            <button className={mode === 'camera' ? 'active' : ''} onClick={() => switchMode('camera')}>
              <Icon name="camera" size={16} /> {a.modeCamera}
            </button>
            <button className={mode === 'upload' ? 'active' : ''} onClick={() => switchMode('upload')}>
              <Icon name="upload" size={16} /> {a.modeUpload}
            </button>
          </div>

          {mode === 'camera' && (
            <FaceCamera key={cameraKey} onCapture={handleCapture} onFaceDetected={() => {}} autoCapture />
          )}

          {mode === 'upload' && (
            <div className="panel upload-box">
              <Icon name="upload" size={28} />
              <div className="panel-title" style={{ margin: '8px 0 4px' }}>{a.uploadTitle}</div>
              <p className="hint">{a.uploadHint}</p>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />
              <button className="btn-main" style={{ width: 'auto', padding: '10px 20px', margin: 0 }} onClick={() => fileRef.current?.click()}>
                {a.btnChoose}
              </button>
            </div>
          )}
        </div>
      )}

      {status !== 'input' && captured && (
        <div className="analyze-layout">
          <div className="panel-wrap" style={{ paddingTop: 0 }}>
            <div className="analyze-photo" style={{ transform: captured.mirrored ? 'scaleX(-1)' : undefined }}>
              <img
                src={`data:image/jpeg;base64,${captured.base64}`}
                alt=""
                onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              />
              {size && status === 'done' && faces.map((f, i) => (
                <div
                  key={i}
                  className="face-box"
                  style={{
                    left: `${(f.region.x / size.w) * 100}%`,
                    top: `${(f.region.y / size.h) * 100}%`,
                    width: `${(f.region.w / size.w) * 100}%`,
                    height: `${(f.region.h / size.h) * 100}%`,
                  }}
                >
                  <span className="face-badge" style={{ transform: captured.mirrored ? 'scaleX(-1)' : undefined }}>{i + 1}</span>
                </div>
              ))}
            </div>
            {elapsed != null && (
              <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>{a.time}: {(elapsed / 1000).toFixed(1)} s</p>
            )}
          </div>

          <div className="panel-wrap analyze-results">
            {status === 'loading' && (
              <div className="panel"><div className="loading-row"><div className="spinner" /><span>{a.loading}</span></div></div>
            )}
            {status === 'error' && (
              <div className="panel"><div className="banner err">✕ {error}</div></div>
            )}
            {status === 'done' && faces.length === 0 && (
              <div className="panel">
                <div className="banner err" style={{ marginBottom: 6 }}>{a.noFaces}</div>
                <p className="hint" style={{ margin: 0 }}>{a.noFacesSub}</p>
              </div>
            )}
            {status === 'done' && faces.map((f, i) => <FaceCard key={i} face={f} index={i} />)}
            {status === 'done' && faces.length > 0 && <p className="hint">{a.disclaimer}</p>}
            {status !== 'loading' && (
              <button className="btn-main" onClick={reset}>{a.btnAgain}</button>
            )}
          </div>
        </div>
      )}

      {status === 'error' && !captured && (
        <div style={{ maxWidth: 520, margin: '16px auto 0' }} className="panel-wrap">
          <div className="banner err">✕ {error}</div>
          <button className="btn-main" onClick={reset}>{a.btnAgain}</button>
        </div>
      )}
    </div>
  );
}
