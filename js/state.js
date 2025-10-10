// state.js

export const state = {
    nodes: [],
    canvasContainer: null,
    canvasTransform: null,
    canvasContent: null,
    jsPlumbInstance: null,
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
