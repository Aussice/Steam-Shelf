import { useSyncExternalStore } from 'react';
import { subscribeLocale, getLocale } from './i18n.js';
export function useLocale() { return useSyncExternalStore(subscribeLocale, getLocale, getLocale); }
