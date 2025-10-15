// js/nodes/canvasBounds.js

import { state } from '../state.js';
import { updateConnectionLayerSize, queueConnectionRefresh } from '../connections.js';

export function updateCanvasBounds() {
    const content = state.canvasContent || state.canvasContainer;
    if (!content) return;

    const transform = state.canvasTransform || state.canvasContainer;
    const minSize = 2000;
    const padding = 800;

    let maxRight = 0;
    let maxBottom = 0;

    state.nodes.forEach((node) => {
        if (!node || !content.contains(node)) return;
        const left = Number.parseFloat(node.style.left) || node.offsetLeft || 0;
        const top = Number.parseFloat(node.style.top) || node.offsetTop || 0;
        const width = node.offsetWidth || Number.parseFloat(node.style.width) || 0;
        const height = node.offsetHeight || Number.parseFloat(node.style.height) || 0;
        maxRight = Math.max(maxRight, left + width);
        maxBottom = Math.max(maxBottom, top + height);
    });

    const targetWidth = Math.max(minSize, Math.ceil(maxRight + padding));
    const targetHeight = Math.max(minSize, Math.ceil(maxBottom + padding));

    content.style.width = `${targetWidth}px`;
    content.style.height = `${targetHeight}px`;

    if (transform && transform !== content) {
        transform.style.width = `${targetWidth}px`;
        transform.style.height = `${targetHeight}px`;
    }
    updateConnectionLayerSize(targetWidth, targetHeight);
    queueConnectionRefresh();
}
