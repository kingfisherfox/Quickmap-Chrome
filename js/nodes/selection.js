// js/nodes/selection.js

import { state } from '../state.js';

export function clearActiveNodes() {
    state.nodes.forEach((current) => {
        if (!current) return;
        current.classList.remove('node-active');
        current.classList.remove('node-toolbar-active');
    });
}

export function setActiveNode(target) {
    if (!target) {
        clearActiveNodes();
        return;
    }
    state.nodes.forEach((current) => {
        if (!current) return;
        if (current === target) {
            current.classList.add('node-active');
        } else {
            current.classList.remove('node-active');
        }
    });
}
