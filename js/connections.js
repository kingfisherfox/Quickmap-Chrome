// connections.js

import { state, markDirty, scheduleConnectionRefresh } from './state.js';
import { clearSelection } from './selection.js';
import { EDGE_TYPE_PLAIN, EDGE_TYPE_DASHED } from './edgeStyles.js';

const CONNECTION_LAYER_ID = 'connection-layer';
const PREVIEW_CLASS = 'connection-preview';
const CONNECTION_CLASS = 'connection-path';
const DASHED_CLASS = 'connection-dashed';
const ANIMATED_CLASS = 'connection-animated';
const REVERSE_CLASS = 'reverse-flow';
const ANCHOR_DIRECTIONS = {
    Top: { x: 0, y: -1 },
    Right: { x: 1, y: 0 },
    Bottom: { x: 0, y: 1 },
    Left: { x: -1, y: 0 },
};

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
    if (!layer.querySelector('#connection-markers')) {
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        defs.setAttribute('id', 'connection-markers');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'connection-arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('markerUnits', 'strokeWidth');
        marker.setAttribute('markerWidth', '8');
        marker.setAttribute('markerHeight', '8');
        marker.setAttribute('orient', 'auto');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        const arrowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        arrowPath.setAttribute('fill', 'var(--qm-connection-stroke, #ef4444)');
        marker.appendChild(arrowPath);
        defs.appendChild(marker);
        layer.appendChild(defs);
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
    const scale = state.scale || 1;
    return {
        x: ((rect.left + rect.width / 2) - layerRect.left) / scale,
        y: ((rect.top + rect.height / 2) - layerRect.top) / scale,
    };
}

function getLayerCoordinates(clientX, clientY) {
    const layer = ensureConnectionLayer();
    const layerRect = layer.getBoundingClientRect();
    const scale = state.scale || 1;
    return {
        x: (clientX - layerRect.left) / scale,
        y: (clientY - layerRect.top) / scale,
    };
}

function resolveDirection(anchorName, fallbackVector) {
    const direction = ANCHOR_DIRECTIONS[anchorName];
    if (direction) return direction;
    if (!fallbackVector) return { x: 0, y: 0 };
    const magnitude = Math.hypot(fallbackVector.x, fallbackVector.y) || 1;
    return {
        x: fallbackVector.x / magnitude,
        y: fallbackVector.y / magnitude,
    };
}

function computePath(start, end, connection) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);

    const fallbackVector = { x: dx || 0.001, y: dy || 0.001 };

    const sourceDir = resolveDirection(connection?.sourceAnchor, fallbackVector);
    const targetDir = resolveDirection(connection?.targetAnchor, {
        x: -fallbackVector.x,
        y: -fallbackVector.y,
    });

    const baseCurvature = Math.max(24, Math.min(120, distance * 0.3));

    const control1 = {
        x: start.x + sourceDir.x * baseCurvature,
        y: start.y + sourceDir.y * baseCurvature,
    };

    const control2 = {
        x: end.x + targetDir.x * baseCurvature,
        y: end.y + targetDir.y * baseCurvature,
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
    const path = computePath(start, end, connection);
    connection.pathElement.setAttribute('d', path);
    applyFlowDirection(connection, start, end);
}

function applyFlowDirection(connection, start, end) {
    const path = connection.pathElement;
    path.classList.remove(REVERSE_CLASS);
    path.removeAttribute('marker-start');
    path.setAttribute('marker-end', 'url(#connection-arrow)');
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dominatesHorizontal = Math.abs(dx) >= Math.abs(dy);
    if (dominatesHorizontal ? dx < 0 : dy < 0) {
        path.classList.add(REVERSE_CLASS);
        path.setAttribute('marker-start', 'url(#connection-arrow)');
        path.removeAttribute('marker-end');
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
    path.setAttribute('stroke', 'var(--qm-connection-stroke, #ef4444)');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('pointer-events', className.includes(PREVIEW_CLASS) ? 'none' : 'stroke');
    if (!className.includes(PREVIEW_CLASS)) {
        path.setAttribute('marker-end', 'url(#connection-arrow)');
    }
    layer.appendChild(path);
    return path;
}

function updateConnectionSelectionStyles() {
    state.connections.forEach((connection) => {
        if (!connection?.pathElement) return;
        if (state.selectedConnectionIds.has(connection.id)) {
            connection.pathElement.classList.add('connection-selected');
        } else {
            connection.pathElement.classList.remove('connection-selected');
        }
    });
}

export function clearConnectionSelection() {
    if (!state.selectedConnectionIds.size) return;
    state.selectedConnectionIds.clear();
    updateConnectionSelectionStyles();
}

function toggleConnectionSelection(connectionId, options = {}) {
    const { append = false } = options;
    const alreadySelected = state.selectedConnectionIds.has(connectionId);
    if (!append) {
        state.selectedConnectionIds.clear();
    }

    if (append && alreadySelected) {
        state.selectedConnectionIds.delete(connectionId);
    } else {
        state.selectedConnectionIds.add(connectionId);
    }
    updateConnectionSelectionStyles();
}

function handleConnectionPointerDown(event, connection) {
    if (event.button !== 0) return;
    event.stopPropagation();
    clearSelection();

    if (!event.shiftKey) {
        clearConnectionSelection();
        toggleConnectionSelection(connection.id, { append: true });
    } else {
        toggleConnectionSelection(connection.id, { append: true });
    }
}

function registerConnectionInteraction(connection) {
    const path = connection.pathElement;
    if (!path) return;
    path.dataset.connectionId = connection.id;
    path.addEventListener('mousedown', (event) => handleConnectionPointerDown(event, connection));
}

export function selectConnection(connectionId, options = {}) {
    if (!connectionId) return;
    const { append = false } = options;
    clearSelection();
    if (!append) {
        clearConnectionSelection();
    }
    state.selectedConnectionIds.add(connectionId);
    updateConnectionSelectionStyles();
}

export function getSelectedConnections() {
    return state.connections.filter((connection) => state.selectedConnectionIds.has(connection.id));
}

export function deleteSelectedConnections() {
    if (!state.selectedConnectionIds.size) return;
    const ids = Array.from(state.selectedConnectionIds);
    ids.forEach((connectionId) => removeConnection(connectionId));
    markDirty();
    clearConnectionSelection();
}

function startConnectionDrag(event, anchorEl) {
    event.preventDefault();
    event.stopPropagation();

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
        const endPoint = getLayerCoordinates(moveEvent.clientX, moveEvent.clientY);
        const path = computePath(anchorPoint, endPoint, {
            sourceAnchor,
            targetAnchor: null,
        });
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

    createConnectionBetweenNodes(sourceId, sourceAnchor, targetId, targetAnchor);
}

export function removeConnection(connectionId) {
    const index = state.connections.findIndex((conn) => conn.id === connectionId);
    if (index === -1) return;
    const [connection] = state.connections.splice(index, 1);
    connection.pathElement?.remove();
    state.selectedConnectionIds.delete(connectionId);
    updateConnectionSelectionStyles();
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

export function createConnectionBetweenNodes(
    sourceId,
    sourceAnchor,
    targetId,
    targetAnchor,
    options = {},
) {
    if (!sourceId || !targetId || !sourceAnchor || !targetAnchor) {
        return null;
    }

    if (sourceId === targetId && sourceAnchor === targetAnchor) {
        return null;
    }

    const existing = state.connections.find((conn) => (
        conn.sourceId === sourceId
        && conn.sourceAnchor === sourceAnchor
        && conn.targetId === targetId
        && conn.targetAnchor === targetAnchor
    ));
    if (existing) {
        return existing;
    }

    const resolvedLineStyle = options.lineStyle
        || (state.connectionSettings.animated ? EDGE_TYPE_DASHED : EDGE_TYPE_PLAIN);

    const pathElement = createPathElement(CONNECTION_CLASS);
    const connection = {
        id: `conn-${state.connectionIdCounter += 1}`,
        sourceId,
        sourceAnchor,
        targetId,
        targetAnchor,
        lineStyle: resolvedLineStyle,
        pathElement,
    };

    state.connections.push(connection);
    registerConnectionInteraction(connection);
    applyConnectionStyle(connection);
    updateConnectionPath(connection);
    updateConnectionSelectionStyles();
    markDirty();
    scheduleRefresh();
    return connection;
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
        registerConnectionInteraction(connection);
        updateConnectionPath(connection);
        const numericId = Number.parseInt(String(connection.id).replace(/[^0-9]/g, ''), 10);
        if (!Number.isNaN(numericId)) {
            state.connectionIdCounter = Math.max(state.connectionIdCounter, numericId);
        }
    });
    updateConnectionSelectionStyles();
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
    clearConnectionSelection();
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
