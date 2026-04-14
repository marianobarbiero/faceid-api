import { useState, useCallback } from 'react';
import FaceCamera from '../components/FaceCamera';
import { identifyFace, type IdentifyMatch } from '../api/faceid';
import { scorePercent } from '../utils/score';
import { useLang } from '../context/LangContext';

type Status = 'scanning' | 'loading' | 'done' | 'error';

export default function IdentifyPage() {
  const { t } = useLang();
  const [status, setStatus] = useState<Status>('scanning');
  const [faceDetected, setFaceDetected] = useState(false);
  const [matches, setMatches] = useState<IdentifyMatch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [frozenFrame, setFrozenFrame] = useState<string | null>(null);

  const handleCapture = useCallback(async (base64: string) => {
    setFrozenFrame(base64);
    setStatus('loading');
    try {
      const res = await identifyFace(base64);
      setMatches(res.matches);
      setStatus('done');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Identification failed.';
      setError(msg);
      setStatus('error');
    }
  }, []);

  const handleRetry = () => {
    setStatus('scanning');
    setMatches(null);
    setError(null);
    setFaceDetected(false);
    setFrozenFrame(null);
    setCameraKey((k) => k + 1);
  };

  const locked = status !== 'scanning';

  return (
    <div className="page-inner">
      <div className="page-header" style={locked ? { maxWidth: 520, margin: '0 auto' } : undefined}>
        <div className="page-tag">{t.identify.tag}</div>
        <h2 className="page-title">{t.identify.title}</h2>
      </div>

      <div className={locked ? '' : 'two-col'} style={locked ? { maxWidth: 520, margin: '0 auto' } : undefined}>
        {!locked && (
          <FaceCamera
            key={cameraKey}
            onCapture={handleCapture}
            onFaceDetected={setFaceDetected}
            autoCapture
          />
        )}

        <div className="panel-wrap">
          <div className="panel">
            <div className="panel-title">{t.identify.panelTitle}</div>

            {status === 'scanning' && (
              <>
                <p className="hint">{t.identify.hint}</p>
                <div className="val-row">
                  {faceDetected
                    ? <div className="vi ok">✓ &nbsp;{t.identify.faceDetected}</div>
                    : <div className="vi warn">○ &nbsp;{t.identify.waitingFace}</div>
                  }
                </div>
              </>
            )}

            {status === 'loading' && (
              <div className="loading-row">
                <div className="spinner" />
                <span>{t.identify.loading}</span>
              </div>
            )}

            {status === 'error' && (
              <>
                <div className="banner err">✕ &nbsp;{error}</div>
                <button className="btn-main" onClick={handleRetry}>{t.identify.btnRetry}</button>
              </>
            )}

            {status === 'done' && matches !== null && (
              <>
                {frozenFrame && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 }}>
                    <img
                      src={`data:image/jpeg;base64,${frozenFrame}`}
                      alt="Foto enviada"
                      style={{ width: '100%', maxWidth: 384, aspectRatio: '1', objectFit: 'cover', borderRadius: 4, transform: 'scaleX(-1)' }}
                    />
                    <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t.identify.photoSent}</span>
                  </div>
                )}
                {matches.length === 0 ? (
                  <div className="result-card bad">
                    <div className="result-name">{t.identify.noMatch}</div>
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>{t.identify.noMatchSub}</p>
                  </div>
                ) : (
                  matches.map((m, i) => (
                    <div key={i} className="result-card">
                      <div className="result-name">{m.email ?? '—'}</div>
                      <div className="score-label">{t.identify.similarity}</div>
                      <div className="score-row">
                        <div className="score-track">
                          <div className="score-fill" style={{ width: `${scorePercent(m.score, m.threshold)}%` }} />
                        </div>
                        <div className="score-val">{m.score.toFixed(3)}</div>
                      </div>
                    </div>
                  ))
                )}
                <button className="btn-main" onClick={handleRetry}>{t.identify.btnScanAgain}</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
