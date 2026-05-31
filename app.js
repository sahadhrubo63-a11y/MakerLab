let canvas;
let canvasScale = 1;
let historyUndoStack = [];
let historyRedoStack = [];
let isStateSavingBlocked = false;

window.addEventListener('load', () => {
    const progress = document.getElementById('loadingProgress');
    const splash = document.getElementById('splashScreen');
    
    if(progress) {
        setTimeout(() => {
            progress.style.transform = 'scaleX(1)';
        }, 100);
    }

    setTimeout(() => {
        if(splash) {
            splash.classList.add('splash-fade-out');
            setTimeout(() => splash.remove(), 800);
        }
        initCanvas();
        setupEventListeners();
        switchTab('text-tab');
    }, 2600);
});

function initCanvas() {
    canvas = new fabric.Canvas('mainPixelCanvas', {
        width: 500,
        height: 500,
        backgroundColor: '#111827',
        preserveObjectStacking: true
    });
    
    fabric.Object.prototype.set({
        transparentCorners: false,
        cornerColor: '#22d3ee',
        borderColor: '#22d3ee',
        cornerSize: 10,
        cornerStyle: 'circle'
    });

    canvas.on('object:modified', () => saveState());
    canvas.on('object:added', () => { updateLayerPanel(); saveState(); });
    canvas.on('object:removed', () => { updateLayerPanel(); saveState(); });
    canvas.on('selection:created', () => syncSelectedObjectToUI());
    canvas.on('selection:updated', () => syncSelectedObjectToUI());
    canvas.on('selection:cleared', () => {
        document.getElementById('textString').value = '';
    });
    
    saveState();
}

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => {
        el.classList.remove('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-750');
        el.classList.add('text-gray-400');
    });
    
    const targetTab = document.getElementById(tabId);
    const targetBtn = document.getElementById('btn-' + tabId);
    
    if (targetTab) targetTab.classList.remove('hidden');
    if (targetBtn) {
        targetBtn.classList.add('text-cyan-400', 'border-b-2', 'border-cyan-400', 'bg-gray-750');
        targetBtn.classList.remove('text-gray-400');
    }
}

function setupEventListeners() {
    // --- TEXT ADD ---
    document.getElementById('addText').addEventListener('click', () => {
        const textObj = new fabric.IText('Double Click to Edit', {
            left: 100, top: 150, fontFamily: 'Poppins', fontSize: 40, fill: '#ffffff', textAlign: 'center'
        });
        canvas.add(textObj);
        canvas.setActiveObject(textObj);
        canvas.renderAll();
        updateLayerPanel();
    });

    document.getElementById('textString').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isType('text-like')) { activeObj.set('text', e.target.value); canvas.renderAll(); }
    });

    document.getElementById('textSize').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        document.getElementById('v-size').innerText = e.target.value;
        if (activeObj && activeObj.isType('text-like')) { activeObj.set('fontSize', parseInt(e.target.value)); canvas.renderAll(); }
    });

    document.getElementById('textRotation').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (activeObj) { activeObj.set('angle', parseInt(e.target.value)); canvas.renderAll(); }
    });

    // --- কোড ১: গ্লোবাল বা ইউনিভার্সাল এসেট কালার ফিল্টার লজিক ---
    document.getElementById('shapeFill').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (!activeObj) return;
        let targetColor = e.target.value;

        // যদি শেপ সিলেক্ট থাকে
        if (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'triangle') {
            activeObj.set('fill', targetColor);
        } 
        // যদি ইমেজ/পিএনজি সিলেক্ট থাকে (কালার ওভারলে টিন্ট ফিল্টার)
        else if (activeObj.type === 'image') {
            activeObj.filters = [new fabric.Image.filters.BlendColor({ color: targetColor, mode: 'tint', alpha: 0.9 })];
            activeObj.applyFilters();
        }
        canvas.renderAll();
    });

    // --- কোড ২: ক্যানভাস ৫টি অ্যাসপেক্ট রেশিও কন্ট্রোলার ---
    document.getElementById('canvasPreset').addEventListener('change', (e) => {
        let ratio = e.target.value;
        if (ratio === 'fb_post') { canvas.setWidth(600); canvas.setHeight(450); }
        else if (ratio === 'ig_post') { canvas.setWidth(500); canvas.setHeight(500); }
        else if (ratio === 'fb_banner') { canvas.setWidth(820); canvas.setHeight(312); }
        else if (ratio === 'yt_thumb') { canvas.setWidth(711); canvas.setHeight(400); }
        else { canvas.setWidth(500); canvas.setHeight(500); }
        canvas.renderAll();
    });

    // --- IMAGE LOADER ---
    document.getElementById('imageLoader').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(f) {
            fabric.Image.fromURL(f.target.result, (img) => {
                img.scaleToWidth(200); canvas.add(img); canvas.centerObject(img); canvas.setActiveObject(img); canvas.renderAll();
            });
        };
        reader.readAsDataURL(file);
    });

    // --- BACKGROUND COLOR ---
    document.getElementById('bgColorInput').addEventListener('input', (e) => {
        canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
    });

    // --- EXPORT ---
    document.getElementById('exportBtn').addEventListener('click', () => {
        let format = document.getElementById('exportFormat').value;
        const dataURL = canvas.toDataURL({ format: format, quality: 1.0, multiplier: 2 });
        const downloadAnchor = document.createElement('a');
        downloadAnchor.download = `makerlab_${Date.now()}.${format}`;
        downloadAnchor.href = dataURL;
        downloadAnchor.click();
    });

    // --- DELETE LAYER ---
    document.getElementById('layerDelete').addEventListener('click', () => {
        let activeObj = canvas.getActiveObject();
        if(activeObj) { canvas.remove(activeObj); canvas.discardActiveObject().renderAll(); updateLayerPanel(); }
    });
}

function syncSelectedObjectToUI() {
    const activeObj = canvas.getActiveObject();
    if (!activeObj) return;
    if (activeObj.isType('text-like')) {
        document.getElementById('textString').value = activeObj.text || '';
        document.getElementById('textSize').value = activeObj.fontSize;
        document.getElementById('v-size').innerText = activeObj.fontSize;
    }
}

window.addShape = function(shapeType) {
    let shape;
    const props = { left: 150, top: 150, fill: '#00ffff', width: 100, height: 100, strokeWidth: 2, stroke: '#ffffff' };
    if (shapeType === 'rect') shape = new fabric.Rect(props);
    else if (shapeType === 'circle') shape = new fabric.Circle({ ...props, radius: 50 });
    else if (shapeType === 'triangle') shape = new fabric.Triangle(props);
    if(shape) { canvas.add(shape); canvas.setActiveObject(shape); canvas.renderAll(); updateLayerPanel(); }
}

function updateLayerPanel() {
    const container = document.getElementById('layerListContainer');
    if(!container) return;
    const objects = canvas.getObjects();
    document.getElementById('layerCount').innerText = `${objects.length} Layers`;
    if (objects.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-500 mt-10 italic">No layers present.</p>`; return;
    }
    container.innerHTML = '';
    for (let i = objects.length - 1; i >= 0; i--) {
        let obj = objects[i];
        let name = obj.type.toUpperCase();
        if (obj.text) name = `"${obj.text.substring(0,10)}"`;
        let div = document.createElement('div');
        div.className = `p-2 mb-1 border rounded bg-gray-900 border-gray-700 cursor-pointer`;
        div.innerHTML = `<span>${name}</span>`;
        div.addEventListener('click', () => { canvas.setActiveObject(obj); canvas.renderAll(); });
        container.appendChild(div);
    }
}

function saveState() {
    if (isStateSavingBlocked || !canvas) return;
    historyUndoStack.push(JSON.stringify(canvas.toJSON()));
}

window.zoomCanvas = function(factor) {
    canvasScale *= factor;
    document.getElementById('canvas-wrapper').style.transform = `scale(${canvasScale})`;
    document.getElementById('zoomLevel').innerText = `Zoom: ${Math.round(canvasScale * 100)}%`;
}
