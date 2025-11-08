// exporters.js
// Utilities for exporting the current workspace as image or PDF.

function ensureHtml2Canvas() {
    const instance = window.html2canvas;
    if (typeof instance !== 'function') {
        throw new Error('html2canvas is not available. Unable to export diagram.');
    }
    return instance;
}

function getWorkspaceElement() {
    const element = document.getElementById('canvas-container');
    if (!element) {
        throw new Error('Canvas container not found.');
    }
    return element;
}

async function captureWorkspaceCanvas() {
    const html2canvas = ensureHtml2Canvas();
    const workspace = getWorkspaceElement();
    const rect = workspace.getBoundingClientRect();
    const deviceScale = window.devicePixelRatio || 1;
    const scale = Math.max(2, deviceScale);

    return html2canvas(workspace, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale,
        width: rect.width,
        height: rect.height,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
        logging: false,
        useCORS: true,
    });
}

function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function getTimestampedFilename(extension) {
    const now = new Date();
    const timestamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        '-',
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    return `quickmap-${timestamp}.${extension}`;
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.92) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
            } else {
                reject(new Error('Unable to create image blob.'));
            }
        }, type, quality);
    });
}

function dataUrlToUint8Array(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const binary = atob(base64);
    const length = binary.length;
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function numberToPdf(value) {
    return Number.parseFloat(value.toFixed(2));
}

function createPdfFromImage({ imageBytes, imageWidthPx, imageHeightPx, cssWidth, cssHeight }) {
    const textEncoder = new TextEncoder();
    const chunks = [];
    let position = 0;

    const pushBytes = (bytes) => {
        chunks.push(bytes);
        position += bytes.length;
    };

    const pushString = (string) => {
        pushBytes(textEncoder.encode(string));
    };

    const offsets = [];
    const startObject = (index) => {
        offsets[index] = position;
        pushString(`${index} 0 obj\n`);
    };

    const endObject = () => {
        pushString('endobj\n');
    };

    const pdfWidth = numberToPdf((cssWidth * 72) / 96);
    const pdfHeight = numberToPdf((cssHeight * 72) / 96);

    const contentStream = `q\n${pdfWidth} 0 0 ${pdfHeight} 0 0 cm\n/Im1 Do\nQ\n`;
    const contentBytes = textEncoder.encode(contentStream);

    pushString('%PDF-1.4\n');

    startObject(1);
    pushString('<< /Type /Catalog /Pages 2 0 R >>\n');
    endObject();

    startObject(2);
    pushString('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n');
    endObject();

    startObject(3);
    pushString(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfWidth} ${pdfHeight}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> /ProcSet [/PDF /ImageC] >> >>\n`,
    );
    endObject();

    startObject(4);
    pushString(`<< /Length ${contentBytes.length} >>\nstream\n`);
    pushBytes(contentBytes);
    pushString('\nendstream\n');
    endObject();

    startObject(5);
    pushString(
        `<< /Type /XObject /Subtype /Image /Width ${imageWidthPx} /Height ${imageHeightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
    );
    pushBytes(imageBytes);
    pushString('\nendstream\n');
    endObject();

    const xrefStart = position;
    pushString('xref\n0 6\n');
    pushString('0000000000 65535 f \n');
    for (let i = 1; i <= 5; i += 1) {
        const offset = offsets[i] || 0;
        pushString(`${offset.toString().padStart(10, '0')} 00000 n \n`);
    }

    pushString('trailer\n');
    pushString('<< /Size 6 /Root 1 0 R >>\n');
    pushString('startxref\n');
    pushString(`${xrefStart}\n`);
    pushString('%%EOF');

    return new Blob(chunks, { type: 'application/pdf' });
}

export async function exportDiagramAsImage() {
    const workspace = getWorkspaceElement();
    const { width, height } = workspace.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
        throw new Error('Unable to determine workspace dimensions for export.');
    }
    const canvas = await captureWorkspaceCanvas();
    const blob = await canvasToBlob(canvas, 'image/png', 0.95);
    triggerDownload(blob, getTimestampedFilename('png'));
}

export async function exportDiagramAsPdf() {
    const workspace = getWorkspaceElement();
    const { width: cssWidth, height: cssHeight } = workspace.getBoundingClientRect();
    if (cssWidth <= 0 || cssHeight <= 0) {
        throw new Error('Unable to determine workspace dimensions for export.');
    }
    const canvas = await captureWorkspaceCanvas();
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const imageBytes = dataUrlToUint8Array(imageDataUrl);
    const pdfBlob = createPdfFromImage({
        imageBytes,
        imageWidthPx: canvas.width,
        imageHeightPx: canvas.height,
        cssWidth,
        cssHeight,
    });
    triggerDownload(pdfBlob, getTimestampedFilename('pdf'));
}
