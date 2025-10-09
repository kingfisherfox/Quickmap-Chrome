// canvas.js

import { state, markDirty } from './state.js';

export function setupCanvasInteractions() {
    document.addEventListener('keydown', (event) => {
        if (event.code !== 'Space') return;
        state.isSpaceDown = true;
        document.body.style.cursor = 'grab';
    });

    document.addEventListener('keyup', (event) => {
        if (event.code !== 'Space') return;
        state.isSpaceDown = false;
        document.body.style.cursor = 'default';
    });

    state.canvasContainer.addEventListener('mousedown', (event) => {
        if (!state.isSpaceDown) return;
        state.isPanning = true;
        state.panStartX = event.pageX;
        state.panStartY = event.pageY;
        document.body.style.cursor = 'grabbing';
        event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
        if (!state.isPanning) return;

        state.panOffsetX += event.pageX - state.panStartX;
        state.panOffsetY += event.pageY - state.panStartY;
        state.panStartX = event.pageX;
        state.panStartY = event.pageY;

        updateCanvasTransform();
        state.jsPlumbInstance?.repaintEverything();
    });

    document.addEventListener('mouseup', () => {
        if (!state.isPanning) return;
        state.isPanning = false;
        document.body.style.cursor = 'default';
    });

    state.canvasContainer.addEventListener('wheel', (event) => {
        event.preventDefault();
        const zoomFactor = 0.1;
        const previousScale = state.scale;

        if (event.deltaY < 0) {
            state.scale += zoomFactor;
        } else {
            state.scale = Math.max(0.1, state.scale - zoomFactor);
        }

        const rect = state.canvasContainer.getBoundingClientRect();
        const dx = (event.pageX - rect.left - state.panOffsetX) / previousScale;
        const dy = (event.pageY - rect.top - state.panOffsetY) / previousScale;

        state.panOffsetX -= dx * (state.scale - previousScale);
        state.panOffsetY -= dy * (state.scale - previousScale);

        updateCanvasTransform();
        state.jsPlumbInstance?.repaintEverything();
    });
}

export function updateCanvasTransform() {
    if (state.canvasTransform) {
        state.canvasTransform.style.transform = `translate(${state.panOffsetX}px, ${state.panOffsetY}px) scale(${state.scale})`;
        state.canvasTransform.style.transformOrigin = '0 0';
    }

    if (state.canvasContainer) {
        state.canvasContainer.style.backgroundSize = `${20 * state.scale}px ${20 * state.scale}px`;
    }
}

export function clearCanvas({ markDirty: shouldMarkDirty = true } = {}) {
    state.jsPlumbInstance?.deleteEveryEndpoint();

    const parent = state.canvasTransform || state.canvasContainer;
    state.nodes.forEach((node) => {
        if (parent?.contains(node)) {
            parent.removeChild(node);
        }
    });
    state.nodes = [];
    state.nodeIdCounter = 0;

    state.jsPlumbInstance?.repaintEverything();
    if (shouldMarkDirty) {
        markDirty();
    }
}
