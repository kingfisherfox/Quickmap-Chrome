# QuickMap

QuickMap is a Chrome extension for sketching lightweight flowcharts and mind maps. Create draggable nodes, wire them together with snap-to-handle connectors, and save multiple charts locally while you explore ideas.

## Features
- **Contextual node creation** – right-click on the canvas to drop a new text node at the pointer; paste images to spawn image nodes.
- **Drag, resize, and pan** – move nodes with the top drag bar, resize from the bottom-right grip, pan the canvas by holding `Space` while dragging, and zoom with the mouse wheel.
- **Smart connectors** – grab any handle to draw a Bézier connector that stays attached as you move or zoom, with optional animated/dashed styling.
- **Chart management** – name, save, load, delete, and duplicate charts from the toolbar; data is persisted in the browser’s local storage.
- **Connection settings** – open the ⚙️ drawer to toggle animated connectors across the canvas.

## Install (Developer Mode)
1. **Clone the repository**
   ```bash
   git clone https://github.com/<your-account>/quickmap.git
   cd quickmap
   ```
2. **Load the unpacked extension in Chrome**
   - Open `chrome://extensions/`.
   - Enable **Developer mode** (toggle in the top-right corner).
   - Click **Load unpacked** and select the cloned `quickmap` folder.
3. The extension icon (blue map pin) now appears in your toolbar. Click it to open the QuickMap workspace in a new tab.

Whenever you edit the source files, return to `chrome://extensions/` and press **Reload** on QuickMap before opening a new session.

## Usage Tips
- Right-click anywhere on the grid to insert a node; double-click the text area to edit content.
- Use the circular handles on each node edge to draw connectors. Release over another handle to attach; press the × badge mid-connection to delete.
- Hold `Space` and drag to navigate, or use the mouse wheel to zoom in/out; connectors automatically stay aligned with their handles.
- The header bar lets you name charts, save them, switch between saved charts, or clear the canvas.
- Clicking the gear button reveals connection settings such as animation.

## Project Structure
- `index.html` – main workspace UI loaded when the extension icon is clicked.
- `css/styles.css` – layout, node styling, and connection visuals.
- `js/` – modular JavaScript:
  - `nodes.js`, `connections.js`, `canvas.js` handle canvas interactions.
  - `charts.js` manages saving/loading charts.
  - `settings.js` controls the settings drawer.
  - `background.js` opens the workspace tab when the action button is pressed.
- `manifest.json` – Chrome extension manifest (Manifest V3).

## Development Notes
- No build step is required; edit the files directly and reload the extension in Chrome.
- Charts are stored via `localStorage`; clearing browser storage or using an incognito profile will remove saved charts.
- To package for distribution, zip the project (excluding local artifacts) and upload `manifest.json` to the Chrome Web Store dashboard.

Enjoy mapping your ideas with QuickMap!
