// script.js (entry point)

import { state } from './state.js';
import { setupCanvasInteractions, clearCanvas, updateCanvasTransform } from './canvas.js';
import { initializeConnectionLayer } from './connections.js';
import { setupNodeInteractions, initializeImagePasteHandling } from './nodes.js';
import { initializeChartControls } from './charts.js';
import { initializeSettingsPanel } from './settings.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    const canvasTransform = document.getElementById('canvas-transform');
    const canvasContent = document.getElementById('canvas-content');
    state.canvasContainer = canvasContainer;
    state.canvasTransform = canvasTransform;
    state.canvasContent = canvasContent;
    window.canvasContainer = canvasTransform;

    initializeConnectionLayer();
    setupCanvasInteractions();
    setupNodeInteractions();
    initializeImagePasteHandling();

    initializeChartControls();
    initializeSettingsPanel();
    updateCanvasTransform();

    const clearButton = document.getElementById('clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => clearCanvas());
    } else {
        console.warn('Clear button not found on the page.');
    }

    console.log('App initialized successfully.');
});
