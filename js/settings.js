// settings.js

import { state, markDirty } from './state.js';
import { applySettingsToAllConnections } from './connections.js';
import { setTheme } from './theme.js';

let drawer;
let openButton;
let closeButton;
let animateToggle;
let darkModeToggle;

function syncDarkModeToggle(theme = state.theme) {
    if (!darkModeToggle) return;
    const isDark = theme === 'dark';
    darkModeToggle.checked = isDark;
    darkModeToggle.setAttribute('aria-checked', String(isDark));
}

export function initializeSettingsPanel() {
    drawer = document.getElementById('settings-drawer');
    openButton = document.getElementById('settings-btn');
    closeButton = document.getElementById('settings-close-btn');
    animateToggle = document.getElementById('connection-animate-toggle');
    darkModeToggle = document.getElementById('dark-mode-toggle');

    if (!drawer || !openButton || !closeButton || !animateToggle || !darkModeToggle) {
        console.warn('Settings UI not found. Skipping settings initialization.');
        return;
    }

    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');

    applyStateToControls();

    openButton.addEventListener('click', () => {
        openDrawer();
        closeButton?.focus();
    });

    closeButton.addEventListener('click', () => {
        closeDrawer();
        openButton?.focus();
    });

    animateToggle.addEventListener('change', () => {
        state.connectionSettings.animated = animateToggle.checked;
        animateToggle.setAttribute('aria-checked', String(animateToggle.checked));
        applySettingsToAllConnections();
        markDirty();
    });

    darkModeToggle.addEventListener('change', () => {
        const isDark = darkModeToggle.checked;
        syncDarkModeToggle(isDark ? 'dark' : 'light');
        setTheme(isDark ? 'dark' : 'light');
    });
}

export function applyStateToControls() {
    if (animateToggle) {
        const isAnimated = !!state.connectionSettings.animated;
        animateToggle.checked = isAnimated;
        animateToggle.setAttribute('aria-checked', String(isAnimated));
    }
    syncDarkModeToggle();
}

document.addEventListener('quickmap:themechange', (event) => {
    const theme = event.detail?.theme;
    syncDarkModeToggle(theme);
});

function closeDrawer() {
    if (!drawer) return;

    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
}

function openDrawer() {
    if (!drawer) return;

    drawer.classList.add('open');
    drawer.removeAttribute('aria-hidden');
    drawer.removeAttribute('inert');
}
