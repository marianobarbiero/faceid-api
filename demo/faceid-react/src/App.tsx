import { useState } from 'react';
import RegisterPage from './pages/RegisterPage';
import IdentifyPage from './pages/IdentifyPage';
import HomePage from './pages/HomePage';
import { useLang } from './context/LangContext';

type Page = 'home' | 'register' | 'identify';

export default function App() {
  const [page, setPage] = useState<Page>('home');
  const { t, lang, setLang } = useLang();

  return (
    <>
      <header>
        <button className="logo" onClick={() => setPage('home')}>
          <span style={{ filter: 'drop-shadow(0 0 5px var(--teal))' }}>⬡</span> FACEVAULT
        </button>
        <nav className="desk-nav">
          <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>{t.nav.home}</button>
          <button className={`nav-btn ${page === 'register' ? 'active' : ''}`} onClick={() => setPage('register')}>{t.nav.register}</button>
          <button className={`nav-btn ${page === 'identify' ? 'active' : ''}`} onClick={() => setPage('identify')}>{t.nav.identify}</button>
          <div style={{ width: 1, background: 'var(--border)', margin: '8px 4px' }} />
          <button className={`nav-btn ${lang === 'es' ? 'active' : ''}`} onClick={() => setLang('es')}>ES</button>
          <button className={`nav-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </nav>
      </header>

      <main>
        {page === 'home' && <HomePage onRegister={() => setPage('register')} onIdentify={() => setPage('identify')} />}
        {page === 'register' && <RegisterPage onIdentify={() => setPage('identify')} />}
        {page === 'identify' && <IdentifyPage />}
      </main>

      <nav className="bottom-nav">
        <button className={`bnav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
          <span className="ico">⌂</span>{t.nav.home}
        </button>
        <button className={`bnav-btn ${page === 'register' ? 'active' : ''}`} onClick={() => setPage('register')}>
          <span className="ico">＋</span>{t.nav.register}
        </button>
        <button className={`bnav-btn ${page === 'identify' ? 'active' : ''}`} onClick={() => setPage('identify')}>
          <span className="ico">◎</span>{t.nav.identify}
        </button>
        <button className={`bnav-btn ${lang === 'es' ? 'active' : ''}`} onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
          <span className="ico">🌐</span>{lang.toUpperCase()}
        </button>
      </nav>
    </>
  );
}
