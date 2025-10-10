// charts.js

import { state, setCurrentChart, markDirty, resetDirty } from './state.js';
import { clearCanvas, updateCanvasTransform } from './canvas.js';
import { serializeNodes, loadNodes } from './nodes.js';
import { serializeConnections, loadConnections, applySettingsToAllConnections } from './connections.js';
import { applyStateToControls } from './settings.js';

const STORAGE_KEY = 'quickmapCharts';
const LAST_CHART_KEY = 'quickmapLastChartId';

let nameInputElement;
let saveButtonElement;
let loadButtonElement;
let deleteButtonElement;
let newButtonElement;
let chartSelectElement;
let suppressNameDirty = false;

export function initializeChartControls() {
    nameInputElement = document.getElementById('chart-name-input');
    saveButtonElement = document.getElementById('save-chart-btn');
    loadButtonElement = document.getElementById('load-chart-btn');
    deleteButtonElement = document.getElementById('delete-chart-btn');
    newButtonElement = document.getElementById('new-chart-btn');
    chartSelectElement = document.getElementById('chart-select');

    if (
        !nameInputElement
        || !saveButtonElement
        || !loadButtonElement
        || !deleteButtonElement
        || !newButtonElement
        || !chartSelectElement
    ) {
        console.warn('Chart controls not found in the header.');
        return;
    }

    migrateLegacyData();
    refreshChartDropdown();

    nameInputElement.addEventListener('input', () => {
        const value = nameInputElement.value.trim();
        state.currentChartName = value;
        if (!suppressNameDirty) {
            markDirty();
        }
    });

    saveButtonElement.addEventListener('click', () => {
        handleSaveChart();
    });

    loadButtonElement.addEventListener('click', () => {
        const chartId = chartSelectElement.value;
        if (!chartId) {
            alert('Select a chart to load.');
            return;
        }
        handleLoadChart(chartId);
    });

    deleteButtonElement.addEventListener('click', () => {
        const chartId = chartSelectElement.value;
        if (!chartId) {
            alert('Select a chart to delete.');
            return;
        }
        handleDeleteChart(chartId);
    });

    newButtonElement.addEventListener('click', () => {
        if (!ensureSafeToDiscard()) return;
        startNewChart();
    });

    const lastChartId = localStorage.getItem(LAST_CHART_KEY);
    if (lastChartId) {
        const charts = readCharts();
        const lastChart = charts.find((chart) => chart.id === lastChartId);
        if (lastChart) {
            handleLoadChart(lastChart.id, { skipSafetyCheck: true });
            chartSelectElement.value = lastChart.id;
        }
    }

    if (!state.currentChartId && state.nodes.length === 0) {
        startNewChart();
    }
}

export function startNewChart() {
    clearCanvas({ markDirty: false });
    state.panOffsetX = 0;
    state.panOffsetY = 0;
    state.scale = 1;
    updateCanvasTransform();
    state.jsPlumbInstance?.setZoom(1);

    setCurrentChart(null, '');
    suppressNameDirty = true;
    nameInputElement.value = '';
    suppressNameDirty = false;
    chartSelectElement.value = '';
    resetDirty();
}

export function handleSaveChart() {
    const chartName = nameInputElement.value.trim();
    if (!chartName) {
        alert('Please enter a chart name before saving.');
        return false;
    }

    const serializedNodes = serializeNodes();
    const serializedConnections = serializeConnections();
    const serializedSettings = {
        animated: !!state.connectionSettings.animated,
    };

    const charts = readCharts();
    const timestamp = Date.now();
    let chartId = state.currentChartId;

    const payload = {
        id: chartId || generateChartId(),
        name: chartName,
        nodes: serializedNodes,
        connections: serializedConnections,
        settings: serializedSettings,
        updatedAt: timestamp,
    };

    if (!chartId) {
        const existingByName = charts.find(
            (chart) => chart.name.toLowerCase() === chartName.toLowerCase(),
        );

        if (existingByName) {
            const overwrite = confirm(
                `A chart named "${existingByName.name}" already exists. Overwrite it?`,
            );
            if (!overwrite) return false;
            chartId = existingByName.id;
            payload.id = chartId;
        }
    }

    const existingIndex = charts.findIndex((chart) => chart.id === payload.id);
    if (existingIndex >= 0) {
        charts[existingIndex] = payload;
    } else {
        charts.push(payload);
    }

    writeCharts(charts);
    setCurrentChart(payload.id, payload.name);
    resetDirty();
    localStorage.setItem(LAST_CHART_KEY, payload.id);
    refreshChartDropdown(payload.id);
    chartSelectElement.value = payload.id;
    console.log(`Chart "${payload.name}" saved.`);
    return true;
}

export function handleLoadChart(chartId, options = {}) {
    const { skipSafetyCheck = false } = options;

    if (!skipSafetyCheck && !ensureSafeToDiscard()) {
        return;
    }

    const charts = readCharts();
    const chart = charts.find((item) => item.id === chartId);
    if (!chart) {
        alert('Unable to load chart. It may have been removed.');
        refreshChartDropdown();
        return;
    }

    clearCanvas({ markDirty: false });
    state.panOffsetX = 0;
    state.panOffsetY = 0;
    state.scale = 1;
    updateCanvasTransform();
    state.jsPlumbInstance?.setZoom(1);

    setCurrentChart(chart.id, chart.name);
    suppressNameDirty = true;
    nameInputElement.value = chart.name;
    suppressNameDirty = false;

    loadNodes(chart.nodes || []);
    loadConnections(chart.connections || []);

    state.connectionSettings.animated = !!chart.settings?.animated;
    applyStateToControls();
    applySettingsToAllConnections();

    resetDirty();
    localStorage.setItem(LAST_CHART_KEY, chart.id);
    refreshChartDropdown(chart.id);
    chartSelectElement.value = chart.id;
    console.log(`Chart "${chart.name}" loaded.`);
}

export function handleDeleteChart(chartId) {
    const charts = readCharts();
    const chart = charts.find((item) => item.id === chartId);
    if (!chart) {
        alert('Selected chart could not be found.');
        refreshChartDropdown();
        return;
    }

    if (state.currentChartId === chartId && state.isDirty) {
        const proceed = confirm(
            'You have unsaved changes to this chart. Deleting it will discard those changes. Continue?',
        );
        if (!proceed) return;
    }

    const confirmed = confirm(`Delete chart "${chart.name}"? This action cannot be undone.`);
    if (!confirmed) return;

    const updatedCharts = charts.filter((item) => item.id !== chartId);
    writeCharts(updatedCharts);

    const lastChartId = localStorage.getItem(LAST_CHART_KEY);
    if (lastChartId === chartId) {
        localStorage.removeItem(LAST_CHART_KEY);
    }

    if (state.currentChartId === chartId) {
        startNewChart();
        refreshChartDropdown();
        chartSelectElement.value = '';
    } else {
        refreshChartDropdown(state.currentChartId);
        chartSelectElement.value = state.currentChartId || '';
    }

    alert(`Chart "${chart.name}" deleted.`);
}

export function refreshChartDropdown(selectedId = state.currentChartId) {
    if (!chartSelectElement) return;

    const charts = readCharts().sort((a, b) => b.updatedAt - a.updatedAt);
    chartSelectElement.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = charts.length ? 'Choose a saved chart' : 'No charts saved yet';
    chartSelectElement.appendChild(placeholder);

    charts.forEach((chart) => {
        const option = document.createElement('option');
        option.value = chart.id;
        option.textContent = chart.name;
        if (chart.id === selectedId) {
            option.selected = true;
        }
        chartSelectElement.appendChild(option);
    });
}

function ensureSafeToDiscard() {
    if (!state.isDirty) return true;

    const saveFirst = confirm(
        'You have unsaved changes. Click OK to save before continuing, or Cancel for more options.',
    );
    if (saveFirst) {
        const saved = handleSaveChart();
        return saved;
    }

    const discard = confirm('Discard unsaved changes and continue?');
    return discard;
}

function readCharts() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
        console.error('Failed to parse saved charts.', error);
        return [];
    }
}

function writeCharts(charts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

function generateChartId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `chart-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

function migrateLegacyData() {
    const legacyNodes = localStorage.getItem('nodes');
    const legacyConnections = localStorage.getItem('connections');

    if (!legacyNodes && !legacyConnections) return;

    const charts = readCharts();
    if (!charts.length) {
        let parsedNodes = [];
        let parsedConnections = [];
        try {
            parsedNodes = legacyNodes ? JSON.parse(legacyNodes) : [];
            parsedConnections = legacyConnections ? JSON.parse(legacyConnections) : [];
        } catch (error) {
            console.warn('Failed to migrate legacy data.', error);
        }
        charts.push({
            id: generateChartId(),
            name: 'Imported Chart',
            nodes: parsedNodes,
            connections: parsedConnections,
            updatedAt: Date.now(),
        });
        writeCharts(charts);
    }

    localStorage.removeItem('nodes');
    localStorage.removeItem('connections');
}
