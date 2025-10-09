// nodes.js

import { state, markDirty } from './state.js';
import { edgeMappings, EDGE_TYPE_PLAIN } from './edgeStyles.js';

export function addNode(
    x,
    y,
    content = '',
    width = '250px',
    height = '150px',
    id = null,
    options = {},
) {
    const { markDirtyOnChange = true } = options;
    const node = document.createElement('div');
    node.className = 'node';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = width;
    node.style.height = height;
    node.id = id || `node-${state.nodeIdCounter++}`;
    node.setAttribute('tabindex', '0');

    const topBar = document.createElement('div');
    topBar.className = 'node-top-bar';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'node-drag-handle';
    dragHandle.textContent = 'Drag';

    const deleteButton = document.createElement('span');
    deleteButton.className = 'node-delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', (event) => {
        event.stopPropagation();
        deleteNode(node);
    });

    topBar.appendChild(dragHandle);
    topBar.appendChild(deleteButton);

    node.appendChild(topBar);

    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Enter text here';
    textarea.value = content;
    textarea.className = 'node-textarea';

    node.appendChild(textarea);
    const parent = state.canvasTransform || state.canvasContainer;
    parent?.appendChild(node);
    state.nodes.push(node);

    console.info('Node added', { id: node.id, x, y });

    makeNodeDraggable(node, dragHandle);
    makeNodeResizable(node);
    addConnectionPoints(node);

    if (markDirtyOnChange) {
        markDirty();
    }

    textarea.addEventListener('input', () => {
        markDirty();
    });

    state.jsPlumbInstance?.repaintEverything();
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

export function deleteNode(node) {
    state.jsPlumbInstance?.remove(node.id);

    const parent = state.canvasTransform || state.canvasContainer;
    if (parent?.contains(node)) {
        parent.removeChild(node);
    }

    state.nodes = state.nodes.filter((current) => current !== node);

    markDirty();
    console.info('Node deleted', { id: node.id });
}

export function serializeNodes() {
    return state.nodes.map((node) => ({
        id: node.id,
        left: node.style.left,
        top: node.style.top,
        content: node.querySelector('textarea').value,
        width: node.style.width,
        height: node.style.height,
    }));
}

export function loadNodes(nodeData = []) {
    state.nodeIdCounter = 0;
    state.nodes = [];

    nodeData.forEach((data) => {
        addNode(
            parseFloat(data.left),
            parseFloat(data.top),
            data.content,
            data.width,
            data.height,
            data.id,
            { markDirtyOnChange: false },
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

    state.jsPlumbInstance?.repaintEverything();
}

function makeNodeDraggable(node, handle) {
    let offsetX;
    let offsetY;

    handle.addEventListener('mousedown', (event) => {
        if (node.isResizing) return;
        event.stopPropagation();
        node.isDragging = true;
        offsetX = event.offsetX;
        offsetY = event.offsetY;
        document.body.style.cursor = 'move';
    });

    document.addEventListener('mousemove', (event) => {
        if (!node.isDragging) return;

        const x = (event.pageX - offsetX - state.panOffsetX) / state.scale;
        const y = (event.pageY - offsetY - state.panOffsetY) / state.scale;
        node.style.left = `${x}px`;
        node.style.top = `${y}px`;
        state.jsPlumbInstance?.repaintEverything();
    });

    document.addEventListener('mouseup', () => {
        if (!node.isDragging) return;

        node.isDragging = false;
        document.body.style.cursor = 'default';
        markDirty();
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
        state.jsPlumbInstance?.repaintEverything();
    };

    const stopResizing = () => {
        if (!node.isResizing) return;

        node.isResizing = false;
        document.body.style.cursor = 'default';
        markDirty();

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
    const mappings = edgeMappings();
    const connectionPositions = ['Top', 'Right', 'Bottom', 'Left'];

    connectionPositions.forEach((position) => {
        const circle = document.createElement('div');
        circle.className = `connection-point ${position.toLowerCase()}`;
        node.appendChild(circle);

        const endpointOptions = {
            anchor: position,
            endpoint: ['Dot', { radius: 6 }],
            isSource: true,
            isTarget: true,
            maxConnections: -1,
            allowReattach: true,
            connector: ['Bezier', { curviness: 50 }],
            connectorStyle: mappings[EDGE_TYPE_PLAIN].connectorStyle,
            cssClass: mappings[EDGE_TYPE_PLAIN].cssClass,
            parameters: { parentPointEl: circle },
        };

        state.jsPlumbInstance?.addEndpoint(node, endpointOptions, {
            cssClass: 'connection-point-endpoint',
            endpointStyle: { fill: '#007BFF' },
            parent: circle,
        });
    });
}
