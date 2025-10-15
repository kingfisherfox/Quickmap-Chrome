// js/nodes/behaviors.js

import { state, markDirty } from '../state.js';
import {
    applySettingsToAllConnections,
    registerAnchor,
    handleNodeLayoutChange,
    queueConnectionRefresh,
} from '../connections.js';
import { getSelectedNodes, isNodeSelected } from '../selection.js';
import { setActiveNode } from './selection.js';
import { updateCanvasBounds } from './canvasBounds.js';

export function makeNodeDraggable(node, handles) {
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
        setActiveNode(node);
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

export function setupToolbarHover(node, hoverTag, topBar) {
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

    const toolbarElements = [hoverTag, topBar, topBar?.querySelector('.node-delete-button')].filter(Boolean);

    toolbarElements.forEach((element) => {
        element.addEventListener('mouseenter', showToolbar);
        element.addEventListener('mouseleave', scheduleHide);
        element.addEventListener('focus', showToolbar);
        element.addEventListener('blur', scheduleHide);
    });
}

export function makeNodeResizable(node) {
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
        setActiveNode(node);
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

export function addConnectionPoints(node) {
    const connectionPositions = ['Top', 'Right', 'Bottom', 'Left'];

    connectionPositions.forEach((position) => {
        const circle = document.createElement('div');
        circle.className = `connection-point ${position.toLowerCase()}`;
        circle.addEventListener('mousedown', () => {
            setActiveNode(node);
        });
        node.appendChild(circle);
        registerAnchor(node, circle, position);
    });
    handleNodeLayoutChange();
    queueConnectionRefresh();
}
