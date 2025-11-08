// clipboard.js
// Handles copying and pasting nodes (and their connections) inside the canvas.

import { state } from './state.js';
import { addNode } from './nodes.js';
import { getSelectedNodes, setSelectedNodes } from './selection.js';
import { createConnectionBetweenNodes, clearConnectionSelection } from './connections.js';
import { NODE_TYPE_TEXT, NODE_TYPE_IMAGE } from './nodes/constants.js';

function parseNumeric(value, fallback = 0) {
    const numeric = Number.parseFloat(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function ensureSizeValue(cssValue, fallback) {
    if (cssValue && typeof cssValue === 'string' && cssValue.trim().length > 0) {
        return cssValue;
    }
    const fallbackValue = Number.isFinite(fallback) ? fallback : 0;
    return `${fallbackValue}px`;
}

function buildClipboardPayload(nodes) {
    if (!nodes.length) return null;

    const positions = nodes.map((node) => ({
        node,
        left: parseNumeric(node.style.left, node.offsetLeft || 0),
        top: parseNumeric(node.style.top, node.offsetTop || 0),
    }));

    const minLeft = Math.min(...positions.map((entry) => entry.left));
    const minTop = Math.min(...positions.map((entry) => entry.top));

    const payloadNodes = positions.map(({ node, left, top }) => {
        const type = node.dataset.type || NODE_TYPE_TEXT;
        const width = ensureSizeValue(node.style.width, node.offsetWidth);
        const height = ensureSizeValue(node.style.height, node.offsetHeight);
        let content = '';
        let imageSrc = '';

        if (type === NODE_TYPE_IMAGE) {
            imageSrc = node.dataset.imageSrc || '';
        } else {
            const textElement = node.querySelector('.node-textarea');
            if (textElement) {
                content = textElement.innerHTML === '<br>' ? '' : textElement.innerHTML;
            }
        }

        return {
            originalId: node.id,
            offsetX: left - minLeft,
            offsetY: top - minTop,
            width,
            height,
            type,
            content,
            imageSrc,
        };
    });

    const nodeIds = payloadNodes.map((item) => item.originalId);
    const payloadConnections = state.connections
        .filter((connection) => (
            nodeIds.includes(connection.sourceId)
            && nodeIds.includes(connection.targetId)
        ))
        .map((connection) => ({
            sourceId: connection.sourceId,
            sourceAnchor: connection.sourceAnchor,
            targetId: connection.targetId,
            targetAnchor: connection.targetAnchor,
            lineStyle: connection.lineStyle,
        }));

    return {
        nodes: payloadNodes,
        connections: payloadConnections,
        bounds: {
            width: Math.max(...positions.map((entry) => entry.left)) - minLeft,
            height: Math.max(...positions.map((entry) => entry.top)) - minTop,
        },
        timestamp: Date.now(),
    };
}

export function copyNodes({ targetNode = null } = {}) {
    const selected = getSelectedNodes();
    const nodesToCopy = selected.length
        ? selected
        : (targetNode ? [targetNode] : []);

    const uniqueNodes = Array.from(new Set(nodesToCopy));
    if (!uniqueNodes.length) {
        return false;
    }

    const payload = buildClipboardPayload(uniqueNodes);
    if (!payload) {
        return false;
    }
    state.clipboard = payload;
    return true;
}

export function hasClipboardContent() {
    return Boolean(state.clipboard?.nodes?.length);
}

export function pasteClipboard(canvasX, canvasY) {
    const clipboard = state.clipboard;
    if (!clipboard || !clipboard.nodes || clipboard.nodes.length === 0) {
        return false;
    }

    const nodeIdMap = new Map();
    const newlyCreatedNodes = [];

    clipboard.nodes.forEach((data) => {
        const x = canvasX + data.offsetX;
        const y = canvasY + data.offsetY;

        const options = { type: data.type };
        if (data.type === NODE_TYPE_IMAGE && data.imageSrc) {
            options.imageSrc = data.imageSrc;
        }

        const node = addNode(
            x,
            y,
            data.type === NODE_TYPE_IMAGE ? '' : data.content,
            data.width,
            data.height,
            null,
            options,
        );

        if (node) {
            nodeIdMap.set(data.originalId, node.id);
            newlyCreatedNodes.push(node);
        }
    });

    clipboard.connections.forEach((connection) => {
        const newSourceId = nodeIdMap.get(connection.sourceId);
        const newTargetId = nodeIdMap.get(connection.targetId);
        if (!newSourceId || !newTargetId) return;
        createConnectionBetweenNodes(
            newSourceId,
            connection.sourceAnchor,
            newTargetId,
            connection.targetAnchor,
            { lineStyle: connection.lineStyle },
        );
    });

    if (newlyCreatedNodes.length) {
        clearConnectionSelection();
        setSelectedNodes(newlyCreatedNodes);
        return true;
    }
    return false;
}
