import { useLang } from '../context/LangContext';

interface HomePageProps {
  onRegister: () => void;
  onIdentify: () => void;
}

export default function HomePage({ onRegister, onIdentify }: HomePageProps) {
  const { t } = useLang();

  const steps = [
    [t.home.step1Title, t.home.step1Desc],
    [t.home.step2Title, t.home.step2Desc],
    [t.home.step3Title, t.home.step3Desc],
  ];

  return (
    <div className="home-wrap">
      <div>
        <div className="home-tag">{t.home.tag}</div>
        <h1 className="home-title">
          {t.home.title1}{' '}
          <span className="accent">{t.home.title2}</span>{' '}
          {t.home.title3}
        </h1>
        <p className="home-sub">{t.home.sub}</p>
        <div className="home-actions">
          <button className="btn-primary" onClick={onRegister}>{t.home.btnRegister}</button>
          <button className="btn-secondary" onClick={onIdentify}>{t.home.btnIdentify}</button>
        </div>
        <div className="home-stats">
          <div>
            <div className="stat-label">{t.home.labelModel}</div>
            <div className="stat-num">VGG-Face</div>
          </div>
          <div>
            <div className="stat-label">{t.home.labelMetric}</div>
            <div className="stat-num">{t.home.metricValue}</div>
          </div>
          <div>
            <div className="stat-label">{t.home.labelBackend}</div>
            <div className="stat-num">DeepFace</div>
          </div>
        </div>
      </div>

      <div className="home-visual">
        <div className="panel">
          <div className="panel-title">{t.home.stepsTitle}</div>
          <ol className="steps">
            {steps.map(([title, desc], i) => (
              <li key={title} className="step">
                <span className="step-num">{i + 1}</span>
                <div>
                  <div className="step-title">{title}</div>
                  <div className="step-desc">{desc}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
