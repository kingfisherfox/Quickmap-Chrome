// js/charts/chartLifecycle.js

import { state, setCurrentChart, markDirty, resetDirty } from '../state.js';
import { clearCanvas, updateCanvasTransform } from '../canvas.js';
import { serializeNodes, loadNodes } from '../nodes.js';
import {
    serializeConnections,
    loadConnections,
    applySettingsToAllConnections,
    clearConnections,
    queueConnectionRefresh,
} from '../connections.js';
import { applyStateToControls } from '../settings.js';
import {
    getChartUIElements,
    setSuppressNameDirty,
    isSuppressNameDirty,
} from './chartContext.js';
import {
    readCharts,
    writeCharts,
    generateChartId,
    LAST_CHART_KEY,
} from './chartStorage.js';

export function startNewChart() {
    clearCanvas({ markDirty: false });
    state.panOffsetX = 0;
    state.panOffsetY = 0;
    state.scale = 1;
    updateCanvasTransform();

    setCurrentChart(null, '');

    const { nameInput, select } = getChartUIElements();
    setSuppressNameDirty(true);
    if (nameInput) {
        nameInput.value = '';
    }
    setSuppressNameDirty(false);
    if (select) {
        select.value = '';
    }
    resetDirty();
}

export function handleSaveChart() {
    const { nameInput, select } = getChartUIElements();
    const chartName = nameInput?.value.trim() || '';
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
    if (select) {
        select.value = payload.id;
    }
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

    setCurrentChart(chart.id, chart.name);

    const { nameInput, select } = getChartUIElements();
    setSuppressNameDirty(true);
    if (nameInput) {
        nameInput.value = chart.name;
    }
    setSuppressNameDirty(false);

    clearConnections();
    loadNodes(chart.nodes || []);
    loadConnections(chart.connections || []);
    queueConnectionRefresh();

    state.connectionSettings.animated = !!chart.settings?.animated;
    applyStateToControls();
    applySettingsToAllConnections();

    resetDirty();
    localStorage.setItem(LAST_CHART_KEY, chart.id);
    refreshChartDropdown(chart.id);
    if (select) {
        select.value = chart.id;
    }
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

    const { select } = getChartUIElements();
    if (state.currentChartId === chartId) {
        startNewChart();
        refreshChartDropdown();
        if (select) {
            select.value = '';
        }
    } else {
        refreshChartDropdown(state.currentChartId);
        if (select) {
            select.value = state.currentChartId || '';
        }
    }

    alert(`Chart "${chart.name}" deleted.`);
}

export function refreshChartDropdown(selectedId = state.currentChartId) {
    const { select } = getChartUIElements();
    if (!select) return;

    const charts = readCharts().sort((a, b) => b.updatedAt - a.updatedAt);
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = charts.length ? 'Choose a saved chart' : 'No charts saved yet';
    select.appendChild(placeholder);

    charts.forEach((chart) => {
        const option = document.createElement('option');
        option.value = chart.id;
        option.textContent = chart.name;
        if (chart.id === selectedId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

export function loadLastChartIfAvailable() {
    const lastChartId = localStorage.getItem(LAST_CHART_KEY);
    if (!lastChartId) return false;
    const charts = readCharts();
    const lastChart = charts.find((chart) => chart.id === lastChartId);
    if (!lastChart) return false;
    handleLoadChart(lastChart.id, { skipSafetyCheck: true });
    const { select } = getChartUIElements();
    if (select) {
        select.value = lastChart.id;
    }
    return true;
}

export function ensureSafeToDiscard() {
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

export function handleNameInputChange(value) {
    state.currentChartName = value;
    if (!isSuppressNameDirty()) {
        markDirty();
    }
}
