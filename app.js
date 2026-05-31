// Global App Core Variables
let canvas;
let canvasScale = 1;
let historyUndoStack = [];
let historyRedoStack = [];
let isStateSavingBlocked = false;

// Initialize System on load
window.addEventListener('DOMContentLoaded', () => {
    initCanvas();
    setupEventListeners();
    saveState(); // Trigger initial template fallback state
});

// 1. INITIALIZE CANVAS & SETTINGS
function initCanvas() {
    canvas = new fabric.Canvas('mainPixelCanvas', {
        width: 700,
        height: 700,
        backgroundColor: '#111827',
        preserveObjectStacking: true
    });
    
    // Config default control styles (PixelLab UI Look)
    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: '#22d3ee',
        borderColor: '#22d3ee',
        cornerSize: 8,
        cornerStyle: 'circle',
        borderDashArray: [3, 3]
    });

    // Native Context Observers
    canvas.on('object:modified', () => saveState());
    canvas.on('object:added', () => updateLayerPanel());
    canvas.on('object:removed', () => updateLayerPanel());
    canvas.on('selection:created', () => syncSelectedObjectToUI());
    canvas.on('selection:updated', () => syncSelectedObjectToUI());
}

// 2. TAB CONTROLLER SWITCHER
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400');
        el.classList.add('text-gray-400');
    });
    
    document.getElementById(tabId).classList.remove('hidden');
    document.getElementById('btn-' + tabId).classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400');
}

// 3. TEXT EDITING ENGINE FEATURES
document.getElementById('addText').addEventListener('click', () => {
    const textObj = new fabric.IText('Double Click to Edit', {
        left: 100,
        top: 150,
        fontFamily: 'Poppins',
        fontSize: 45,
        fill: '#ffffff',
        textAlign: 'center'
    });
    canvas.add(textObj);
    canvas.setActiveObject(textObj);
    canvas.renderAll();
});

// Dynamic Sync Fields to Object UI values
function syncSelectedObjectToUI() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.type === 'i-text' || activeObj.type === 'text') {
        document.getElementById('textString').value = activeObj.text || '';
        document.getElementById('textSize').value = activeObj.fontSize;
        document.getElementById('v-size').innerText = activeObj.fontSize;
        document.getElementById('textRotation').value = activeObj.angle || 0;
        document.getElementById('v-rot').innerText = Math.round(activeObj.angle || 0) + '°';
        document.getElementById('textOpacity').value = (activeObj.opacity || 1) * 100;
        document.getElementById('v-opac').innerText = Math.round((activeObj.opacity || 1) * 100);
        document.getElementById('fontFamily').value = activeObj.fontFamily;
    }
}

// Text Mutations Hooks
document.getElementById('textString').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    if (activeObj && activeObj.isType('text-like')) {
        activeObj.set('text', e.target.value);
        canvas.renderAll();
    }
});

document.getElementById('textSize').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    document.getElementById('v-size').innerText = e.target.value;
    if (activeObj) { activeObj.set('fontSize', parseInt(e.target.value)); canvas.renderAll(); }
});

document.getElementById('textRotation').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    document.getElementById('v-rot').innerText = e.target.value + '°';
    if (activeObj) { activeObj.set('angle', parseInt(e.target.value)); canvas.renderAll(); }
});

document.getElementById('textOpacity').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    document.getElementById('v-opac').innerText = e.target.value;
    if (activeObj) { activeObj.set('opacity', parseFloat(e.target.value / 100)); canvas.renderAll(); }
});

document.getElementById('fontFamily').addEventListener('change', (e) => {
    let activeObj = canvas.getActiveObject();
    if (activeObj) { activeObj.set('fontFamily', e.target.value); canvas.renderAll(); }
});

// Color, Gradient & Texture Switcher Matrix
document.getElementById('textColor').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    if (!activeObj) return;
    
    let type = document.querySelector('none:checked')?.value || 'solid';
    // Handle Solid
    activeObj.set('fill', e.target.value);
    canvas.renderAll();
});

// Custom TTF/OTF Font Injection Feature
document.getElementById('customFont').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        const fontData = evt.target.result;
        const fontName = 'CustomFont_' + Date.now();
        const newStyle = document.createElement('style');
        newStyle.appendChild(document.createTextNode(`
            @font-face {
                font-family: '${fontName}';
                src: url(${fontData});
            }
        `));
        document.head.appendChild(newStyle);
        
        let activeObj = canvas.getActiveObject();
        if(activeObj) {
            activeObj.set('fontFamily', fontName);
            canvas.renderAll();
        }
    };
    reader.readAsDataURL(file);
});

// Curved Text Simulation Engine (Warp / Curve Filter)
document.getElementById('textCurve').addEventListener('input', (e) => {
    let activeObj = canvas.getActiveObject();
    document.getElementById('v-curve').innerText = e.target.value;
    // Basic warp math simulation logic via scaling/skewing vectors
    if (activeObj && activeObj.isType('text-like')) {
        let val = parseInt(e.target.value);
        activeObj.set('skewX', val / 4);
        canvas.renderAll();
    }
});

// 4. IMAGE, SHAPES & STICKER UTILITIES
document.getElementById('imageLoader').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(f) {
        fabric.Image.fromURL(f.target.result, (img) => {
            img.scaleToWidth(250);
            canvas.add(img);
            canvas.centerObject(img);
            canvas.setActiveObject(img);
            canvas.renderAll();
        });
    };
    reader.readAsDataURL(file);
});

document.getElementById('stickerLoader').addEventListener('change', (e) => {
    if (!e.target.value) return;
    const emoText = new fabric.Text(e.target.value, { fontSize: 60, left: 200, top: 200 });
    canvas.add(emoText);
    canvas.renderAll();
    e.target.value = ""; // flush reset
});

function addShape(shapeType) {
    let shape;
    const commonProps = { left: 150, top: 150, fill: '#00ffff', width: 100, height: 100, strokeWidth: 2, stroke: '#ffffff' };
    
    if (shapeType === 'rect') shape = new fabric.Rect(commonProps);
    else if (shapeType === 'circle') shape = new fabric.Circle({ ...commonProps, radius: 50 });
    else if (shapeType === 'triangle') shape = new fabric.Triangle(commonProps);
    else if (shapeType === 'line') shape = new fabric.Line([50, 50, 200, 50], { stroke: '#00ffff', strokeWidth: 5 });
    else {
        // Fallback Vector Polygon for complex shapes (Stars/Arrows)
        shape = new fabric.Polygon([
            {x: 0, y: 0}, {x: 20, y: 0}, {x: 30, y: -20}, {x: 40, y: 0}, {x: 60, y: 0}, {x: 45, y: 15}, {x: 50, y: 35}, {x: 30, y: 25}, {x: 10, y: 35}, {x: 15, y: 15}
        ], commonProps);
    }
    canvas.add(shape);
    canvas.setActiveObject(shape);
    canvas.renderAll();
}

// Image Matrix Filter Engine
document.getElementById('imgFilter').addEventListener('change', (e) => {
    let activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.type !== 'image') return;

    activeObj.filters = []; // Wipe filter track
    const filterVal = e.target.value;

    if (filterVal === 'grayscale') activeObj.filters.push(new fabric.Image.filters.Grayscale());
    if (filterVal === 'sepia') activeObj.filters.push(new fabric.Image.filters.Sepia());
    if (filterVal === 'invert') activeObj.filters.push(new fabric.Image.filters.Invert());
    if (filterVal === 'blur') activeObj.filters.push(new fabric.Image.filters.Blur({ blur: 0.5 }));
    
    activeObj.applyFilters();
    canvas.renderAll();
});

// Freehand Drawing Tool Trigger
let penMode = false;
document.getElementById('freehandDraw').addEventListener('click', () => {
    penMode = !penMode;
    canvas.isDrawingMode = penMode;
    canvas.freeDrawingBrush.width = 5;
    canvas.freeDrawingBrush.color = '#ff5722';
    document.getElementById('freehandDraw').classList.toggle('bg-orange-700');
    document.getElementById('freehandDraw').classList.toggle('bg-green-600');
});

// Flip Processing Layer
document.getElementById('flipXBtn').addEventListener('click', () => {
    let activeObj = canvas.getActiveObject();
    if (activeObj) {
        activeObj.set('flipX', !activeObj.get('flipX'));
        canvas.renderAll();
    }
});

// 5. TEXT FX MANAGEMENT ENGINE (Shadows, Stroke, Reflection)
document.getElementById('fxStroke').addEventListener('change', (e) => {
    let activeObj = canvas.getActiveObject();
    if (activeObj) {
        activeObj.set('stroke', e.target.checked ? '#ff0000' : null);
        activeObj.set('strokeWidth', e.target.checked ? 3 : 0);
        canvas.renderAll();
    }
});
document.getElementById('fxShadow').addEventListener('change', (e) => {
    let activeObj = canvas.getActiveObject();
    if (activeObj) {
        activeObj.set('shadow', e.target.checked ? new fabric.Shadow({ color: 'rgba(0,0,0,0.8)', blur: 15, offsetX: 7, offsetY: 7 }) : null);
        canvas.renderAll();
    }
});

// 6. DYNAMIC CANVAS BACKGROUND MANAGER
document.getElementsByName('bgType').forEach(radio => {
    radio.addEventListener('change', (e) => {
        let mode = e.target.value;
        if (mode === 'solid') {
            canvas.setBackgroundImage(null);
            canvas.setBackgroundColor(document.getElementById('bgColorInput').value, canvas.renderAll.bind(canvas));
        } else if (mode === 'transparent') {
            canvas.setBackgroundImage(null);
            canvas.setBackgroundColor(null, canvas.renderAll.bind(canvas));
        }
    });
});
document.getElementById('bgColorInput').addEventListener('input', (e) => {
    canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
});

// 7. LAYER MANAGEMENT OPERATIONS
function updateLayerPanel() {
    const container = document.getElementById('layerListContainer');
    const objects = canvas.getObjects();
    document.getElementById('layerCount').innerText = `${objects.length} Layers`;

    if (objects.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-10 italic">No layers present.</p>`;
        return;
    }

    container.innerHTML = '';
    // Reverse listing order for traditional layered UI layouts (Topmost on Top)
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        let name = obj.type.toUpperCase() + ` [${i}]`;
        if (obj.text) name = `"${obj.text.substring(0,12)}"`;

        let activeClass = canvas.getActiveObject() === obj ? 'border-cyan-500 bg-gray-700' : 'border-gray-700 bg-gray-900';

        let div = document.createElement('div');
        div.className = `p-2 border rounded flex justify-between items-center ${activeClass} cursor-pointer hover:bg-gray-750`;
        div.innerHTML = `
            <span class="truncate pr-2 font-mono">${name}</span>
            <div class="flex space-x-2 text-[11px]">
                <button onclick="toggleObjectVis(${i})" title="Hide/Show">${obj.visible ? '👁️' : '❌'}</button>
            </div>
        `;
        div.addEventListener('click', (e) => {
            canvas.setActiveObject(objects[i]);
            canvas.renderAll();
            updateLayerPanel();
        });
        container.appendChild(div);
    }
}
function toggleObjectVis(index) {
    let obj = canvas.getObjects()[index];
    if(obj) { obj.visible = !obj.visible; canvas.renderAll(); updateLayerPanel(); }
}

// Bind Layer Ops Actions Stack
document.getElementById('layerUp').addEventListener('click', () => {
    let activeObj = canvas.getActiveObject();
    if(activeObj) { canvas.bringForward(activeObj); canvas.renderAll(); updateLayerPanel(); }
});
document.getElementById('layerDown').addEventListener('click', () => {
    let activeObj = canvas.getActiveObject();
    if(activeObj) { canvas.sendBackwards(activeObj); canvas.renderAll(); updateLayerPanel(); }
});
document.getElementById('layerDelete').addEventListener('click', () => {
    let activeObj = canvas.getActiveObject();
    if(activeObj) { canvas.remove(activeObj); canvas.discardActiveObject().renderAll(); }
});
document.getElementById('layerDuplicate').addEventListener('click', () => {
    let activeObj = canvas.getActiveObject();
    if(!activeObj) return;
    activeObj.clone((cloned) => {
        canvas.discardActiveObject();
        cloned.set({ top: cloned.top + 20, left: cloned.left + 20 });
        canvas.add(cloned);
        canvas.setActiveObject(cloned);
        canvas.renderAll();
    });
});

// 8. ASPECT RATIO PRESET CONTROLLER
document.getElementById('canvasPreset').addEventListener('change', (e) => {
    let ratio = e.target.value;
    if (ratio === '16:9') { canvas.setWidth(800); canvas.setHeight(450); }
    else if (ratio === '4:5') { canvas.setWidth(500); canvas.setHeight(625); }
    else if (ratio === '820:312') { canvas.setWidth(820); canvas.setHeight(312); }
    else { canvas.setWidth(600); canvas.setHeight(600); }
    canvas.renderAll();
    saveState();
});

// 9. ZOOM CONTAINER CORE UTILS
function zoomCanvas(factor) {
    canvasScale *= factor;
    document.getElementById('canvas-wrapper').style.transform = `scale(${canvasScale})`;
    document.getElementById('zoomLevel').innerText = `Zoom: ${Math.round(canvasScale * 100)}%`;
}
function resetZoom() {
    canvasScale = 1;
    document.getElementById('canvas-wrapper').style.transform = `scale(1)`;
    document.getElementById('zoomLevel').innerText = `Zoom: 100%`;
}

// 10. PROJECT AND TIME-TRAVEL STATE ARCHIVE (Undo/Redo Engine)
function saveState() {
    if (isStateSavingBlocked) return;
    let json = JSON.stringify(canvas.toDatalessJSON());
    historyUndoStack.push(json);
    historyRedoStack = []; // Flush redo
}
document.getElementById('undoBtn').addEventListener('click', () => {
    if (historyUndoStack.length <= 1) return;
    isStateSavingBlocked = true;
    let current = historyUndoStack.pop();
    historyRedoStack.push(current);
    let previous = historyUndoStack[historyUndoStack.length - 1];
    canvas.loadFromJSON(previous, () => {
        canvas.renderAll();
        isStateSavingBlocked = false;
        updateLayerPanel();
    });
});

// 11. FILE HIGH-RESOLUTION EXPORT ENGINE
document.getElementById('exportBtn').addEventListener('click', () => {
    let format = document.getElementById('exportFormat').value;
    const dataURL = canvas.toDataURL({
        format: format,
        quality: 1.0,
        multiplier: 2 // High Resolution Export boost multiplier!
    });
    const downloadAnchor = document.createElement('a');
    downloadAnchor.download = `pixellab_export_${Date.now()}.${format}`;
    downloadAnchor.href = dataURL;
    downloadAnchor.click();
});

// Local Storage Internal Project Management Saving Triggers
document.getElementById('saveProject').addEventListener('click', () => {
    localStorage.setItem('pixel_project_save', JSON.stringify(canvas.toJSON()));
    alert('Project saved successfully internally!');
});
document.getElementById('openProject').addEventListener('click', () => {
    let data = localStorage.getItem('pixel_project_save');
    if (data) {
        canvas.loadFromJSON(data, () => { canvas.renderAll(); updateLayerPanel(); });
    } else { alert('No saved project files located.'); }
});

function setupEventListeners() {
    // Structural Dynamic Init Bridge bindings
    switchTab('text-tab');
}
