import { useState, useCallback } from 'react';
import FaceCamera from '../components/FaceCamera';
import { registerFace, type RegisterResponse } from '../api/faceid';
import { useLang } from '../context/LangContext';

type Step = 'form' | 'camera' | 'result';

interface RegisterPageProps {
  onIdentify: () => void;
}

export default function RegisterPage({ onIdentify }: RegisterPageProps) {
  const { t } = useLang();
  const [step, setStep] = useState<Step>('form');
  const [fullName, setFullName] = useState('John Doe');
  const [email, setEmail] = useState(() => `${crypto.randomUUID()}@example.com`);
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [result, setResult] = useState<RegisterResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) return;
    setError(null);
    setStep('camera');
  };

  const handleCapture = useCallback(async (base64: string) => {
    setCapturedImg(base64);
    setLoading(true);
    setError(null);
    try {
      const res = await registerFace({
        img: base64,
        full_name: fullName.trim(),
        email: email.trim() || undefined,
      });
      setResult(res);
      setStep('result');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed.';
      setError(msg);
      setCapturedImg(null);
    } finally {
      setLoading(false);
    }
  }, [fullName, email]);

  const handleReset = () => {
    setStep('form');
    setFullName('John Doe');
    setEmail(`${crypto.randomUUID()}@example.com`);
    setCapturedImg(null);
    setResult(null);
    setError(null);
  };

  return (
    <div className="page-inner">
      <div className="page-header" style={{ maxWidth: 520, margin: '0 auto' }}>
        <div className="page-tag">{t.register.tag}</div>
        <h2 className="page-title">{t.register.title}</h2>
      </div>

      {/* STEP 1 — Form */}
      {step === 'form' && (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="panel">
            <div className="panel-title">{t.register.panelTitle}</div>
            <form onSubmit={handleFormSubmit}>
              <div className="fg">
                <label className="fl">{t.register.labelName}</label>
                <input
                  className="fi"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="fg">
                <label className="fl">{t.register.labelEmail}</label>
                <input
                  className="fi"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-main">{t.register.btnContinue}</button>
            </form>
          </div>
        </div>
      )}

      {/* STEP 2 — Camera */}
      {step === 'camera' && (
        <div style={{ maxWidth: 860, margin: '0 auto' }}><div className="two-col">
          {capturedImg ? (
            <div className="cam-card">
              <img
                src={`data:image/jpeg;base64,${capturedImg}`}
                alt="Captured frame"
                style={{ display: 'block', width: '100%', transform: 'scaleX(-1)' }}
              />
              <div className="cam-bar">
                <span style={{ color: 'var(--muted)' }}>{t.camera.frameCaptured}</span>
              </div>
            </div>
          ) : (
            <FaceCamera onCapture={handleCapture} onFaceDetected={() => {}} autoCapture />
          )}

          <div className="panel-wrap">
            <div className="panel">
              <div className="panel-title">{t.register.panelTitle}</div>
              <div className="fg">
                <label className="fl">{t.register.labelNameDisabled}</label>
                <input className="fi" value={fullName} disabled />
              </div>
              <div className="fg">
                <label className="fl">{t.register.labelEmail}</label>
                <input className="fi" value={email} disabled />
              </div>
              {loading && (
                <div className="loading-row">
                  <div className="spinner" />
                  <span>{t.register.loading}</span>
                </div>
              )}
              {error && <div className="banner err">✕ &nbsp;{error}</div>}
              {!loading && (
                <button className="btn-ghost" onClick={() => setStep('form')}>{t.register.btnBack}</button>
              )}
            </div>
          </div>
        </div></div>
      )}

      {/* STEP 3 — Result */}
      {step === 'result' && result && capturedImg && (
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <div className="panel-wrap">
            <div className="panel">
              <div className="panel-title">{t.register.resultTitle}</div>
              <div className="banner ok">✓ &nbsp;<strong>{result.full_name}</strong> {t.register.registered}</div>
              {[
                [t.register.labelId,       result.id],
                [t.register.labelNombre,   result.full_name],
                [t.register.labelEmail2,   result.email ?? '—'],
                [t.register.labelModel,    result.model_name],
                [t.register.labelDetector, result.detector_backend],
              ].map(([label, value]) => (
                <div key={label as string} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 12 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 72, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 10 }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
              <div style={{ marginTop: 16 }}>
                <button className="btn-main" onClick={handleReset}>{t.register.btnRegisterAnother}</button>
                <button className="btn-ghost" onClick={onIdentify}>{t.register.btnGoIdentify}</button>
              </div>
            </div>
          </div>
          <div className="cam-card" style={{ marginTop: 16 }}>
            <img
              src={`data:image/jpeg;base64,${capturedImg}`}
              alt="Captured"
              style={{ display: 'block', width: '100%', transform: 'scaleX(-1)' }}
            />
            <div className="cam-bar">
              <div className="sdot" />
              <span>{t.register.photoCaptured}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
