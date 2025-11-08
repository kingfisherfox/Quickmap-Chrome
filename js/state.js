// state.js

export const state = {
    nodes: [],
    canvasContainer: null,
    canvasTransform: null,
    canvasContent: null,
    nodeIdCounter: 0,
    panOffsetX: 0,
    panOffsetY: 0,
    panStartX: 0,
    panStartY: 0,
    scale: 1,
    isPanning: false,
    isSpaceDown: false,
    currentChartId: null,
    currentChartName: '',
    isDirty: false,
    isRestoring: false,
    connectionSettings: {
        animated: false,
    },
    theme: 'light',
    lastPointerX: 200,
    lastPointerY: 200,
    connections: [],
    connectionIdCounter: 0,
    connectionPreview: null,
    connectionDrag: null,
    connectionHoverAnchor: null,
    connectionLayer: null,
    _connectionRefreshScheduled: false,
    selectedNodes: new Set(),
    isSelecting: false,
    selectionStartX: 0,
    selectionStartY: 0,
    selectionRect: null,
    activeDrag: null,
};

export function markDirty() {
    if (state.isRestoring) return;
    state.isDirty = true;
}

export function resetDirty() {
    state.isDirty = false;
}

export function setCurrentChart(id, name = '') {
    state.currentChartId = id;
    state.currentChartName = name;
}

export function scheduleConnectionRefresh(callback) {
    if (state._connectionRefreshScheduled) return;
    state._connectionRefreshScheduled = true;

    const raf = window.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
    raf(() => {
        state._connectionRefreshScheduled = false;
        callback?.();
    });
}
