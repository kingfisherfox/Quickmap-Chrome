// settings.js

import { state, markDirty } from './state.js';
import { applySettingsToAllConnections } from './connections.js';

let drawer;
let openButton;
let closeButton;
let animateToggle;

export function initializeSettingsPanel() {
    drawer = document.getElementById('settings-drawer');
    openButton = document.getElementById('settings-btn');
    closeButton = document.getElementById('settings-close-btn');
    animateToggle = document.getElementById('connection-animate-toggle');

    if (!drawer || !openButton || !closeButton || !animateToggle) {
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
        applySettingsToAllConnections();
        markDirty();
    });
}

export function applyStateToControls() {
    if (!animateToggle) return;
    animateToggle.checked = state.connectionSettings.animated;
}

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
