import { useEffect, useState } from 'react';
import RegisterPage from './pages/RegisterPage';
import IdentifyPage from './pages/IdentifyPage';
import HomePage from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import AnalyzePage from './pages/AnalyzePage';
import Icon from './components/Icon';
import { useLang } from './context/LangContext';

type Page = 'home' | 'register' | 'identify' | 'analyze' | 'admin';

// The backoffice is not linked from the menu; it is reached directly at /back
const ADMIN_PATH = '/back';

function pageFromLocation(): Page {
  return window.location.pathname.replace(/\/+$/, '') === ADMIN_PATH ? 'admin' : 'home';
}

export default function App() {
  const [page, setPageState] = useState<Page>(pageFromLocation);

  const setPage = (next: Page) => {
    const path = next === 'admin' ? ADMIN_PATH : '/';
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setPageState(next);
  };

  useEffect(() => {
    const onPopState = () => setPageState(pageFromLocation());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const { t, lang, setLang } = useLang();

  return (
    <>
      <header>
        <button className="logo" onClick={() => setPage('home')}>
          <span className="logo-mark"><Icon name="scanFace" size={18} /></span> FaceVault
        </button>
        <nav className="desk-nav">
          <button className={`nav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>{t.nav.home}</button>
          <button className={`nav-btn ${page === 'register' ? 'active' : ''}`} onClick={() => setPage('register')}>{t.nav.register}</button>
          <button className={`nav-btn ${page === 'identify' ? 'active' : ''}`} onClick={() => setPage('identify')}>{t.nav.identify}</button>
          <button className={`nav-btn ${page === 'analyze' ? 'active' : ''}`} onClick={() => setPage('analyze')}>{t.nav.analyze}</button>
          <div className="nav-sep" />
          <button className={`nav-btn ${lang === 'es' ? 'active' : ''}`} onClick={() => setLang('es')}>ES</button>
          <button className={`nav-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => setLang('en')}>EN</button>
        </nav>
      </header>

      <main>
        {page === 'home' && <HomePage onRegister={() => setPage('register')} onIdentify={() => setPage('identify')} />}
        {page === 'register' && <RegisterPage onIdentify={() => setPage('identify')} />}
        {page === 'identify' && <IdentifyPage />}
        {page === 'analyze' && <AnalyzePage />}
        {page === 'admin' && <AdminPage />}
      </main>

      <nav className="bottom-nav">
        <button className={`bnav-btn ${page === 'home' ? 'active' : ''}`} onClick={() => setPage('home')}>
          <span className="ico"><Icon name="home" /></span>{t.nav.home}
        </button>
        <button className={`bnav-btn ${page === 'register' ? 'active' : ''}`} onClick={() => setPage('register')}>
          <span className="ico"><Icon name="userPlus" /></span>{t.nav.register}
        </button>
        <button className={`bnav-btn ${page === 'identify' ? 'active' : ''}`} onClick={() => setPage('identify')}>
          <span className="ico"><Icon name="scanFace" /></span>{t.nav.identify}
        </button>
        <button className={`bnav-btn ${page === 'analyze' ? 'active' : ''}`} onClick={() => setPage('analyze')}>
          <span className="ico"><Icon name="chart" /></span>{t.nav.analyze}
        </button>
        <button className="bnav-btn" onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>
          <span className="ico"><Icon name="globe" /></span>{lang.toUpperCase()}
        </button>
      </nav>
    </>
  );
}
