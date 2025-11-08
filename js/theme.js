// theme.js
// Handles applying and persisting the global light/dark theme preference.

import { state } from './state.js';

const THEME_KEY = 'quickmap.theme';
const THEME_LIGHT = 'light';
const THEME_DARK = 'dark';

function normalizeTheme(theme) {
    return theme === THEME_DARK ? THEME_DARK : THEME_LIGHT;
}

function readStoredTheme() {
    try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === THEME_DARK || stored === THEME_LIGHT) {
            return stored;
        }
    } catch (error) {
        console.warn('Unable to read stored theme preference.', error);
    }
    return null;
}

function detectSystemPreference() {
    try {
        const media = window.matchMedia
            ? window.matchMedia('(prefers-color-scheme: dark)')
            : null;
        return media?.matches ? THEME_DARK : THEME_LIGHT;
    } catch (error) {
        return THEME_LIGHT;
    }
}

export function applyTheme(theme) {
    const normalized = normalizeTheme(theme);
    const body = document.body;
    if (!body) return;

    const root = document.documentElement;
    root?.setAttribute('data-theme', normalized);
    root?.style?.setProperty('color-scheme', normalized);
    body.setAttribute('data-theme', normalized);
    body.classList.toggle('theme-dark', normalized === THEME_DARK);
}

export function setTheme(theme, options = {}) {
    const normalized = normalizeTheme(theme);
    state.theme = normalized;
    applyTheme(normalized);
    document.dispatchEvent(
        new CustomEvent('quickmap:themechange', { detail: { theme: normalized } }),
    );

    if (options.persist === false) {
        return normalized;
    }

    try {
        localStorage.setItem(THEME_KEY, normalized);
    } catch (error) {
        console.warn('Unable to persist theme preference.', error);
    }
    return normalized;
}

export function initializeTheme() {
    const stored = readStoredTheme();
    const theme = normalizeTheme(stored || detectSystemPreference());
    return setTheme(theme, { persist: stored != null });
}

export function getTheme() {
    return state.theme;
}

export function isDarkTheme() {
    return state.theme === THEME_DARK;
}
