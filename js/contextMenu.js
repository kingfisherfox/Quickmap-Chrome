// contextMenu.js
// Provides a custom right-click menu for canvas interactions.

import { state } from './state.js';
import { addNode, deleteNode } from './nodes.js';
import { copyNodes, pasteClipboard, hasClipboardContent } from './clipboard.js';
import { getSelectedNodes, setSelectedNodes, isNodeSelected } from './selection.js';
import {
    selectConnection,
    clearConnectionSelection,
    getSelectedConnections,
    deleteSelectedConnections,
} from './connections.js';
import { exportDiagramAsImage, exportDiagramAsPdf } from './exporters.js';

const MENU_ID = 'quickmap-context-menu';
const ACTION_SELECTOR = '[data-menu-action]';

let menuElement = null;
let currentContext = null;
let isInitialized = false;

function ensureMenuElement() {
    if (menuElement) return menuElement;

    const menu = document.createElement('div');
    menu.id = MENU_ID;
    menu.className = 'context-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-hidden', 'true');

    const actions = [
        { id: 'create', label: 'Create node', shortcut: 'Enter' },
        { id: 'copy', label: 'Copy', shortcut: '⌘/Ctrl+C' },
        { id: 'paste', label: 'Paste', shortcut: '⌘/Ctrl+V' },
        { id: 'delete', label: 'Delete', shortcut: '⌫' },
        { id: 'image', label: 'Export as image', shortcut: '' },
        { id: 'pdf', label: 'Export as PDF', shortcut: '' },
    ];

    actions.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'context-menu-item';
        button.dataset.menuAction = action.id;
        button.setAttribute('role', 'menuitem');
        button.textContent = action.label;
        if (action.shortcut) {
            const hint = document.createElement('span');
            hint.className = 'context-menu-shortcut';
            hint.textContent = action.shortcut;
            button.appendChild(hint);
        }
        menu.appendChild(button);
    });

    document.body.appendChild(menu);
    menuElement = menu;
    return menuElement;
}

function getCanvasCoordinates(pageX, pageY) {
    const scale = state.scale || 1;
    return {
        x: (pageX - state.panOffsetX) / scale,
        y: (pageY - state.panOffsetY) / scale,
    };
}

function updateMenuState() {
    if (!menuElement) return;

    const copyButton = menuElement.querySelector('[data-menu-action="copy"]');
    const pasteButton = menuElement.querySelector('[data-menu-action="paste"]');
    const deleteButton = menuElement.querySelector('[data-menu-action="delete"]');
    const imageButton = menuElement.querySelector('[data-menu-action="image"]');
    const pdfButton = menuElement.querySelector('[data-menu-action="pdf"]');

    const nodeSelectionCount = getSelectedNodes().length;
    const connectionSelectionCount = getSelectedConnections().length;
    const hasTargetNode = Boolean(currentContext?.targetNode);
    const hasTargetConnection = Boolean(currentContext?.targetConnectionId);

    const canCopy = nodeSelectionCount > 0 || hasTargetNode;
    const canPaste = hasClipboardContent();
    const canDelete = nodeSelectionCount > 0
        || connectionSelectionCount > 0
        || hasTargetNode
        || hasTargetConnection;

    if (copyButton) {
        copyButton.disabled = !canCopy;
        copyButton.setAttribute('aria-disabled', String(!canCopy));
    }

    if (pasteButton) {
        pasteButton.disabled = !canPaste;
        pasteButton.setAttribute('aria-disabled', String(!canPaste));
    }

    if (deleteButton) {
        deleteButton.disabled = !canDelete;
        deleteButton.setAttribute('aria-disabled', String(!canDelete));
    }

    if (imageButton) {
        imageButton.disabled = false;
        imageButton.setAttribute('aria-disabled', 'false');
    }

    if (pdfButton) {
        pdfButton.disabled = false;
        pdfButton.setAttribute('aria-disabled', 'false');
    }
}

function closeMenu() {
    if (!menuElement) return;
    if (!menuElement.classList.contains('open')) return;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && menuElement.contains(activeElement)) {
        activeElement.blur();
    }

    menuElement.classList.remove('open');
    menuElement.setAttribute('aria-hidden', 'true');
    menuElement.style.left = '';
    menuElement.style.top = '';
    currentContext = null;
}

function positionMenu(pageX, pageY) {
    if (!menuElement) return;

    const padding = 8;
    menuElement.style.visibility = 'hidden';
    menuElement.style.left = `${pageX}px`;
    menuElement.style.top = `${pageY}px`;
    menuElement.classList.add('open');
    menuElement.setAttribute('aria-hidden', 'false');

    const rect = menuElement.getBoundingClientRect();
    let adjustedLeft = pageX;
    let adjustedTop = pageY;

    if (rect.right + padding > window.innerWidth) {
        adjustedLeft = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (rect.bottom + padding > window.innerHeight) {
        adjustedTop = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    menuElement.style.left = `${adjustedLeft}px`;
    menuElement.style.top = `${adjustedTop}px`;
    menuElement.style.visibility = '';
}

async function handleMenuAction(actionId) {
    if (!currentContext) return;

    const contextSnapshot = { ...currentContext };

    try {
        switch (actionId) {
            case 'create': {
                const node = addNode(contextSnapshot.canvasX, contextSnapshot.canvasY);
                if (node) {
                    clearConnectionSelection();
                    setSelectedNodes([node]);
                }
                break;
            }
            case 'copy': {
                copyNodes({ targetNode: contextSnapshot.targetNode });
                break;
            }
            case 'paste': {
                pasteClipboard(contextSnapshot.canvasX, contextSnapshot.canvasY);
                break;
            }
            case 'delete': {
                deleteSelectionForContext();
                break;
            }
            case 'image': {
                closeMenu();
                await exportDiagramAsImage();
                return;
            }
            case 'pdf': {
                closeMenu();
                await exportDiagramAsPdf();
                return;
            }
            default:
                break;
        }
    } finally {
        closeMenu();
    }
}

function handleContextMenu(event) {
    const container = state.canvasContainer;
    if (!container || !container.contains(event.target)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    ensureMenuElement();

    const target = event.target;
    const connectionPath = target?.closest?.('.connection-path');
    const connectionId = connectionPath?.dataset?.connectionId;
    let targetConnectionId = null;

    let targetNode = target instanceof HTMLElement ? target.closest('.node') : null;

    if (connectionId) {
        targetConnectionId = connectionId;
        selectConnection(connectionId, { append: event.shiftKey });
        targetNode = null;
    } else if (targetNode) {
        if (event.shiftKey) {
            if (!isNodeSelected(targetNode)) {
                const combined = [...new Set([...getSelectedNodes(), targetNode])];
                setSelectedNodes(combined);
            }
        } else {
            clearConnectionSelection();
            setSelectedNodes([targetNode]);
        }
    }

    const { x, y } = getCanvasCoordinates(event.pageX, event.pageY);
    currentContext = {
        pageX: event.pageX,
        pageY: event.pageY,
        canvasX: x,
        canvasY: y,
        targetNode,
        targetConnectionId,
    };

    state.lastPointerX = event.pageX;
    state.lastPointerY = event.pageY;

    updateMenuState();
    positionMenu(event.pageX, event.pageY);
}

function handlePointerDown(event) {
    if (!menuElement || !menuElement.classList.contains('open')) return;
    if (event.target instanceof Node && menuElement.contains(event.target)) {
        return;
    }
    closeMenu();
}

function handleMenuClick(event) {
    const target = event.target instanceof HTMLElement ? event.target.closest(ACTION_SELECTOR) : null;
    if (!target) return;
    const actionId = target.dataset.menuAction;
    if (!actionId || target.disabled) return;
    const label = target.textContent?.replace(/\s+/g, ' ').trim() || actionId;
    Promise.resolve(handleMenuAction(actionId)).catch((error) => {
        console.error(`Context menu action "${actionId}" failed`, error);
        alert(`Unable to complete "${label}" action. Please try again.`);
    });
}

function isEditableTarget(element) {
    if (!element || !(element instanceof HTMLElement)) return false;
    if (element.isContentEditable) return true;
    const tag = element.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function getCanvasCoordinatesFromPage(pageX, pageY) {
    return getCanvasCoordinates(pageX, pageY);
}

function deleteNodesForContext(preferredNode = null) {
    const selected = getSelectedNodes();
    const nodesToDelete = selected.length
        ? selected
        : (preferredNode ? [preferredNode] : []);
    const uniqueNodes = Array.from(new Set(nodesToDelete));
    if (!uniqueNodes.length) return false;
    uniqueNodes.forEach((node) => deleteNode(node));
    return true;
}

function deleteSelectionForContext() {
    const preferredNode = currentContext?.targetNode || null;
    const preferredConnectionId = currentContext?.targetConnectionId || null;
    let deleted = deleteNodesForContext(preferredNode);

    const selectedConnections = getSelectedConnections();
    if (selectedConnections.length) {
        deleteSelectedConnections();
        deleted = true;
    } else if (preferredConnectionId) {
        selectConnection(preferredConnectionId);
        if (getSelectedConnections().length) {
            deleteSelectedConnections();
            deleted = true;
        }
    }

    return deleted;
}

function handleGlobalKeyDown(event) {
    if (event.key === 'Escape') {
        closeMenu();
        return;
    }

    const activeElement = document.activeElement;
    if (isEditableTarget(activeElement)) {
        return;
    }

    const isModKey = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (isModKey && key === 'c') {
        if (copyNodes()) {
            event.preventDefault();
        }
        return;
    }

    if (isModKey && key === 'v') {
        if (hasClipboardContent()) {
            const { x, y } = getCanvasCoordinatesFromPage(state.lastPointerX, state.lastPointerY);
            if (pasteClipboard(x, y)) {
                event.preventDefault();
            }
        }
        return;
    }

    if (!isModKey && (event.key === 'Delete' || event.key === 'Backspace')) {
        if (deleteSelectionForContext()) {
            event.preventDefault();
        }
    }
}

export function initializeContextMenu() {
    if (isInitialized) return;
    if (!state.canvasContainer) {
        console.warn('Canvas container not available for context menu initialization.');
        return;
    }

    ensureMenuElement();
    state.canvasContainer.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('scroll', closeMenu, true);
    window.addEventListener('blur', closeMenu);
    window.addEventListener('resize', closeMenu);
    document.addEventListener('keydown', handleGlobalKeyDown);
    menuElement?.addEventListener('click', handleMenuClick);
    menuElement?.addEventListener('contextmenu', (event) => event.preventDefault());

    isInitialized = true;
}
