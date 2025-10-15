// js/charts/chartContext.js

const chartContext = {
    nameInput: null,
    saveButton: null,
    loadButton: null,
    deleteButton: null,
    newButton: null,
    select: null,
    suppressNameDirty: false,
};

export function setChartUIElements({
    nameInput,
    saveButton,
    loadButton,
    deleteButton,
    newButton,
    select,
}) {
    chartContext.nameInput = nameInput;
    chartContext.saveButton = saveButton;
    chartContext.loadButton = loadButton;
    chartContext.deleteButton = deleteButton;
    chartContext.newButton = newButton;
    chartContext.select = select;
}

export function getChartUIElements() {
    return chartContext;
}

export function setSuppressNameDirty(value) {
    chartContext.suppressNameDirty = Boolean(value);
}

export function isSuppressNameDirty() {
    return chartContext.suppressNameDirty;
}
