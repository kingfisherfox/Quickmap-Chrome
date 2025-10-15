// js/nodes/nodeData.js

import { state } from '../state.js';
import { clearSelection } from '../selection.js';
import { queueConnectionRefresh } from '../connections.js';
import {
    NODE_TYPE_TEXT,
    NODE_TYPE_IMAGE,
} from './constants.js';
import { clearActiveNodes } from './selection.js';
import { addNode } from './nodeCreation.js';
import { updateCanvasBounds } from './canvasBounds.js';

export function serializeNodes() {
    return state.nodes.map((node) => {
        const type = node.dataset.type || NODE_TYPE_TEXT;
        const base = {
            id: node.id,
            left: node.style.left,
            top: node.style.top,
            width: node.style.width,
            height: node.style.height,
            type,
        };

        if (type === NODE_TYPE_IMAGE) {
            base.imageSrc = node.dataset.imageSrc || '';
        } else {
            const textElement = node.querySelector('.node-textarea');
            if (textElement) {
                const html = textElement.innerHTML;
                base.content = html === '<br>' ? '' : html;
            } else {
                base.content = '';
            }
        }

        return base;
    });
}

export function loadNodes(nodeData = []) {
    state.nodeIdCounter = 0;
    state.nodes = [];
    clearSelection();
    clearActiveNodes();

    nodeData.forEach((data) => {
        const type = data.type || NODE_TYPE_TEXT;
        const options = {
            markDirtyOnChange: false,
            type,
        };
        if (type === NODE_TYPE_IMAGE && data.imageSrc) {
            options.imageSrc = data.imageSrc;
        }

        const left = parseFloat(data.left);
        const top = parseFloat(data.top);
        const width = data.width || '250px';
        const height = data.height || '150px';

        addNode(
            Number.isNaN(left) ? 100 : left,
            Number.isNaN(top) ? 100 : top,
            type === NODE_TYPE_IMAGE ? '' : data.content,
            width,
            height,
            data.id,
            options,
        );
    });

    if (state.nodes.length > 0) {
        const nodeIds = state.nodes.map((node) => node.id);
        const nodeNumbers = nodeIds.map((nodeId) => {
            const [, numberPart] = nodeId.split('-');
            const parsed = parseInt(numberPart, 10);
            return Number.isNaN(parsed) ? 0 : parsed;
        });
        state.nodeIdCounter = Math.max(...nodeNumbers, 0) + 1;
    }

    updateCanvasBounds();
    queueConnectionRefresh();
}
