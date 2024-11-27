// script.js

// ==================== Global Variables ====================

// Node management variables
let nodes = [];
let selectedNode = null;
let isDragging = false;
let isResizing = false;
let offsetX, offsetY;
let initialWidth, initialHeight, startX, startY;
let nodeIdCounter = 0;

// Canvas panning and zooming variables
let isPanning = false;
let panStartX, panStartY;
let panOffsetX = 0;
let panOffsetY = 0;
let scale = 1;
let isSpaceDown = false;

// jsPlumb instance
let jsPlumbInstance;

// ==================== Edge Mappings Constants and Function ====================

const EDGE_TYPE_PLAIN = "plain";
const EDGE_TYPE_DASHED = "dashed";

const PROPERTY_LINE_STYLE = "lineStyle";
const CLASS_DASHED_EDGE = "jtk-flowchart-dashed-edge";

// Edge mappings function
function edgeMappings() {
    return {
        [EDGE_TYPE_PLAIN]: {
            paintStyle: { stroke: '#007BFF', strokeWidth: 2 },
            connectorStyle: { stroke: '#007BFF', strokeWidth: 2 },
            cssClass: 'plain-connector',
        },
        [EDGE_TYPE_DASHED]: {
            paintStyle: { stroke: '#007BFF', strokeWidth: 2, dashstyle: '4 2' },
            connectorStyle: { stroke: '#007BFF', strokeWidth: 2, dashstyle: '4 2' },
            cssClass: 'dashed-connector',
        }
    };
}


// ==================== Main Execution ====================

// Wait for the DOM to load
document.addEventListener('DOMContentLoaded', () => {
    // Initialize global canvas container
    const canvasContainer = document.getElementById('canvas-container');
    window.canvasContainer = canvasContainer;

    // Initialize the app
    initializeJsPlumb();               // Initialize jsPlumb instance
    setupCanvasInteractions();         // Setup panning and zooming
    setupNodeInteractions();           // Setup node interactions
    loadNodesFromLocalStorage();       // Load nodes from localStorage

    // Load connections after nodes are fully loaded
    setTimeout(() => {
        loadConnectionsFromLocalStorage();
    }, 100);

    enableLineDeletion();              // Enable connection deletion

    // Attach the event listener to the "Clear" button
    const clearButton = document.getElementById('clear-btn');
    if (clearButton) {
        clearButton.addEventListener('click', clearCanvas);
    } else {
        console.warn("Clear button not found on the page.");
    }

    console.log("App initialized successfully.");
});

// ==================== Function Definitions ====================

/**
 * Initializes jsPlumb instance and sets global configuration.
 */
function initializeJsPlumb() {
    const mappings = edgeMappings(); // Get the edge mappings

    // Create jsPlumb instance
    jsPlumbInstance = jsPlumb.getInstance({
        Container: "canvas-container",
        Connector: ['Bezier', { curviness: 50 }],
        Endpoint: ['Dot', { radius: 5 }],
        PaintStyle: mappings[EDGE_TYPE_PLAIN].paintStyle, // Use the paint style from mappings
        EndpointStyle: { fill: '#007BFF' },
        ConnectionOverlays: [
            ['Arrow', { location: 1, width: 10, length: 10 }]
        ],
        ConnectionsDetachable: true, // Enable detaching connections
        ReattachConnections: true    // Allow reattaching to other endpoints
    });

    // Handle new connections
    jsPlumbInstance.bind('connection', function (info) {
        const connection = info.connection;

        // Store default metadata for the connection
        connection.data = {
            connectorParams: { curviness: 50 },
            lineStyle: EDGE_TYPE_PLAIN
        };

        // Add a circle overlay for deleting the connection
        connection.addOverlay([
            'Custom', {
                create: function () {
                    const circle = document.createElement('div');
                    circle.className = 'delete-circle';
                    circle.style.cursor = 'pointer';
                    circle.textContent = '×'; // Add text
                    circle.title = 'Delete connection'; // Tooltip
        
                    // Add click event to delete the connection
                    circle.addEventListener('click', function (e) {
                        e.stopPropagation(); // Prevent triggering other events
                        jsPlumbInstance.deleteConnection(connection);
                        saveConnectionsToLocalStorage();
                    });
        
                    return circle;
                },
                location: 0.5,
                id: 'deleteCircle'
            }
        ]);

        // Save connections to localStorage after creating a new connection
        saveConnectionsToLocalStorage();

        // Enable editing of the connection
        startEditingConnection(connection);
    });

    // Handle connection deletions
    jsPlumbInstance.bind('connectionDetached', function () {
        saveConnectionsToLocalStorage(); // Update local storage when a connection is removed
    });

    // Export jsPlumb instance globally
    window.jsPlumbInstance = jsPlumbInstance;
}


// ==================== Nodes ====================

/**
 * Adds a new node to the canvas at the specified position.
 * @param {number} x - The x-coordinate where the node should be placed.
 * @param {number} y - The y-coordinate where the node should be placed.
 * @param {string} content - The text content of the node (optional).
 * @param {string} width - The width of the node (optional).
 * @param {string} height - The height of the node (optional).
 * @param {string} id - The unique identifier for the node (optional).
 */
function addNode(x, y, content = '', width = '250px', height = '150px', id = null) {
    let node = document.createElement('div');
    node.className = 'node';
    node.style.left = `${x}px`;
    node.style.top = `${y}px`;
    node.style.width = width;
    node.style.height = height;
    node.id = id || `node-${nodeIdCounter++}`;

    // Create top bar with drag handle and delete button
    let topBar = document.createElement('div');
    topBar.className = 'node-top-bar';

    // Drag handle
    let dragHandle = document.createElement('span');
    dragHandle.className = 'node-drag-handle';
    dragHandle.textContent = 'Drag'; // Text for the drag handle

    // Delete button
    let deleteButton = document.createElement('span');
    deleteButton.className = 'node-delete-button';
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteNode(node);
    });

    // Add drag handle and delete button to top bar
    topBar.appendChild(dragHandle);
    topBar.appendChild(deleteButton);

    // Add top bar to node
    node.appendChild(topBar);

    // Add textarea for text content
    let textarea = document.createElement('textarea');
    textarea.placeholder = 'Enter text here';
    textarea.value = content;
    textarea.className = 'node-textarea';

    // Append textarea to the node
    node.appendChild(textarea);
    canvasContainer.appendChild(node);
    nodes.push(node);

    // Make node draggable and resizable
    makeNodeDraggable(node, dragHandle); // Pass dragHandle as the draggable area
    makeNodeResizable(node);

    // Add connection points for linking nodes
    addConnectionPoints(node);

    // Save nodes after adding
    saveNodesToLocalStorage();

    // Save content changes
    textarea.addEventListener('input', () => {
        saveNodesToLocalStorage();
    });
    
    // At the end of addNode function
    jsPlumbInstance.repaintEverything();
}

/**
 * Sets up node interactions like adding, dragging, and resizing nodes.
 */
function setupNodeInteractions() {
    // Right-click to add a new node
    canvasContainer.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        addNode((e.pageX - panOffsetX) / scale, (e.pageY - panOffsetY) / scale);
    });
}


/**
 * Enables dragging functionality for the specified node.
 * @param {HTMLElement} node - The node to make draggable.
 * @param {HTMLElement} handle - The handle element that initiates dragging.
 */
function makeNodeDraggable(node, handle) {
    let offsetX, offsetY;

    handle.addEventListener('mousedown', (e) => {
        if (node.isResizing) return; // Prevent dragging if resizing is in progress
        e.stopPropagation();
        node.isDragging = true;
        offsetX = e.offsetX;
        offsetY = e.offsetY;
        document.body.style.cursor = 'move';
    });

    document.addEventListener('mousemove', (e) => {
        if (node.isDragging) {
            let x = (e.pageX - offsetX - panOffsetX) / scale;
            let y = (e.pageY - offsetY - panOffsetY) / scale;
            node.style.left = `${x}px`;
            node.style.top = `${y}px`;
            jsPlumbInstance.repaintEverything();
        }
    });

    document.addEventListener('mouseup', () => {
        if (node.isDragging) {
            node.isDragging = false;
            document.body.style.cursor = 'default';
            saveNodesToLocalStorage();
        }
    });
}

/**
 * Enables precise resizing functionality for the specified node.
 * @param {HTMLElement} node - The node to make resizable.
 */
function makeNodeResizable(node) {
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'resize-handle';
    node.appendChild(resizeHandle);

    let startX, startY, initialWidth, initialHeight;

    resizeHandle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        node.isResizing = true;
        startX = e.clientX;
        startY = e.clientY;
        initialWidth = node.clientWidth;
        initialHeight = node.clientHeight;
        document.body.style.cursor = 'se-resize';

        // Disable dragging during resizing
        document.addEventListener('mousemove', resizeMouseMove);
        document.addEventListener('mouseup', stopResizing);
    });

    const resizeMouseMove = (e) => {
        if (node.isResizing) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            const newWidth = initialWidth + deltaX;
            const newHeight = initialHeight + deltaY;

            node.style.width = `${newWidth}px`;
            node.style.height = `${newHeight}px`;
            jsPlumbInstance.repaintEverything();
        }
    };

    const stopResizing = () => {
        if (node.isResizing) {
            node.isResizing = false;
            document.body.style.cursor = 'default';
            saveNodesToLocalStorage();

            document.removeEventListener('mousemove', resizeMouseMove);
            document.removeEventListener('mouseup', stopResizing);
        }
    };
}

/**
 * Deletes the specified node from the canvas and updates storage.
 * @param {HTMLElement} node - The node to delete.
 */
function deleteNode(node) {
    // Remove the node from jsPlumb using the node's ID
    jsPlumbInstance.remove(node.id);

    // Remove the node element from the canvas if it still exists
    if (canvasContainer.contains(node)) {
        canvasContainer.removeChild(node);
    }

    // Remove the node from the nodes array
    nodes = nodes.filter((n) => n !== node);

    // Save nodes after deletion
    saveNodesToLocalStorage();
}

/**
 * Saves the current nodes and connections to localStorage.
 */
function saveNodesToLocalStorage() {
    const nodeData = nodes.map((node) => {
        return {
            id: node.id,
            left: node.style.left,
            top: node.style.top,
            content: node.querySelector('textarea').value,
            width: node.style.width,
            height: node.style.height
        };
    });
    localStorage.setItem('nodes', JSON.stringify(nodeData));
    console.log('Nodes saved to localStorage.');
}

/**
 * Loads nodes and connections from localStorage and adds them to the canvas.
 */
function loadNodesFromLocalStorage() {
    const nodeData = JSON.parse(localStorage.getItem('nodes'));
    if (nodeData) {
        nodeData.forEach(data => {
            addNode(parseFloat(data.left), parseFloat(data.top), data.content, data.width, data.height, data.id);
        });
        console.log('Nodes loaded from localStorage:', nodeData);
    } else {
        console.log('No nodes found in localStorage.');
    }
}

// ==================== Connections ====================


/**
 * Allows editing of a connection's path and style by dragging its midpoint.
 * @param {Object} connection - The jsPlumb connection to edit.
 */
function startEditingConnection(connection) {
    const mappings = edgeMappings(); // Get the edge mappings
    const midpointOverlay = connection.getOverlay('midpoint');
    if (!midpointOverlay) return;

    const midpointElement = midpointOverlay.getElement();

    let isDraggingMidpoint = false;
    let startX, startY;

    const onMouseDown = (e) => {
        e.stopPropagation();
        isDraggingMidpoint = true;
        startX = e.clientX;
        startY = e.clientY;
        document.body.style.cursor = 'move';

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    const onMouseMove = (e) => {
        if (isDraggingMidpoint) {
            const deltaX = (e.clientX - startX) / scale;
            const deltaY = (e.clientY - startY) / scale;

            startX = e.clientX;
            startY = e.clientY;

            // Update the connection's parameters (e.g., adjust curviness)
            let connector = connection.getConnector();
            if (connector.type === 'Bezier') {
                // Adjust curviness based on vertical mouse movement
                let curviness = connection.data.connectorParams.curviness || 50;
                curviness += deltaY;

                // Limit curviness to reasonable values
                curviness = Math.max(-200, Math.min(200, curviness));

                // Update the connector with new curviness
                connection.setConnector(['Bezier', { curviness: curviness }]);

                // Store the updated curviness in connection data
                connection.data.connectorParams.curviness = curviness;
            }
        }
    };

    const onMouseUp = () => {
        if (isDraggingMidpoint) {
            isDraggingMidpoint = false;
            document.body.style.cursor = 'default';
    
            // Allow user to change line style
            const newLineStyle = prompt("Enter line style (plain/dashed):", connection.data.lineStyle || EDGE_TYPE_PLAIN);
            if (newLineStyle && mappings[newLineStyle]) {
                connection.setPaintStyle(mappings[newLineStyle].connectorStyle);
                connection.data.lineStyle = newLineStyle;
            }
    
            // Save the updated connections
            saveConnectionsToLocalStorage();
    
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    };

    midpointElement.addEventListener('mousedown', onMouseDown);
}

/**
 * Adds connection points to the node for creating links between nodes.
 * @param {HTMLElement} node - The node to add connection points to.
 */
function addConnectionPoints(node) {
    const connectionPositions = ['Top', 'Right', 'Bottom', 'Left'];
    const mappings = edgeMappings(); // Get the edge mappings

    connectionPositions.forEach(position => {
        const circle = document.createElement('div');
        circle.className = `connection-point ${position.toLowerCase()}`;
        node.appendChild(circle);

        // Add jsPlumb endpoint to the circle
        const endpoint = jsPlumbInstance.addEndpoint(node, {
            anchor: position,
            endpoint: 'Dot',
            isSource: true,
            isTarget: true,
            maxConnections: -1,
            allowReattach: true, // Enable reattaching connections
            connector: ['Bezier', { curviness: 50 }],
            connectorStyle: mappings[EDGE_TYPE_PLAIN].connectorStyle, // Use style from mappings
            connectorOverlays: [
                ['Arrow', { location: 1, width: 10, length: 10 }],
                ['Custom', {
                    create: function (component) {
                        let midpoint = document.createElement('div');
                        midpoint.className = 'midpoint';
                        return midpoint;
                    },
                    location: 0.5,
                    id: 'midpoint'
                }]
            ],
            cssClass: mappings[EDGE_TYPE_PLAIN].cssClass
        }, {
            cssClass: 'connection-point-endpoint',
            endpointStyle: { fill: '#007BFF' },
            parent: circle
        });


    });
}


/**
 * Enables deletion of connections on click.
 */
function enableLineDeletion() {
    jsPlumbInstance.bind('click', function (connection) {
        if (confirm('Do you want to delete this connection?')) {
            jsPlumbInstance.deleteConnection(connection);
            saveConnectionsToLocalStorage();
        }
    });
}

/**
 * Saves the current connections to localStorage.
 */
function saveConnectionsToLocalStorage() {
    const connections = jsPlumbInstance.getAllConnections().map(connection => {
        return {
            sourceId: connection.sourceId,
            targetId: connection.targetId,
            anchors: [
                connection.endpoints[0].anchor.type,
                connection.endpoints[1].anchor.type
            ],
            connectorType: connection.getConnector().type,
            connectorParams: connection.data?.connectorParams || {},
            lineStyle: connection.data?.lineStyle || EDGE_TYPE_PLAIN
        };
    });

    localStorage.setItem('connections', JSON.stringify(connections));
    console.log('Connections saved to localStorage:', connections);
}

/**
 * Loads connections from localStorage and adds them to the canvas.
 */
function loadConnectionsFromLocalStorage() {
    const savedConnections = JSON.parse(localStorage.getItem('connections'));
    if (savedConnections && Array.isArray(savedConnections)) {
        savedConnections.forEach((conn) => {
            // Create a new connection
            const newConnection = jsPlumbInstance.connect({
                source: conn.sourceId,
                target: conn.targetId,
                anchors: conn.anchors,
                connector: [conn.connectorType || 'Bezier', conn.connectorParams || { curviness: 50 }],
                paintStyle: edgeMappings()[conn.lineStyle || EDGE_TYPE_PLAIN].connectorStyle,
                overlays: [
                    ['Arrow', { location: 1, width: 10, length: 10 }],
                    ['Custom', {
                        create: function () {
                            const circle = document.createElement('div');
                            circle.className = 'delete-circle';
                            circle.style.cursor = 'pointer';
                            circle.textContent = '×'; // Add an '×' symbol or 'Delete' text
                            circle.title = 'Delete connection'; // Tooltip on hover

                            // Add click event to delete the connection
                            circle.addEventListener('click', function () {
                                jsPlumbInstance.deleteConnection(newConnection);
                                saveConnectionsToLocalStorage();
                            });

                            return circle;
                        },
                        location: 0.5,
                        id: 'deleteCircle'
                    }]
                ]
            });

            // Restore metadata to the connection
            newConnection.data = {
                connectorParams: conn.connectorParams,
                lineStyle: conn.lineStyle || EDGE_TYPE_PLAIN
            };

            // Enable editing of the connection
            startEditingConnection(newConnection);
        });

        console.log('Connections loaded from localStorage:', savedConnections);
    } else {
        console.log('No connections found in localStorage.');
    }
}


// ==================== Canvas ====================


/**
 * Sets up canvas interactions like panning and zooming.
 */
function setupCanvasInteractions() {
    // Event listeners for space bar to enable panning
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            isSpaceDown = true;
            document.body.style.cursor = 'grab';
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            isSpaceDown = false;
            document.body.style.cursor = 'default';
        }
    });

    // Panning canvas when space bar is held down
    canvasContainer.addEventListener('mousedown', (e) => {
        if (isSpaceDown) {
            isPanning = true;
            panStartX = e.pageX;
            panStartY = e.pageY;
            document.body.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    // Mouse move for panning
    document.addEventListener('mousemove', (e) => {
        if (isPanning) {
            panOffsetX += e.pageX - panStartX;
            panOffsetY += e.pageY - panStartY;
            panStartX = e.pageX;
            panStartY = e.pageY;
            updateCanvasTransform();
            if (jsPlumbInstance) {
                jsPlumbInstance.repaintEverything();
            }
        }
    });

    // Mouse up to stop panning
    document.addEventListener('mouseup', () => {
        if (isPanning) {
            isPanning = false;
            document.body.style.cursor = 'default';
        }
    });

    // Zooming with mouse wheel
    canvasContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const zoomFactor = 0.1;
        const oldScale = scale;
        if (e.deltaY < 0) {
            scale += zoomFactor;
        } else {
            scale = Math.max(0.1, scale - zoomFactor);
        }

        // Adjust pan offsets to zoom towards cursor
        const rect = canvasContainer.getBoundingClientRect();
        const dx = (e.pageX - rect.left - panOffsetX) / oldScale;
        const dy = (e.pageY - rect.top - panOffsetY) / oldScale;

        panOffsetX -= dx * (scale - oldScale);
        panOffsetY -= dy * (scale - oldScale);

        updateCanvasTransform();
        if (jsPlumbInstance) {
            jsPlumbInstance.setZoom(scale);
        }
    });
}

/**
 * Updates the canvas transformation based on pan and zoom.
 */
function updateCanvasTransform() {
    canvasContainer.style.transform = `translate(${panOffsetX}px, ${panOffsetY}px) scale(${scale})`;
    canvasContainer.style.transformOrigin = '0 0';
    canvasContainer.style.backgroundSize = `${20 * scale}px ${20 * scale}px`;
}


/**
 * Clears all nodes, connections, and relevant localStorage data.
 */
function clearCanvas() {
    // Clear all connections and endpoints
    jsPlumbInstance.deleteEveryEndpoint();

    // Clear all nodes from the DOM
    nodes.forEach((node) => {
        canvasContainer.removeChild(node);
    });
    nodes = [];

    // Clear relevant localStorage data
    localStorage.removeItem('nodes');
    localStorage.removeItem('connections');

    // Repaint canvas
    jsPlumbInstance.repaintEverything();

    console.log('Canvas and localStorage cleared.');
}