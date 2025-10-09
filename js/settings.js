// settings.js

import { state, markDirty } from './state.js';
import { EDGE_TYPE_PLAIN, EDGE_TYPE_DASHED } from './edgeStyles.js';
import { applySettingsToAllConnections } from './connections.js';

let drawer;
let openButton;
let closeButton;
let styleSelect;
let animateToggle;

export function initializeSettingsPanel() {
    drawer = document.getElementById('settings-drawer');
    openButton = document.getElementById('settings-btn');
    closeButton = document.getElementById('settings-close-btn');
    styleSelect = document.getElementById('connection-style-select');
    animateToggle = document.getElementById('connection-animate-toggle');

    if (!drawer || !openButton || !closeButton || !styleSelect || !animateToggle) {
        console.warn('Settings UI not found. Skipping settings initialization.');
        return;
    }

    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');

    applyStateToControls();

    openButton.addEventListener('click', openDrawer);
    closeButton.addEventListener('click', closeDrawer);

    drawer.addEventListener('click', (event) => {
        if (event.target === drawer) {
            closeDrawer();
        }
    });

    drawer.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            event.preventDefault();
            closeDrawer();
        }
    });

    styleSelect.addEventListener('change', () => {
        const value = styleSelect.value === EDGE_TYPE_DASHED ? EDGE_TYPE_DASHED : EDGE_TYPE_PLAIN;
        state.connectionSettings.lineStyle = value;
        applySettingsToAllConnections();
        markDirty();
    });

    animateToggle.addEventListener('change', () => {
        state.connectionSettings.animated = animateToggle.checked;
        applySettingsToAllConnections();
        markDirty();
    });
}

export function applyStateToControls() {
    if (!styleSelect || !animateToggle) return;
    styleSelect.value = state.connectionSettings.lineStyle;
    animateToggle.checked = state.connectionSettings.animated;
}

function closeDrawer() {
    if (!drawer) return;

    if (drawer.contains(document.activeElement)) {
        openButton?.focus();
    }

    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    drawer.setAttribute('inert', '');
}

function openDrawer() {
    if (!drawer) return;

    drawer.classList.add('open');
    drawer.removeAttribute('aria-hidden');
    drawer.removeAttribute('inert');
    closeButton?.focus();
}
