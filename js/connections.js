// connections.js

import { state, markDirty } from './state.js';
import { edgeMappings, EDGE_TYPE_PLAIN } from './edgeStyles.js';

export function initializeJsPlumb() {
    const mappings = edgeMappings();

    state.jsPlumbInstance = jsPlumb.getInstance({
        Container: 'canvas-container',
        Connector: ['Bezier', { curviness: 50 }],
        Endpoint: ['Dot', { radius: 5 }],
        PaintStyle: mappings[EDGE_TYPE_PLAIN].paintStyle,
        EndpointStyle: { fill: '#007BFF' },
        ConnectionsDetachable: true,
        ReattachConnections: true,
    });

    state.jsPlumbInstance.bind('connection', (info) => {
        const connection = info.connection;
        console.info('Connection created', {
            sourceId: connection.sourceId,
            targetId: connection.targetId,
        });

        connection.data = connection.data || {};
        connection.data.connectorParams = connection.data.connectorParams || { curviness: 50 };
        connection.data.lineStyle = connection.data.lineStyle || EDGE_TYPE_PLAIN;

        if (!connection.getOverlay('deleteCircle')) {
            addDeleteOverlay(connection);
        }
        startEditingConnection(connection);

        if (!state.isRestoring) {
            markDirty();
        }
    });

    state.jsPlumbInstance.bind('connectionDragStart', (connection) => {
        console.info('Connection drag start', {
            sourceId: connection?.sourceId,
            targetId: connection?.targetId,
        });
    });

    state.jsPlumbInstance.bind('connectionDragStop', (connection) => {
        console.info('Connection drag stop', {
            sourceId: connection?.sourceId,
            targetId: connection?.targetId,
        });
    });

    state.jsPlumbInstance.bind('connectionDetached', (info) => {
        console.info('Connection detached', {
            sourceId: info?.sourceId,
            targetId: info?.targetId,
        });
        if (!state.isRestoring) {
            markDirty();
        }
    });

    window.jsPlumbInstance = state.jsPlumbInstance;
}

export function enableLineDeletion() {
    state.jsPlumbInstance?.bind('click', (connection, originalEvent) => {
        if (!originalEvent.target.className.includes('delete-circle')) return;
        connection.delete();
        markDirty();
    });
}

export function serializeConnections() {
    if (!state.jsPlumbInstance) return [];

    return state.jsPlumbInstance.getAllConnections().map((connection) => ({
        sourceId: connection.sourceId,
        targetId: connection.targetId,
        anchors: [
            connection.endpoints[0].anchor.type,
            connection.endpoints[1].anchor.type,
        ],
        connectorType: connection.getConnector().type,
        connectorParams: connection.data?.connectorParams || {},
        lineStyle: connection.data?.lineStyle || EDGE_TYPE_PLAIN,
    }));
}

export function loadConnections(connectionData = []) {
    if (!state.jsPlumbInstance) return;

    state.isRestoring = true;

    try {
        connectionData.forEach((storedConnection) => {
            try {
                const sourceElement = document.getElementById(storedConnection.sourceId);
                const targetElement = document.getElementById(storedConnection.targetId);

                if (!sourceElement || !targetElement) {
                    console.warn(
                        `Cannot create connection: Source or target element not found for IDs ${storedConnection.sourceId} and ${storedConnection.targetId}`,
                    );
                    return;
                }

                const newConnection = state.jsPlumbInstance.connect({
                    source: storedConnection.sourceId,
                    target: storedConnection.targetId,
                    anchors: storedConnection.anchors,
                    connector: [
                        storedConnection.connectorType || 'Bezier',
                        storedConnection.connectorParams || { curviness: 50 },
                    ],
                    paintStyle: edgeMappings()[storedConnection.lineStyle || EDGE_TYPE_PLAIN].connectorStyle,
                });

                if (newConnection) {
                    newConnection.data = {
                        connectorParams: storedConnection.connectorParams || { curviness: 50 },
                        lineStyle: storedConnection.lineStyle || EDGE_TYPE_PLAIN,
                    };
                    if (storedConnection.lineStyle) {
                        newConnection.setPaintStyle(
                            edgeMappings()[storedConnection.lineStyle || EDGE_TYPE_PLAIN].connectorStyle,
                        );
                    }
                }
            } catch (error) {
                console.error('Error loading connection:', error);
            }
        });
    } finally {
        state.isRestoring = false;
    }

    state.jsPlumbInstance.repaintEverything();
}

function startEditingConnection(connection) {
    const mappings = edgeMappings();
    const midpointOverlay = connection.getOverlay('midpoint');
    if (!midpointOverlay) return;

    const midpointElement = midpointOverlay.getElement();

    let isDraggingMidpoint = false;
    let startX;
    let startY;

    const onMouseMove = (event) => {
        if (!isDraggingMidpoint) return;

        const deltaX = (event.clientX - startX) / state.scale;
        const deltaY = (event.clientY - startY) / state.scale;

        startX = event.clientX;
        startY = event.clientY;

        const connector = connection.getConnector();
        if (connector.type !== 'Bezier') return;

        let curviness = connection.data.connectorParams.curviness || 50;
        curviness += deltaY;
        curviness = Math.max(-200, Math.min(200, curviness));

        connection.setConnector(['Bezier', { curviness }]);
        connection.data.connectorParams.curviness = curviness;
    };

    const onMouseUp = () => {
        if (!isDraggingMidpoint) return;

        isDraggingMidpoint = false;
        document.body.style.cursor = 'default';

        const newLineStyle = prompt(
            'Enter line style (plain/dashed):',
            connection.data.lineStyle || EDGE_TYPE_PLAIN,
        );
        if (newLineStyle && edgeMappings()[newLineStyle]) {
            connection.setPaintStyle(edgeMappings()[newLineStyle].connectorStyle);
            connection.data.lineStyle = newLineStyle;
        }

        markDirty();

        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };

    const onMouseDown = (event) => {
        event.stopPropagation();
        isDraggingMidpoint = true;
        startX = event.clientX;
        startY = event.clientY;
        document.body.style.cursor = 'move';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    midpointElement.addEventListener('mousedown', onMouseDown);
}

function addDeleteOverlay(connection) {
    connection.addOverlay([
        'Custom',
        {
            create() {
                const circle = document.createElement('div');
                circle.className = 'delete-circle';
                circle.style.cursor = 'pointer';
                circle.textContent = '×';
                circle.title = 'Delete connection';
                circle.style.fontSize = '20px';
                circle.style.width = '24px';
                circle.style.height = '24px';
                circle.style.lineHeight = '24px';
                circle.style.textAlign = 'center';

                circle.addEventListener('click', (event) => {
                    event.stopPropagation();
                    state.jsPlumbInstance?.detach(connection);
                    markDirty();
                });

                return circle;
            },
            location: 0.5,
            id: 'deleteCircle',
        },
    ]);
}
