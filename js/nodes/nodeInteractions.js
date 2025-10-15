// js/nodes/nodeInteractions.js

import { state } from '../state.js';
import { addNode } from './nodeCreation.js';
import { NODE_TYPE_IMAGE } from './constants.js';

export function setupNodeInteractions() {
    state.canvasContainer.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        addNode(
            (event.pageX - state.panOffsetX) / state.scale,
            (event.pageY - state.panOffsetY) / state.scale,
        );
    });
}

export function initializeImagePasteHandling() {
    document.addEventListener('paste', handlePasteEvent);
}

function handlePasteEvent(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || !item.type?.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;

        event.preventDefault();
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target?.result;
            if (typeof dataUrl === 'string') {
                addImageNode(dataUrl);
            }
        };
        reader.readAsDataURL(file);
        break;
    }
}

function addImageNode(dataUrl) {
    const defaultWidth = 250;
    const defaultHeight = 200;
    const x = ((state.lastPointerX - state.panOffsetX) / state.scale) - defaultWidth / 2;
    const y = ((state.lastPointerY - state.panOffsetY) / state.scale) - defaultHeight / 2;

    addNode(
        Math.max(0, x),
        Math.max(0, y),
        '',
        `${defaultWidth}px`,
        `${defaultHeight}px`,
        null,
        {
            type: NODE_TYPE_IMAGE,
            imageSrc: dataUrl,
        },
    );
}
