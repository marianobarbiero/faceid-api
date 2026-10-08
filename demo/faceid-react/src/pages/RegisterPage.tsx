import { useState, useCallback } from 'react';
import FaceCamera from '../components/FaceCamera';
import axios from 'axios';
import { addPhoto, registerFace, type RegisterResponse } from '../api/faceid';
import { useLang } from '../context/LangContext';

type Step = 'form' | 'camera' | 'result' | 'more';

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
  const [photosCount, setPhotosCount] = useState(1);
  const [addNotice, setAddNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [duplicate, setDuplicate] = useState<{ email: string | null; score: number } | null>(null);

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
    setDuplicate(null);
    try {
      const res = await registerFace({
        img: base64,
        full_name: fullName.trim(),
        email: email.trim() || undefined,
      });
      setResult(res);
      setStep('result');
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : null;
      if (detail?.code === 'face_already_registered') {
        // Keep the frozen frame (camera stays off) so it doesn't auto-capture again
        setDuplicate({ email: detail.email, score: detail.score });
        return;
      }
      setError(typeof detail === 'string' ? detail : err instanceof Error ? err.message : 'Registration failed.');
      setCapturedImg(null);
    } finally {
      setLoading(false);
    }
  }, [fullName, email]);

  const handleAddPhoto = useCallback(async (base64: string) => {
    if (!result) return;
    setAdding(true);
    try {
      const res = await addPhoto(result.id, base64);
      setPhotosCount(res.photos_count);
      setAddNotice({ ok: true, text: `${t.register.photoAdded} (${res.photos_count})` });
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? String(err.response?.data?.detail ?? err.message) : String(err);
      setAddNotice({ ok: false, text: detail.startsWith('Photo does not match') ? t.register.photoMismatch : detail });
    } finally {
      setAdding(false);
      setStep('result');
    }
  }, [result, t]);

  const handleReset = () => {
    setPhotosCount(1);
    setAddNotice(null);
    setDuplicate(null);
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
              {duplicate && (
                <div className="duplicate-box">
                  <div className="step-title">{t.register.alreadyTitle}</div>
                  <p className="hint" style={{ margin: '4px 0 8px' }}>
                    {t.register.alreadyText} <strong>{duplicate.email ?? '—'}</strong>
                  </p>
                  <div className="hint" style={{ margin: '0 0 12px' }}>
                    {t.register.similarity}: <strong>{Math.round(duplicate.score * 100)}%</strong>
                  </div>
                  <button className="btn-main" onClick={onIdentify}>{t.register.btnGoIdentify}</button>
                  <button className="btn-ghost" onClick={() => { setDuplicate(null); setCapturedImg(null); setStep('form'); }}>{t.register.btnBack}</button>
                </div>
              )}
              {!loading && !duplicate && (
                <button className="btn-ghost" onClick={() => setStep('form')}>{t.register.btnBack}</button>
              )}
            </div>
          </div>
        </div></div>
      )}

      {/* STEP 4 — Add another photo */}
      {step === 'more' && result && (
        <div style={{ maxWidth: 860, margin: '0 auto' }}><div className="two-col">
          {adding ? (
            <div className="panel-wrap"><div className="panel"><div className="loading-row"><div className="spinner" /><span>{t.register.adding}</span></div></div></div>
          ) : (
            <FaceCamera onCapture={handleAddPhoto} onFaceDetected={() => {}} autoCapture />
          )}
          <div className="panel-wrap">
            <div className="panel">
              <div className="panel-title">{t.register.addingTitle}: {result.full_name}</div>
              <p className="hint">{t.register.addingHint}</p>
              {!adding && <button className="btn-ghost" onClick={() => setStep('result')}>{t.register.btnCancel}</button>}
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
                <div key={label as string} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 80 }}>{label}</span>
                  <span>{value}</span>
                </div>
              ))}
              <div className="more-photos">
                <div className="step-title">{t.register.moreTitle}</div>
                <p className="hint" style={{ margin: '4px 0 10px' }}>{t.register.moreHint}</p>
                {addNotice && <div className={`banner ${addNotice.ok ? 'ok' : 'err'}`}>{addNotice.ok ? '✓' : '✕'} {addNotice.text}</div>}
                <div className="more-photos-row">
                  <span className="hint" style={{ margin: 0 }}>{t.register.photosCount}: <strong>{photosCount}</strong></span>
                  <button className="btn-ghost" onClick={() => { setAddNotice(null); setStep('more'); }}>{t.register.btnAddPhoto}</button>
                </div>
              </div>
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
              <span>{t.register.photoCaptured}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
