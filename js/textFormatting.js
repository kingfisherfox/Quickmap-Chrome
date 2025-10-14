// textFormatting.js

import { markDirty } from './state.js';
import { handleNodeLayoutChange } from './connections.js';

let toolbarElement = null;
let activeEditable = null;
let hideTimer = null;

const FORMATTING_OPTIONS = [
    { label: 'H1', command: 'formatBlock', value: '<h1>', title: 'Heading 1' },
    { label: 'H2', command: 'formatBlock', value: '<h2>', title: 'Heading 2' },
    { label: 'H3', command: 'formatBlock', value: '<h3>', title: 'Heading 3' },
    { label: 'H4', command: 'formatBlock', value: '<h4>', title: 'Heading 4' },
    { type: 'separator' },
    { label: 'B', command: 'bold', title: 'Bold' },
    { label: 'I', command: 'italic', title: 'Italic' },
    { label: 'U', command: 'underline', title: 'Underline' },
    { type: 'separator' },
    { label: 'L', command: 'justifyLeft', title: 'Align Left' },
    { label: 'C', command: 'justifyCenter', title: 'Align Center' },
    { label: 'R', command: 'justifyRight', title: 'Align Right' },
    { type: 'separator' },
    { label: 'HR', command: 'insertHorizontalRule', title: 'Insert Divider' },
    { type: 'separator' },
    { label: '>>', command: 'indent', title: 'Increase Indent' },
    { label: '<<', command: 'outdent', title: 'Decrease Indent' },
];

function createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'text-formatting-toolbar';
    toolbar.setAttribute('role', 'toolbar');
    FORMATTING_OPTIONS.forEach((option) => {
        if (option.type === 'separator') {
            const separator = document.createElement('div');
            separator.className = 'toolbar-separator';
            toolbar.appendChild(separator);
            return;
        }

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'toolbar-button';
        button.textContent = option.label;
        button.dataset.command = option.command;
        if (option.value) {
            button.dataset.value = option.value;
        }
        if (option.title) {
            button.title = option.title;
            button.setAttribute('aria-label', option.title);
        }

        button.addEventListener('mousedown', (event) => {
            // Preserve the current selection inside the editable region.
            event.preventDefault();
        });

        button.addEventListener('click', () => {
            if (!activeEditable) return;
            activeEditable.focus({ preventScroll: true });
            const { command } = option;
            const value = option.value || null;
            document.execCommand(command, false, value);
            markDirty();
            positionToolbar(activeEditable);
            handleNodeLayoutChange();
        });

        toolbar.appendChild(button);
    });

    toolbar.addEventListener('mouseenter', () => {
        clearTimeout(hideTimer);
    });

    toolbar.addEventListener('mouseleave', () => {
        scheduleHide();
    });

    return toolbar;
}

function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
        toolbarElement?.classList.add('hidden');
        activeEditable = null;
    }, 200);
}

function positionToolbar(editable) {
    if (!toolbarElement) return;
    const rect = editable.getBoundingClientRect();
    const toolbarRect = toolbarElement.getBoundingClientRect();
    const top = Math.max(window.scrollY + rect.top - toolbarRect.height - 8, 8);
    let left = window.scrollX + rect.left + (rect.width / 2) - (toolbarRect.width / 2);

    const maxLeft = window.scrollX + document.documentElement.clientWidth - toolbarRect.width - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    toolbarElement.style.top = `${top}px`;
    toolbarElement.style.left = `${left}px`;
}

function showToolbar(editable) {
    if (!toolbarElement) return;
    activeEditable = editable;
    toolbarElement.classList.remove('hidden');
    positionToolbar(editable);
}

export function initializeTextFormatting() {
    if (toolbarElement) return;
    toolbarElement = createToolbar();
    toolbarElement.classList.add('hidden');
    document.body.appendChild(toolbarElement);

    document.addEventListener('focusin', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.classList.contains('node-textarea')) {
            clearTimeout(hideTimer);
            showToolbar(target);
        }
    });

    document.addEventListener('input', (event) => {
        if (!(event.target instanceof HTMLElement)) return;
        if (event.target.classList.contains('node-textarea')) {
            showToolbar(event.target);
        }
    });

    document.addEventListener('selectionchange', () => {
        const selection = document.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const anchorNode = selection.anchorNode;
        if (!anchorNode) return;

        const element = anchorNode.nodeType === Node.ELEMENT_NODE
            ? anchorNode
            : anchorNode.parentElement;
        const editable = element?.closest?.('.node-textarea') || null;

        if (editable) {
            clearTimeout(hideTimer);
            showToolbar(editable);
        } else if (activeEditable) {
            scheduleHide();
        }
    });

    document.addEventListener('focusout', (event) => {
        const target = event.target;
        if (target instanceof HTMLElement && target.classList.contains('node-textarea')) {
            scheduleHide();
        }
    });

    document.addEventListener('mousedown', (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (toolbarElement?.contains(target) || (target instanceof HTMLElement && target.classList.contains('node-textarea'))) {
            clearTimeout(hideTimer);
        } else if (activeEditable) {
            scheduleHide();
        }
    });
}
