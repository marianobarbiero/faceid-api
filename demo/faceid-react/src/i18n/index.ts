import es from './es';
import en from './en';

export type Lang = 'es' | 'en';
export type Translations = typeof es;

export const translations: Record<Lang, Translations> = { es, en };

function detectBrowserLang(): Lang {
  const lang = navigator.language.slice(0, 2).toLowerCase();
  return lang === 'es' ? 'es' : 'en';
}

export function getInitialLang(): Lang {
  const stored = localStorage.getItem('lang') as Lang | null;
  if (stored === 'es' || stored === 'en') return stored;
  return detectBrowserLang();
}
