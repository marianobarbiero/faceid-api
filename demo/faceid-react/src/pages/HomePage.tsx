import { useLang } from '../context/LangContext';

interface HomePageProps {
  onRegister: () => void;
  onIdentify: () => void;
}

export default function HomePage({ onRegister, onIdentify }: HomePageProps) {
  const { t } = useLang();

  return (
    <div className="home-wrap">
      <div>
        <div className="home-tag">{t.home.tag}</div>
        <h1 className="home-title">
          {t.home.title1}<br />
          <span className="accent">{t.home.title2}</span><br />
          {t.home.title3}
        </h1>
        <p className="home-sub">{t.home.sub}</p>
        <div className="home-actions">
          <button className="btn-primary" onClick={onRegister}>{t.home.btnRegister}</button>
          <button className="btn-secondary" onClick={onIdentify}>{t.home.btnIdentify}</button>
        </div>
        <div className="home-stats">
          <div>
            <div className="stat-num">VGG</div>
            <div className="stat-label">{t.home.labelModel}</div>
          </div>
          <div>
            <div className="stat-num">cos</div>
            <div className="stat-label">{t.home.labelMetric}</div>
          </div>
          <div>
            <div className="stat-num">API</div>
            <div className="stat-label">{t.home.labelBackend}</div>
          </div>
        </div>
      </div>

      <div className="home-visual">
        <div className="face-diagram">
          <div className="scan-line" />
          <div className="cd tl" /><div className="cd tr" />
          <div className="cd bl" /><div className="cd br" />
          <div className="flbl tl">MESH</div>
          <div className="flbl tr">LIVE</div>
          <div className="flbl bl">DEEPFACE</div>
          <div className="flbl br">API</div>
          <svg className="face-svg" width="150" height="190" viewBox="0 0 150 190" fill="none">
            <ellipse cx="75" cy="95" rx="60" ry="76" stroke="#00e5c0" strokeWidth="1.2"/>
            <ellipse cx="48" cy="78" rx="13" ry="8" stroke="#00e5c0" strokeWidth="1"/>
            <ellipse cx="102" cy="78" rx="13" ry="8" stroke="#00e5c0" strokeWidth="1"/>
            <circle cx="48" cy="78" r="4" fill="#00e5c0" opacity=".4"/>
            <circle cx="102" cy="78" r="4" fill="#00e5c0" opacity=".4"/>
            <path d="M75 87 L67 110 Q75 116 83 110 Z" stroke="#00e5c0" strokeWidth="1" fill="none"/>
            <path d="M56 130 Q75 144 94 130" stroke="#00e5c0" strokeWidth="1.2" fill="none"/>
            <path d="M35 64 Q48 58 61 62" stroke="#00e5c0" strokeWidth="1" fill="none"/>
            <path d="M89 62 Q102 58 115 64" stroke="#00e5c0" strokeWidth="1" fill="none"/>
          </svg>
          <div className="pdot" style={{ top: '27%', left: '21%' }} />
          <div className="pdot" style={{ top: '45%', left: '73%', animationDelay: '.5s' }} />
          <div className="pdot" style={{ top: '63%', left: '47%', animationDelay: '1s' }} />
        </div>
      </div>
    </div>
  );
}
