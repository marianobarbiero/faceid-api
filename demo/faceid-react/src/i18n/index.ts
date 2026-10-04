import es from './es';
import en from './en';

export type Lang = 'es' | 'en';
// Widen the `as const` string literals to `string` so other languages share the shape of es.ts
type WidenLiterals<T> = T extends string
  ? string
  : { readonly [K in keyof T]: WidenLiterals<T[K]> };

export type Translations = WidenLiterals<typeof es>;

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
