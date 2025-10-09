// script.js (entry point)

import { state } from './state.js';
import { setupCanvasInteractions, clearCanvas } from './canvas.js';
import { initializeJsPlumb, enableLineDeletion } from './connections.js';
import { setupNodeInteractions } from './nodes.js';
import { initializeChartControls } from './charts.js';

document.addEventListener('DOMContentLoaded', () => {
    const canvasContainer = document.getElementById('canvas-container');
    state.canvasContainer = canvasContainer;
    window.canvasContainer = canvasContainer;

    initializeJsPlumb();
    setupCanvasInteractions();
    setupNodeInteractions();

    enableLineDeletion();
    initializeChartControls();

    const clearButton = document.getElementById('clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', () => clearCanvas());
    } else {
        console.warn('Clear button not found on the page.');
    }

    console.log('App initialized successfully.');
});
