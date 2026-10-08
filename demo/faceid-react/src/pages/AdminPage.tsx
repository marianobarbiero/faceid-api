import { useCallback, useEffect, useRef, useState } from 'react';
import {
  deleteUser,
  errorMessage,
  fetchUserImageUrl,
  getAdminKey,
  getUser,
  isUnauthorized,
  listUsers,
  setAdminKey,
  type UserDetail,
  type UserListResponse,
} from '../api/admin';
import { useLang } from '../context/LangContext';

const PAGE_SIZE = 25;

interface UserThumbProps {
  id: number;
  alt: string;
  photoId?: number | null;
  className?: string;
}

function UserThumb({ id, alt, photoId = null, className = 'user-thumb' }: UserThumbProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetchUserImageUrl(id, photoId)
      .then((objectUrl) => {
        url = objectUrl;
        if (cancelled) URL.revokeObjectURL(objectUrl);
        else setSrc(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [id, photoId]);

  if (src) return <img className={className} src={src} alt={alt} loading="lazy" />;
  return <div className={`${className} placeholder`}>{failed ? '✕' : ''}</div>;
}

interface UserDetailModalProps {
  userId: number;
  formatDate: (iso: string) => string;
  onClose: () => void;
  onDeleted: () => void;
}

function UserDetailModal({ userId, formatDate, onClose, onDeleted }: UserDetailModalProps) {
  const { t } = useLang();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getUser(userId).then(setDetail).catch((err: unknown) => setError(errorMessage(err)));
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !deleting && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, deleting]);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteUser(userId);
      onDeleted();
    } catch (err: unknown) {
      setError(errorMessage(err));
      setDeleting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !deleting && onClose()}>
      <div className="modal panel" role="dialog" aria-modal="true" aria-label={t.admin.detailTitle} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <div className="panel-title" style={{ margin: 0 }}>{t.admin.detailTitle}</div>
          <button className="btn-ghost modal-close" onClick={onClose} disabled={deleting}>{t.admin.btnClose}</button>
        </div>

        {error && <div className="banner err">✕ {error}</div>}
        {!detail && !error && <div className="loading-row"><div className="spinner" /><span>{t.admin.loading}</span></div>}

        {detail && (
          <>
            <div className="detail-info">
              {[
                ['ID', `#${detail.id}`],
                [t.admin.colName, detail.full_name],
                [t.admin.colEmail, detail.email ?? '—'],
                [t.admin.colExternalId, detail.external_id ?? '—'],
                [t.admin.colModel, `${detail.model_name} · ${detail.detector_backend}`],
                [t.admin.colStatus, detail.is_active ? t.admin.active : t.admin.inactive],
                [t.admin.colCreated, formatDate(detail.created_at)],
              ].map(([label, value]) => (
                <div key={label} className="detail-row"><span>{label}</span><strong>{value}</strong></div>
              ))}
            </div>

            <div className="stat-label" style={{ margin: '18px 0 8px' }}>{t.admin.photos} ({detail.photos.length})</div>
            <div className="photo-grid">
              {detail.photos.map((p) => (
                <figure key={p.photo_id ?? 'main'}>
                  <UserThumb id={detail.id} photoId={p.photo_id} alt={detail.full_name} className="photo-tile" />
                  <figcaption>{p.photo_id == null ? t.admin.mainPhoto : t.admin.extraPhoto}<br />{formatDate(p.created_at)}</figcaption>
                </figure>
              ))}
            </div>

            <div className="danger-zone">
              {!confirming ? (
                <button className="btn-danger" onClick={() => setConfirming(true)}>{t.admin.btnDelete}</button>
              ) : (
                <>
                  <p className="hint" style={{ marginBottom: 10 }}>{t.admin.deleteWarning}</p>
                  <div className="danger-actions">
                    <button className="btn-danger" onClick={handleDelete} disabled={deleting}>
                      {deleting ? t.admin.deleting : t.admin.btnConfirmDelete}
                    </button>
                    <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={deleting}>{t.admin.btnCancel}</button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function AdminLogin({ onLogin }: { onLogin: () => void }) {
  const { t } = useLang();
  const [key, setKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError(null);
    setAdminKey(key.trim());
    try {
      await listUsers({ limit: 1 });
      onLogin();
    } catch (err: unknown) {
      setAdminKey(null);
      setError(isUnauthorized(err) ? t.admin.invalidKey : errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '0 auto' }}>
      <div className="panel">
        <div className="panel-title">{t.admin.loginTitle}</div>
        <p className="hint" style={{ marginBottom: 16 }}>{t.admin.loginHint}</p>
        <form onSubmit={handleSubmit}>
          <div className="fg">
            <label className="fl" htmlFor="admin-key">{t.admin.labelKey}</label>
            <input
              id="admin-key"
              className="fi"
              type="password"
              autoComplete="current-password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              required
            />
          </div>
          {error && <div className="banner err">✕ &nbsp;{error}</div>}
          <button type="submit" className="btn-main" disabled={loading}>
            {loading ? t.admin.loading : t.admin.btnLogin}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t, lang } = useLang();
  const [authed, setAuthed] = useState(() => getAdminKey() !== null);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<UserListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Only the latest request may update the table (an older, slower one must not overwrite it)
  const requestSeq = useRef(0);

  const logout = useCallback(() => {
    setAdminKey(null);
    setAuthed(false);
    setData(null);
  }, []);

  // Debounce the search box
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(search);
      setOffset(0);
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await listUsers({ q: query, limit: PAGE_SIZE, offset });
      if (seq === requestSeq.current) setData(result);
    } catch (err: unknown) {
      if (seq !== requestSeq.current) return;
      if (isUnauthorized(err)) logout();
      else setError(errorMessage(err));
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [query, offset, logout]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(lang === 'es' ? 'es-AR' : 'en-US', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

  const total = data?.total ?? 0;
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page-inner">
      <div className="page-header">
        <div className="page-tag">{t.admin.tag}</div>
        <h2 className="page-title">{t.admin.title}</h2>
      </div>

      {!authed && <AdminLogin onLogin={() => setAuthed(true)} />}

      {authed && (
        <div className="panel">
          <div className="admin-toolbar">
            <input
              className="fi"
              type="search"
              placeholder={t.admin.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="admin-toolbar-actions">
              <span className="admin-total">{total} {t.admin.total}</span>
              <button className="btn-ghost" onClick={load} disabled={loading}>{t.admin.btnRefresh}</button>
              <button className="btn-ghost" onClick={logout}>{t.admin.btnLogout}</button>
            </div>
          </div>

          {error && <div className="banner err">✕ &nbsp;{error}</div>}
          {notice && <div className="banner ok">✓ {notice}</div>}
          {loading && !data && (
            <div className="loading-row"><div className="spinner" /><span>{t.admin.loading}</span></div>
          )}
          {data && data.items.length === 0 && (
            <p className="hint">{query ? t.admin.noResults : t.admin.empty}</p>
          )}

          {data && data.items.length > 0 && (
            <table className="user-table" style={{ opacity: loading ? 0.6 : 1 }}>
              <thead>
                <tr>
                  <th>{t.admin.colPhoto}</th>
                  <th>{t.admin.colName}</th>
                  <th>{t.admin.colEmail}</th>
                  <th>{t.admin.colExternalId}</th>
                  <th>{t.admin.colModel}</th>
                  <th>{t.admin.colPhotos}</th>
                  <th>{t.admin.colStatus}</th>
                  <th>{t.admin.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr
                    key={user.id}
                    className="clickable"
                    tabIndex={0}
                    title={t.admin.viewDetail}
                    onClick={() => setSelected(user.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelected(user.id)}
                  >
                    <td><UserThumb id={user.id} alt={user.full_name} /></td>
                    <td data-label={t.admin.colName}>
                      <strong>{user.full_name}</strong>
                      <span className="user-id">#{user.id}</span>
                    </td>
                    <td data-label={t.admin.colEmail}>{user.email ?? '—'}</td>
                    <td data-label={t.admin.colExternalId}>{user.external_id ?? '—'}</td>
                    <td data-label={t.admin.colModel}>{user.model_name} · {user.detector_backend}</td>
                    <td data-label={t.admin.colPhotos}>{user.photos_count}</td>
                    <td data-label={t.admin.colStatus}>
                      <span className={`status-pill ${user.is_active ? 'on' : 'off'}`}>
                        {user.is_active ? t.admin.active : t.admin.inactive}
                      </span>
                    </td>
                    <td data-label={t.admin.colCreated}>{formatDate(user.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {total > PAGE_SIZE && (
            <div className="admin-pager">
              <button
                className="btn-ghost"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              >
                {t.admin.btnPrev}
              </button>
              <span>{t.admin.page} {page} {t.admin.of} {pages}</span>
              <button
                className="btn-ghost"
                disabled={offset + PAGE_SIZE >= total || loading}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                {t.admin.btnNext}
              </button>
            </div>
          )}
        </div>
      )}

      {selected != null && (
        <UserDetailModal
          userId={selected}
          formatDate={formatDate}
          onClose={() => setSelected(null)}
          onDeleted={() => {
            setSelected(null);
            setNotice(t.admin.deleted);
            load();
          }}
        />
      )}
    </div>
  );
}
