// connections.js

import { state, markDirty, scheduleConnectionRefresh } from './state.js';
import { EDGE_TYPE_PLAIN, EDGE_TYPE_DASHED } from './edgeStyles.js';

const CONNECTION_LAYER_ID = 'connection-layer';
const PREVIEW_CLASS = 'connection-preview';
const CONNECTION_CLASS = 'connection-path';
const DASHED_CLASS = 'connection-dashed';
const ANIMATED_CLASS = 'connection-animated';
const REVERSE_CLASS = 'reverse-flow';

function ensureConnectionLayer() {
    if (state.connectionLayer) return state.connectionLayer;
    let layer = document.getElementById(CONNECTION_LAYER_ID);
    if (!layer) {
        layer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        layer.setAttribute('id', CONNECTION_LAYER_ID);
        layer.setAttribute('class', 'connection-layer');
        layer.setAttribute('width', '2000');
        layer.setAttribute('height', '2000');
        layer.setAttribute('viewBox', '0 0 2000 2000');
        layer.style.position = 'absolute';
        layer.style.top = '0';
        layer.style.left = '0';
        const parent = state.canvasContent || state.canvasTransform || document.body;
        parent.appendChild(layer);
    }
    state.connectionLayer = layer;
    return layer;
}

function updateLayerDimensions(width, height) {
    const layer = ensureConnectionLayer();
    layer.setAttribute('width', `${width}`);
    layer.setAttribute('height', `${height}`);
    layer.setAttribute('viewBox', `0 0 ${width} ${height}`);
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
}

function getAnchorPoint(anchorEl) {
    const layer = ensureConnectionLayer();
    const layerRect = layer.getBoundingClientRect();
    const rect = anchorEl.getBoundingClientRect();
    return {
        x: (rect.left + rect.width / 2) - layerRect.left,
        y: (rect.top + rect.height / 2) - layerRect.top,
    };
}

function computePath(start, end) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const curvature = Math.min(160, Math.abs(dx) * 0.5 + Math.abs(dy) * 0.5);
    const control1 = {
        x: start.x + curvature,
        y: start.y,
    };
    const control2 = {
        x: end.x - curvature,
        y: end.y,
    };
    return `M ${start.x} ${start.y} C ${control1.x} ${control1.y} ${control2.x} ${control2.y} ${end.x} ${end.y}`;
}

function updateConnectionPath(connection) {
    const sourceAnchor = document.querySelector(`[data-node-id="${connection.sourceId}"][data-anchor="${connection.sourceAnchor}"]`);
    const targetAnchor = document.querySelector(`[data-node-id="${connection.targetId}"][data-anchor="${connection.targetAnchor}"]`);
    if (!sourceAnchor || !targetAnchor) {
        removeConnection(connection.id);
        return;
    }
    const start = getAnchorPoint(sourceAnchor);
    const end = getAnchorPoint(targetAnchor);
    const path = computePath(start, end);
    connection.pathElement.setAttribute('d', path);
    applyFlowDirection(connection, start, end);
}

function applyFlowDirection(connection, start, end) {
    const path = connection.pathElement;
    path.classList.remove(REVERSE_CLASS);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dominatesHorizontal = Math.abs(dx) >= Math.abs(dy);
    if (dominatesHorizontal ? dx < 0 : dy < 0) {
        path.classList.add(REVERSE_CLASS);
    }
}

function applyConnectionStyle(connection) {
    const path = connection.pathElement;
    path.classList.remove(DASHED_CLASS, ANIMATED_CLASS);
    if (connection.lineStyle === EDGE_TYPE_DASHED) {
        path.classList.add(DASHED_CLASS);
    }
    if (state.connectionSettings.animated) {
        path.classList.add(ANIMATED_CLASS);
    }
}

function scheduleRefresh() {
    scheduleConnectionRefresh(refreshConnections);
}

function refreshConnections() {
    for (let i = state.connections.length - 1; i >= 0; i -= 1) {
        const connection = state.connections[i];
        if (!connection) continue;
        updateConnectionPath(connection);
    }
}

function clearPreview() {
    if (state.connectionPreview) {
        state.connectionPreview.remove();
        state.connectionPreview = null;
    }
}

function createPathElement(className) {
    const layer = ensureConnectionLayer();
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', className);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#007BFF');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('pointer-events', 'stroke');
    layer.appendChild(path);
    return path;
}

function startConnectionDrag(event, anchorEl) {
    event.preventDefault();
    event.stopPropagation();

    const layer = ensureConnectionLayer();
    const sourceNodeId = anchorEl.dataset.nodeId;
    const sourceAnchor = anchorEl.dataset.anchor;
    if (!sourceNodeId || !sourceAnchor) return;

    const previewPath = createPathElement(`${CONNECTION_CLASS} ${PREVIEW_CLASS}`);
    previewPath.setAttribute('stroke-dasharray', '6 4');

    state.connectionDrag = {
        sourceAnchorEl: anchorEl,
        sourceNodeId,
        sourceAnchor,
        previewPath,
    };
    state.connectionPreview = previewPath;

    const onMove = (moveEvent) => {
        const anchorPoint = getAnchorPoint(anchorEl);
        const svgRect = layer.getBoundingClientRect();
        const endPoint = {
            x: moveEvent.clientX - svgRect.left,
            y: moveEvent.clientY - svgRect.top,
        };
        const path = computePath(anchorPoint, endPoint);
        previewPath.setAttribute('d', path);

        const potential = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        updateHoverAnchor(potential);
    };

    const onUp = (upEvent) => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);

        const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        commitConnection(anchorEl, targetElement);
        clearPreview();
        state.connectionDrag = null;
        updateHoverAnchor(null);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function updateHoverAnchor(element) {
    if (state.connectionHoverAnchor === element) return;
    if (state.connectionHoverAnchor) {
        state.connectionHoverAnchor.classList.remove('connection-hover');
    }
    state.connectionHoverAnchor = null;

    if (!element) return;
    const anchor = element.closest?.('.connection-point');
    if (anchor && anchor.dataset.nodeId && anchor.dataset.anchor) {
        if (state.connectionDrag && anchor.dataset.nodeId === state.connectionDrag.sourceNodeId && anchor.dataset.anchor === state.connectionDrag.sourceAnchor) {
            return;
        }
        anchor.classList.add('connection-hover');
        state.connectionHoverAnchor = anchor;
    }
}

function commitConnection(sourceAnchorEl, targetElement) {
    const anchor = targetElement?.closest?.('.connection-point');
    if (!anchor || !anchor.dataset.nodeId || !anchor.dataset.anchor) {
        return;
    }

    const sourceId = sourceAnchorEl.dataset.nodeId;
    const sourceAnchor = sourceAnchorEl.dataset.anchor;
    const targetId = anchor.dataset.nodeId;
    const targetAnchor = anchor.dataset.anchor;

    if (sourceId === targetId && sourceAnchor === targetAnchor) {
        return;
    }

    const existing = state.connections.find((conn) => (
        conn.sourceId === sourceId
        && conn.sourceAnchor === sourceAnchor
        && conn.targetId === targetId
        && conn.targetAnchor === targetAnchor
    ));
    if (existing) {
        return;
    }

    const lineStyle = state.connectionSettings.animated ? EDGE_TYPE_DASHED : EDGE_TYPE_PLAIN;
    const pathElement = createPathElement(CONNECTION_CLASS);
    const connection = {
        id: `conn-${state.connectionIdCounter += 1}`,
        sourceId,
        sourceAnchor,
        targetId,
        targetAnchor,
        lineStyle,
        pathElement,
    };

    pathElement.addEventListener('click', (event) => {
        event.stopPropagation();
        removeConnection(connection.id);
        markDirty();
    });

    state.connections.push(connection);
    applyConnectionStyle(connection);
    updateConnectionPath(connection);
    markDirty();
    scheduleRefresh();
}

export function removeConnection(connectionId) {
    const index = state.connections.findIndex((conn) => conn.id === connectionId);
    if (index === -1) return;
    const [connection] = state.connections.splice(index, 1);
    connection.pathElement?.remove();
    scheduleRefresh();
}

export function removeConnectionsForNode(nodeId) {
    const ids = state.connections
        .filter((conn) => conn.sourceId === nodeId || conn.targetId === nodeId)
        .map((conn) => conn.id);
    ids.forEach(removeConnection);
}

export function registerAnchor(node, anchorEl, anchorName) {
    anchorEl.dataset.nodeId = node.id;
    anchorEl.dataset.anchor = anchorName;
    anchorEl.addEventListener('mousedown', (event) => startConnectionDrag(event, anchorEl));
}

export function serializeConnections() {
    return state.connections.map((conn) => ({
        id: conn.id,
        sourceId: conn.sourceId,
        sourceAnchor: conn.sourceAnchor,
        targetId: conn.targetId,
        targetAnchor: conn.targetAnchor,
        lineStyle: conn.lineStyle,
    }));
}

export function loadConnections(savedConnections = []) {
    clearConnections();
    savedConnections.forEach((data) => {
        const sourceAnchorName = data.sourceAnchor || data.anchors?.[0] || 'Top';
        const targetAnchorName = data.targetAnchor || data.anchors?.[1] || 'Top';
        const sourceAnchor = document.querySelector(`[data-node-id="${data.sourceId}"][data-anchor="${sourceAnchorName}"]`);
        const targetAnchor = document.querySelector(`[data-node-id="${data.targetId}"][data-anchor="${targetAnchorName}"]`);
        if (!sourceAnchor || !targetAnchor) return;
        const pathElement = createPathElement(CONNECTION_CLASS);
        const connection = {
            id: data.id || `conn-${state.connectionIdCounter += 1}`,
            sourceId: data.sourceId,
            sourceAnchor: sourceAnchorName,
            targetId: data.targetId,
            targetAnchor: targetAnchorName,
            lineStyle: data.lineStyle || EDGE_TYPE_PLAIN,
            pathElement,
        };
        applyConnectionStyle(connection);
        state.connections.push(connection);
        updateConnectionPath(connection);
        const numericId = Number.parseInt(String(connection.id).replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(numericId)) {
            state.connectionIdCounter = Math.max(state.connectionIdCounter, numericId);
        }
    });
    scheduleRefresh();
}

export function applySettingsToAllConnections() {
    state.connections.forEach((connection) => {
        connection.lineStyle = state.connectionSettings.animated ? EDGE_TYPE_DASHED : EDGE_TYPE_PLAIN;
        applyConnectionStyle(connection);
    });
    scheduleRefresh();
}

export function clearConnections() {
    state.connections.forEach((connection) => connection.pathElement?.remove());
    state.connections = [];
    state.connectionIdCounter = 0;
    clearPreview();
    state.connectionDrag = null;
    if (state.connectionHoverAnchor) {
        state.connectionHoverAnchor.classList.remove('connection-hover');
        state.connectionHoverAnchor = null;
    }
    const layer = ensureConnectionLayer();
    layer.querySelectorAll('path').forEach((path) => path.remove());
    scheduleRefresh();
}

export function initializeConnectionLayer() {
    ensureConnectionLayer();
    scheduleRefresh();
}

export function queueConnectionRefresh() {
    scheduleRefresh();
}

export function handleNodeLayoutChange() {
    scheduleRefresh();
}

export function updateConnectionLayerSize(width, height) {
    updateLayerDimensions(width, height);
    scheduleRefresh();
}
