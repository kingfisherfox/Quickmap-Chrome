// selection.js

import { state } from './state.js';

let selectionElement = null;

function ensureSelectionElement() {
    if (selectionElement) return selectionElement;
    if (!state.canvasContent) return null;

    selectionElement = document.createElement('div');
    selectionElement.id = 'selection-rectangle';
    selectionElement.className = 'selection-rectangle hidden';
    selectionElement.setAttribute('aria-hidden', 'true');
    state.canvasContent.appendChild(selectionElement);
    return selectionElement;
}

function getNodeBounds(node) {
    const left = Number.parseFloat(node.style.left) || node.offsetLeft || 0;
    const top = Number.parseFloat(node.style.top) || node.offsetTop || 0;
    const width = node.offsetWidth || 0;
    const height = node.offsetHeight || 0;
    return {
        left,
        top,
        right: left + width,
        bottom: top + height,
    };
}

function rectsIntersect(rect, nodeRect) {
    return !(
        nodeRect.left > rect.x + rect.width
        || nodeRect.right < rect.x
        || nodeRect.top > rect.y + rect.height
        || nodeRect.bottom < rect.y
    );
}

function updateNodeSelectionClasses() {
    state.nodes.forEach((node) => {
        if (!node) return;
        if (state.selectedNodes.has(node)) {
            node.classList.add('selected');
        } else {
            node.classList.remove('selected');
        }
    });
}

export function initializeSelectionOverlay() {
    ensureSelectionElement();
}

export function clearSelection() {
    state.selectedNodes.clear();
    updateNodeSelectionClasses();
}

export function setSelectedNodes(nodes = []) {
    state.selectedNodes.clear();
    nodes.forEach((node) => {
        if (node) {
            state.selectedNodes.add(node);
        }
    });
    updateNodeSelectionClasses();
}

export function removeNodeFromSelection(node) {
    if (!node) return;
    if (state.selectedNodes.delete(node)) {
        node.classList.remove('selected');
    }
}

export function getSelectedNodes() {
    return Array.from(state.selectedNodes);
}

export function isNodeSelected(node) {
    return state.selectedNodes.has(node);
}

export function beginSelection(x, y) {
    const element = ensureSelectionElement();
    state.isSelecting = true;
    state.selectionStartX = x;
    state.selectionStartY = y;
    state.selectionRect = { x, y, width: 0, height: 0 };
    if (element) {
        element.classList.remove('hidden');
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        element.style.width = '0px';
        element.style.height = '0px';
    }
}

export function updateSelection(x, y) {
    if (!state.isSelecting || !state.selectionRect) return;
    const element = ensureSelectionElement();
    const left = Math.min(x, state.selectionStartX);
    const top = Math.min(y, state.selectionStartY);
    const width = Math.abs(x - state.selectionStartX);
    const height = Math.abs(y - state.selectionStartY);
    state.selectionRect = { x: left, y: top, width, height };

    if (element) {
        element.style.left = `${left}px`;
        element.style.top = `${top}px`;
        element.style.width = `${width}px`;
        element.style.height = `${height}px`;
    }
}

export function finalizeSelection() {
    if (!state.isSelecting) return;
    const element = ensureSelectionElement();
    state.isSelecting = false;

    if (element) {
        element.classList.add('hidden');
        element.style.width = '0px';
        element.style.height = '0px';
    }

    const rect = state.selectionRect;
    state.selectionRect = null;

    if (!rect) return;

    const isClick =
        rect.width < 3
        && rect.height < 3;

    if (isClick) {
        clearSelection();
        state.__clearConnectionSelection?.();
        return;
    }

    const selected = state.nodes.filter((node) => {
        if (!node) return false;
        const bounds = getNodeBounds(node);
        return rectsIntersect(rect, bounds);
    });

    setSelectedNodes(selected);
    state.__clearConnectionSelection?.();
    state.__selectConnectionsInRect?.(rect, { append: false });
}
