// js/charts/chartStorage.js

export const STORAGE_KEY = 'quickmapCharts';
export const LAST_CHART_KEY = 'quickmapLastChartId';

export function readCharts() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch (error) {
        console.error('Failed to parse saved charts.', error);
        return [];
    }
}

export function writeCharts(charts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(charts));
}

export function generateChartId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `chart-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function migrateLegacyData() {
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
