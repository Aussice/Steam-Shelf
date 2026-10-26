import { EN } from './translations.js';

export const LANGUAGE_KEY = 'steam-shelf-language';
export function normalizeLocale(value) { return value === 'en' || /^en[-_]/i.test(value || '') ? 'en' : 'zh'; }
export function readLocale(storage, browserLanguage = globalThis.navigator?.language) {
  try { const saved = (storage ?? globalThis.localStorage)?.getItem(LANGUAGE_KEY); if (saved === 'zh' || saved === 'en') return saved; } catch {}
  return normalizeLocale(browserLanguage);
}
let locale = readLocale();
const listeners = new Set();
export const getLocale = () => locale;
export function setLocale(value) {
  const next = normalizeLocale(value);
  if (next === locale) return;
  locale = next;
  try { globalThis.localStorage?.setItem(LANGUAGE_KEY, next); } catch {}
  applyDocumentLanguage();
  listeners.forEach(listener => listener());
}
export function subscribeLocale(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function applyDocumentLanguage() { if (globalThis.document) document.documentElement.lang = locale === 'en' ? 'en' : 'zh-CN'; }
applyDocumentLanguage();

const patterns = new Map();
const templates = Object.entries(EN).filter(([source]) => source.includes('{0}')).sort((a,b) => b[0].replace(/\{\d+\}/g,'').length - a[0].replace(/\{\d+\}/g,'').length);
export function t(value, ...args) {
  if (typeof value !== 'string') return value;
  let result = value;
  if (locale === 'en') {
    result = EN[value] ?? value;
    if (result === value && /\p{Script=Han}/u.test(value)) {
      for (const [source, translated] of templates) {
        let pattern = patterns.get(source);
        if (!pattern) {
          const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{\d+\\\}/g, '(.+?)');
          pattern = new RegExp(`^${escaped}$`); patterns.set(source, pattern);
        }
        const match = value.match(pattern);
        if (match) { result = translated.replace(/\{(\d+)\}/g, (_, index) => t(match[Number(index) + 1] ?? '')); break; }
      }
    }
  }
  return result.replace(/\{(\d+)\}/g, (match, index) => args[index] === undefined ? match : String(args[index]));
}
export const dateLocale = () => locale === 'en' ? 'en-US' : 'zh-CN';
export const gameTitle = game => locale === 'en' ? game.name : game.subtitle || game.name;
export function errorText(value) {
  const message = String(value || '').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
  const translated = t(message);
  return locale === 'en' && /\p{Script=Han}/u.test(translated) ? 'Something went wrong. Please try again.' : translated;
}
