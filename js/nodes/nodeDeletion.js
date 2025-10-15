// js/nodes/nodeDeletion.js

import { markDirty, state } from '../state.js';
import {
    removeConnectionsForNode,
    queueConnectionRefresh,
} from '../connections.js';
import { removeNodeFromSelection } from '../selection.js';
import { setActiveNode } from './selection.js';
import { updateCanvasBounds } from './canvasBounds.js';

export function deleteNode(node) {
    removeConnectionsForNode(node.id);
    removeNodeFromSelection(node);
    if (node.classList.contains('node-active')) {
        setActiveNode(null);
    }

    const parent = state.canvasContent || state.canvasTransform || state.canvasContainer;
    if (parent?.contains(node)) {
        parent.removeChild(node);
    }

    state.nodes = state.nodes.filter((current) => current !== node);

    markDirty();
    console.info('Node deleted', { id: node.id });

    updateCanvasBounds();
    queueConnectionRefresh();
}
