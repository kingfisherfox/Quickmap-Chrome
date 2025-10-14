// nodes.js

import { state, markDirty } from './state.js';
import {
    applySettingsToAllConnections,
    registerAnchor,
    removeConnectionsForNode,
    handleNodeLayoutChange,
    queueConnectionRefresh,
    updateConnectionLayerSize,
} from './connections.js';
import {
    getSelectedNodes,
    isNodeSelected,
    removeNodeFromSelection,
    clearSelection,
} from './selection.js';

const NODE_TYPE_TEXT = 'text';
const NODE_TYPE_IMAGE = 'image';

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
    }

    updateCanvasBounds();
    queueConnectionRefresh();
}

export function setupNodeInteractions() {
    state.canvasContainer.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        addNode(
            (event.pageX - state.panOffsetX) / state.scale,
            (event.pageY - state.panOffsetY) / state.scale,
        );
    });
}

export function initializeImagePasteHandling() {
    document.addEventListener('paste', handlePasteEvent);
}

export function deleteNode(node) {
    removeConnectionsForNode(node.id);
    removeNodeFromSelection(node);

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

function makeNodeDraggable(node, handles) {
    const dragHandles = Array.isArray(handles)
        ? handles.filter(Boolean)
        : [handles].filter(Boolean);
    if (dragHandles.length === 0) return;

    const getCanvasCoordinates = (event) => ({
        x: (event.pageX - state.panOffsetX) / state.scale,
        y: (event.pageY - state.panOffsetY) / state.scale,
    });

    const startDragging = (event) => {
        if (node.isResizing) return;
        if (event.type === 'mousedown' && event.button !== 0) return;
        event.stopPropagation();
        node.isDragging = true;
        const { x, y } = getCanvasCoordinates(event);
        const selected = getSelectedNodes();
        const isGroupDrag = selected.length > 1 && isNodeSelected(node);
        const targets = isGroupDrag ? selected : [node];

        state.activeDrag = {
            origin: node,
            pointerStartX: x,
            pointerStartY: y,
            targets: targets.map((current) => ({
                node: current,
                startLeft: Number.parseFloat(current.style.left) || current.offsetLeft || 0,
                startTop: Number.parseFloat(current.style.top) || current.offsetTop || 0,
            })),
        };

        document.body.style.cursor = 'move';
        event.preventDefault();
    };

    dragHandles.forEach((handle) => {
        handle.addEventListener('mousedown', startDragging);
    });

    document.addEventListener('mousemove', (event) => {
        if (!node.isDragging) return;
        if (!state.activeDrag || state.activeDrag.origin !== node) return;

        const { x, y } = getCanvasCoordinates(event);
        const deltaX = x - state.activeDrag.pointerStartX;
        const deltaY = y - state.activeDrag.pointerStartY;

        state.activeDrag.targets.forEach((target) => {
            target.node.style.left = `${target.startLeft + deltaX}px`;
            target.node.style.top = `${target.startTop + deltaY}px`;
        });
        handleNodeLayoutChange();
    });

    document.addEventListener('mouseup', () => {
        if (!node.isDragging) return;

        node.isDragging = false;
        if (state.activeDrag?.origin === node) {
            state.activeDrag = null;
        }
        document.body.style.cursor = 'default';
        markDirty();
        applySettingsToAllConnections();
        updateCanvasBounds();
        handleNodeLayoutChange();
    });
}

function setupToolbarHover(node, hoverTag, topBar) {
    let hideTimeout = null;

    const showToolbar = () => {
        clearTimeout(hideTimeout);
        node.classList.add('node-toolbar-active');
    };

    const scheduleHide = () => {
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            node.classList.remove('node-toolbar-active');
        }, 200);
    };

    const toolbarElements = [hoverTag, topBar, topBar.querySelector('.node-delete-button')].filter(Boolean);

    toolbarElements.forEach((element) => {
        element.addEventListener('mouseenter', showToolbar);
        element.addEventListener('mouseleave', scheduleHide);
        element.addEventListener('focus', showToolbar);
        element.addEventListener('blur', scheduleHide);
    });
}

function makeNodeResizable(node) {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    node.appendChild(resizeHandle);

    let startX;
    let startY;
    let initialWidth;
    let initialHeight;

    const resizeMouseMove = (event) => {
        if (!node.isResizing) return;

        const deltaX = event.clientX - startX;
        const deltaY = event.clientY - startY;
        const newWidth = initialWidth + deltaX;
        const newHeight = initialHeight + deltaY;

        node.style.width = `${newWidth}px`;
        node.style.height = `${newHeight}px`;
        handleNodeLayoutChange();
    };

    const stopResizing = () => {
        if (!node.isResizing) return;

        node.isResizing = false;
        document.body.style.cursor = 'default';
        markDirty();
        applySettingsToAllConnections();
        handleNodeLayoutChange();
        updateCanvasBounds();

        document.removeEventListener('mousemove', resizeMouseMove);
        document.removeEventListener('mouseup', stopResizing);
    };

    resizeHandle.addEventListener('mousedown', (event) => {
        event.stopPropagation();
        node.isResizing = true;
        startX = event.clientX;
        startY = event.clientY;
        initialWidth = node.clientWidth;
        initialHeight = node.clientHeight;
        document.body.style.cursor = 'se-resize';

        document.addEventListener('mousemove', resizeMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });
}

function addConnectionPoints(node) {
    const connectionPositions = ['Top', 'Right', 'Bottom', 'Left'];

    connectionPositions.forEach((position) => {
        const circle = document.createElement('div');
        circle.className = `connection-point ${position.toLowerCase()}`;
        node.appendChild(circle);
        registerAnchor(node, circle, position);
    });
    handleNodeLayoutChange();
}

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

function handlePasteEvent(event) {
    const items = event.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || !item.type?.startsWith('image/')) continue;
        const file = item.getAsFile();
        if (!file) continue;

        event.preventDefault();
        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const dataUrl = loadEvent.target?.result;
            if (typeof dataUrl === 'string') {
                addImageNode(dataUrl);
            }
        };
        reader.readAsDataURL(file);
        break;
    }
}

function addImageNode(dataUrl) {
    const defaultWidth = 250;
    const defaultHeight = 200;
    const x = ((state.lastPointerX - state.panOffsetX) / state.scale) - defaultWidth / 2;
    const y = ((state.lastPointerY - state.panOffsetY) / state.scale) - defaultHeight / 2;

    addNode(
        Math.max(0, x),
        Math.max(0, y),
        '',
        `${defaultWidth}px`,
        `${defaultHeight}px`,
        null,
        {
            type: NODE_TYPE_IMAGE,
            imageSrc: dataUrl,
        },
    );
}
