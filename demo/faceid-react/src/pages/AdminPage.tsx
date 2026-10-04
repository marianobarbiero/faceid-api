import { useCallback, useEffect, useState } from 'react';
import {
  errorMessage,
  fetchUserImageUrl,
  getAdminKey,
  isUnauthorized,
  listUsers,
  setAdminKey,
  type UserListResponse,
} from '../api/admin';
import { useLang } from '../context/LangContext';

const PAGE_SIZE = 25;

function UserThumb({ id, alt }: { id: number; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let cancelled = false;
    fetchUserImageUrl(id)
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
  }, [id]);

  if (src) return <img className="user-thumb" src={src} alt={alt} loading="lazy" />;
  return <div className="user-thumb placeholder">{failed ? '✕' : ''}</div>;
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
    setLoading(true);
    setError(null);
    try {
      setData(await listUsers({ q: query, limit: PAGE_SIZE, offset }));
    } catch (err: unknown) {
      if (isUnauthorized(err)) logout();
      else setError(errorMessage(err));
    } finally {
      setLoading(false);
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
                  <th>{t.admin.colStatus}</th>
                  <th>{t.admin.colCreated}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td><UserThumb id={user.id} alt={user.full_name} /></td>
                    <td data-label={t.admin.colName}>
                      <strong>{user.full_name}</strong>
                      <span className="user-id">#{user.id}</span>
                    </td>
                    <td data-label={t.admin.colEmail}>{user.email ?? '—'}</td>
                    <td data-label={t.admin.colExternalId}>{user.external_id ?? '—'}</td>
                    <td data-label={t.admin.colModel}>{user.model_name} · {user.detector_backend}</td>
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
    </div>
  );
}
