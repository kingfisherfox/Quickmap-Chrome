// js/charts/chartControls.js

import { state } from '../state.js';
import {
    handleNameInputChange,
    handleSaveChart,
    handleLoadChart,
    handleDeleteChart,
    startNewChart,
    refreshChartDropdown,
    ensureSafeToDiscard,
    loadLastChartIfAvailable,
} from './chartLifecycle.js';
import { migrateLegacyData } from './chartStorage.js';
import {
    setChartUIElements,
    getChartUIElements,
} from './chartContext.js';

export function initializeChartControls() {
    const nameInputElement = document.getElementById('chart-name-input');
    const saveButtonElement = document.getElementById('save-chart-btn');
    const loadButtonElement = document.getElementById('load-chart-btn');
    const deleteButtonElement = document.getElementById('delete-chart-btn');
    const newButtonElement = document.getElementById('new-chart-btn');
    const chartSelectElement = document.getElementById('chart-select');

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

    setChartUIElements({
        nameInput: nameInputElement,
        saveButton: saveButtonElement,
        loadButton: loadButtonElement,
        deleteButton: deleteButtonElement,
        newButton: newButtonElement,
        select: chartSelectElement,
    });

    migrateLegacyData();
    refreshChartDropdown();

    nameInputElement.addEventListener('input', () => {
        handleNameInputChange(nameInputElement.value.trim());
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

    const loadedLast = loadLastChartIfAvailable();
    if (!loadedLast && !state.currentChartId && state.nodes.length === 0) {
        startNewChart();
        const { select } = getChartUIElements();
        if (select) {
            select.value = '';
        }
    }
}
