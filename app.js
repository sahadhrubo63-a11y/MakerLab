// Global App Core Variables
let canvas;
let canvasScale = 1;
let historyUndoStack = [];
let historyRedoStack = [];
let isStateSavingBlocked = false;

// 🔥 সমস্যা সমাধানের জন্য: উইন্ডো এবং লাইব্রেরি পুরোপুরি লোড হওয়ার পর ক্যানভাস চালু হবে
window.addEventListener('load', () => {
    initCanvas();
    setupEventListeners();
    switchTab('text-tab'); // ডিফল্ট ট্যাব ওপেন
});

// 1. INITIALIZE CANVAS & SETTINGS
function initCanvas() {
    // HTML-এর সঠিক ID 'mainPixelCanvas' এর সাথে কানেক্ট করা
    canvas = new fabric.Canvas('mainPixelCanvas', {
        width: 600,
        height: 450,
        backgroundColor: '#111827',
        preserveObjectStacking: true
    });
    
    // কন্ট্রোল এনভায়রনমেন্ট স্টাইল (PixelLab UI Look)
    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: '#22d3ee',
        borderColor: '#22d3ee',
        cornerSize: 10,
        cornerStyle: 'circle'
    });

    // ক্যানভাসে কোনো পরিবর্তন হলে হিস্ট্রি ও লেয়ার আপডেট হবে
    canvas.on('object:modified', () => saveState());
    canvas.on('object:added', () => { updateLayerPanel(); saveState(); });
    canvas.on('object:removed', () => { updateLayerPanel(); saveState(); });
    canvas.on('selection:created', () => syncSelectedObjectToUI());
    canvas.on('selection:updated', () => syncSelectedObjectToUI());
    canvas.on('selection:cleared', () => {
        document.getElementById('textString').value = '';
    });
    
    saveState(); // ইনিশিয়াল স্টেট সেভ
}

// 2. TAB CONTROLLER SWITCHER (গ্লোবাল স্কোপে রাখা হয়েছে যেন HTML থেকে সরাসরি কাজ করে)
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400');
        el.classList.add('text-gray-400');
    });
    
    const targetTab = document.getElementById(tabId);
    const targetBtn = document.getElementById('btn-' + tabId);
    
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetBtn) targetBtn.classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400');
}

// 3. EVENT LISTENERS SETUP (সব বাটনের ক্লিক অ্যাকশন সচল করার জন্য)
function setupEventListeners() {
    
    // --- TEXT ADD BUTTON ---
    const addTextBtn = document.getElementById('addText');
    if(addTextBtn) {
        addTextBtn.addEventListener('click', () => {
            const textObj = new fabric.IText('Double Click to Edit', {
                left: 100,
                top: 150,
                fontFamily: 'Poppins',
                fontSize: 40,
                fill: '#ffffff',
                textAlign: 'center'
            });
            canvas.add(textObj);
            canvas.setActiveObject(textObj);
            canvas.renderAll();
            updateLayerPanel();
        });
    }

    // --- TEXT INPUT SYNC ---
    document.getElementById('textString').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isType('text-like')) {
            activeObj.set('text', e.target.value);
            canvas.renderAll();
        }
    });

    // --- SLIDERS MUTATIONS ---
    document.getElementById('textSize').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        document.getElementById('v-size').innerText = e.target.value;
        if (activeObj && activeObj.isType('text-like')) { activeObj.set('fontSize', parseInt(e.target.value)); canvas.renderAll(); }
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

    document.getElementById('textColor').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (activeObj) { activeObj.set('fill', e.target.value); canvas.renderAll(); }
    });

    // --- TTF FONT IMPORT ---
    document.getElementById('customFont').addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(evt) {
            const fontName = 'CustomFont_' + Date.now();
            const newStyle = document.createElement('style');
            newStyle.appendChild(document.createTextNode(`@font-face { font-family: '${fontName}'; src: url(${evt.target.result}); }`));
            document.head.appendChild(newStyle);
            
            let activeObj = canvas.getActiveObject();
            if(activeObj) { activeObj.set('fontFamily', fontName); canvas.renderAll(); }
        };
        reader.readAsDataURL(file);
    });

    // --- IMAGE LOADER ---
    document.getElementById('imageLoader').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(f) {
            fabric.Image.fromURL(f.target.result, (img) => {
                img.scaleToWidth(200);
                canvas.add(img);
                canvas.centerObject(img);
                canvas.setActiveObject(img);
                canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    });

    // --- STICKER LOADER ---
    document.getElementById('stickerLoader').addEventListener('change', (e) => {
        if (!e.target.value) return;
        const emoText = new fabric.Text(e.target.value, { fontSize: 50, left: 150, top: 150 });
        canvas.add(emoText);
        canvas.setActiveObject(emoText);
        canvas.renderAll();
        e.target.value = ""; 
    });

    // --- SHAPE & IMAGE FILTERS ---
    document.getElementById('imgFilter').addEventListener('change', (e) => {
        let activeObj = canvas.getActiveObject();
        if (!activeObj || activeObj.type !== 'image') return;
        activeObj.filters = [];
        const filterVal = e.target.value;
        if (filterVal === 'grayscale') activeObj.filters.push(new fabric.Image.filters.Grayscale());
        if (filterVal === 'sepia') activeObj.filters.push(new fabric.Image.filters.Sepia());
        if (filterVal === 'invert') activeObj.filters.push(new fabric.Image.filters.Invert());
        activeObj.applyFilters();
        canvas.renderAll();
    });

    // --- FLIP BUTTON ---
    document.getElementById('flipXBtn').addEventListener('click', () => {
        let activeObj = canvas.getActiveObject();
        if (activeObj) { activeObj.set('flipX', !activeObj.get('flipX')); canvas.renderAll(); }
    });

    // --- LAYER CONTROL ACTIONS ---
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
        if(activeObj) { canvas.remove(activeObj); canvas.discardActiveObject().renderAll(); updateLayerPanel(); }
    });

    // --- ASPECT RATIO CONFIG ---
    document.getElementById('canvasPreset').addEventListener('change', (e) => {
        let ratio = e.target.value;
        if (ratio === '16:9') { canvas.setWidth(750); canvas.setHeight(422); }
        else if (ratio === '4:5') { canvas.setWidth(500); canvas.setHeight(625); }
        else { canvas.setWidth(500); canvas.setHeight(500); }
        canvas.renderAll();
    });

    // --- HIGH-RES EXPORT ---
    document.getElementById('exportBtn').addEventListener('click', () => {
        let format = document.getElementById('exportFormat').value;
        const dataURL = canvas.toDataURL({ format: format, quality: 1.0, multiplier: 2 });
        const downloadAnchor = document.createElement('a');
        downloadAnchor.download = `pixellab_${Date.now()}.${format}`;
        downloadAnchor.href = dataURL;
        downloadAnchor.click();
    });

    // --- BACKGROUND CONTROLS ---
    document.getElementById('bgColorInput').addEventListener('input', (e) => {
        canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
    });
}

// 4. SYNC DATA FROM OBJECT TO INTERFACE
function syncSelectedObjectToUI() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;

    if (activeObj.isType('text-like')) {
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

// 5. GLOBAL VECTOR SHAPES SPARKER
window.addShape = function(shapeType) {
    let shape;
    const props = { left: 150, top: 150, fill: '#00ffff', width: 100, height: 100, strokeWidth: 2, stroke: '#ffffff' };
    
    if (shapeType === 'rect') shape = new fabric.Rect(props);
    else if (shapeType === 'circle') shape = new fabric.Circle({ ...props, radius: 50 });
    else if (shapeType === 'triangle') shape = new fabric.Triangle(props);
    else if (shapeType === 'line') shape = new fabric.Line([50, 50, 200, 50], { stroke: '#00ffff', strokeWidth: 4 });
    
    if(shape) {
        canvas.add(shape);
        canvas.setActiveObject(shape);
        canvas.renderAll();
        updateLayerPanel();
    }
}

// 6. LAYER LIST DYNAMIC RE-RENDER
function updateLayerPanel() {
    const container = document.getElementById('layerListContainer');
    if(!container) return;
    
    const objects = canvas.getObjects();
    document.getElementById('layerCount').innerText = `${objects.length} Layers`;

    if (objects.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-10 italic">No layers present.</p>`;
        return;
    }

    container.innerHTML = '';
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        let name = obj.type.toUpperCase();
        if (obj.text) name = `"${obj.text.substring(0,10)}"`;

        let div = document.createElement('div');
        div.className = `p-2 mb-1 border rounded flex justify-between items-center bg-gray-900 border-gray-700 cursor-pointer`;
        div.innerHTML = `<span class="truncate font-mono">${name}</span>`;
        div.addEventListener('click', () => {
            canvas.setActiveObject(obj);
            canvas.renderAll();
        });
        container.appendChild(div);
    }
}

// 7. TIME TRAVEL HISTORY (Undo/Redo Core)
function saveState() {
    if (isStateSavingBlocked || !canvas) return;
    let json = JSON.stringify(canvas.toJSON());
    historyUndoStack.push(json);
    historyRedoStack = [];
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

// 8. ZOOM MANAGER WINDOW FUNCTIONS
window.zoomCanvas = function(factor) {
    canvasScale *= factor;
    document.getElementById('canvas-wrapper').style.transform = `scale(${canvasScale})`;
    document.getElementById('zoomLevel').innerText = `Zoom: ${Math.round(canvasScale * 100)}%`;
}
window.resetZoom = function() {
    canvasScale = 1;
    document.getElementById('canvas-wrapper').style.transform = `scale(1)`;
    document.getElementById('zoomLevel').innerText = `Zoom: 100%`;
}
