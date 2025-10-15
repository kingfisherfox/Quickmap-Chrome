// js/nodes/nodeCreation.js

import { markDirty, state } from '../state.js';
import {
    queueConnectionRefresh,
    handleNodeLayoutChange,
} from '../connections.js';
import {
    NODE_TYPE_TEXT,
    NODE_TYPE_IMAGE,
} from './constants.js';
import { setActiveNode } from './selection.js';
import { deleteNode } from './nodeDeletion.js';
import { updateCanvasBounds } from './canvasBounds.js';
import {
    makeNodeDraggable,
    makeNodeResizable,
    addConnectionPoints,
    setupToolbarHover,
} from './behaviors.js';

export function addNode(
    x,
    y,
    content = '',
    width = '250px',
    height = '150px',
    id = null,
    options = {},
) {
    const {
        markDirtyOnChange = true,
        type = NODE_TYPE_TEXT,
        imageSrc = null,
    } = options;
    const node = document.createElement('div');
    node.className = 'node';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = width;
    node.style.height = height;
    node.id = id || `node-${state.nodeIdCounter++}`;
    node.setAttribute('tabindex', '0');
    node.dataset.type = type;
    if (type === NODE_TYPE_IMAGE && imageSrc) {
        node.dataset.imageSrc = imageSrc;
        node.classList.add('node-image-container');
    }

    const hoverTag = document.createElement('div');
    hoverTag.className = 'node-hover-tag';
    hoverTag.setAttribute('tabindex', '0');
    hoverTag.setAttribute('aria-label', 'Drag node handle');
    hoverTag.title = 'Drag node';
    node.appendChild(hoverTag);

    const topBar = document.createElement('div');
    topBar.className = 'node-top-bar';
    topBar.setAttribute('role', 'toolbar');
    topBar.setAttribute('aria-label', 'Node actions');

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'node-delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.setAttribute('aria-label', 'Delete node');
    deleteButton.addEventListener('mousedown', (event) => {
        setActiveNode(node);
        event.stopPropagation();
    });
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteNode(node);
    });

    topBar.appendChild(deleteButton);

    node.appendChild(topBar);

    let textarea = null;
    if (type === NODE_TYPE_IMAGE && imageSrc) {
        const imageElement = document.createElement('img');
        imageElement.src = imageSrc;
        imageElement.alt = options.alt || 'Pasted image';
        imageElement.className = 'node-image';
        node.appendChild(imageElement);
    } else {
        textarea = document.createElement('div');
        textarea.contentEditable = 'true';
        textarea.spellcheck = true;
        textarea.className = 'node-textarea';
        textarea.dataset.placeholder = 'Enter text here';
        if (content) {
            const isRichText = /<\s*(h[1-4]|p|br|div|span|strong|em|u|b|i|hr|ul|ol|li)/i.test(content);
            if (isRichText) {
                textarea.innerHTML = content;
            } else {
                textarea.textContent = content;
            }
        }
        node.appendChild(textarea);
    }
    const parent = state.canvasContent || state.canvasTransform || state.canvasContainer;
    parent?.appendChild(node);
    state.nodes.push(node);

    console.info('Node added', { id: node.id, x, y, type });

    node.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        setActiveNode(node);
    });

    node.addEventListener('focus', () => {
        setActiveNode(node);
    });

    makeNodeDraggable(node, [topBar, hoverTag]);
    makeNodeResizable(node);
    addConnectionPoints(node);
    setupToolbarHover(node, hoverTag, topBar);

    if (markDirtyOnChange) {
        markDirty();
    }

    if (textarea) {
        textarea.addEventListener('input', () => {
            markDirty();
            handleNodeLayoutChange();
        });
        textarea.addEventListener('focus', () => {
            setActiveNode(node);
        });
    }

    updateCanvasBounds();
    queueConnectionRefresh();
}
