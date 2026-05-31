let canvas;
let canvasScale = 1;
let historyUndoStack = [];
let historyRedoStack = [];
let isStateSavingBlocked = false;

// 🔥 পেজ লোড হওয়ার সময় স্প্ল্যাশ স্ক্রিন ও প্রোগ্রেসবার হ্যান্ডেল করা হবে
window.addEventListener('load', () => {
    const progress = document.getElementById('loadingProgress');
    const splash = document.getElementById('splashScreen');
    
    // লোডিং বার গ্রোথ অ্যানিমেশন ট্র্রিগার
    if(progress) {
        setTimeout(() => {
            progress.style.transform = 'scaleX(1)';
        }, 150);
    }

    // ২.৮ সেকেন্ড প্রোগ্রেস বার শেষ হওয়ার পর মূল ইন্টারফেস চালু হবে
    setTimeout(() => {
        if(splash) {
            splash.classList.add('splash-fade-out');
            // ট্রানজিশন শেষ হলে ডম এলিমেন্ট রিমুভ করা
            setTimeout(() => splash.remove(), 800);
        }
        initCanvas();
        setupEventListeners();
        switchTab('text-tab'); // শুরুর ডিফল্ট ট্যাব
    }, 2800);
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
    // --- TEXT ADD BUTTON ---
    document.getElementById('addText').addEventListener('click', () => {
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

    // --- TEXT INPUT INPUT SYNC ---
    document.getElementById('textString').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (activeObj && activeObj.isType('text-like')) {
            activeObj.set('text', e.target.value);
            canvas.renderAll();
        }
    });

    // --- SLIDERS ---
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

    // --- IMAGE & STICKERS ---
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

    document.getElementById('stickerLoader').addEventListener('change', (e) => {
        if (!e.target.value) return;
        const emoText = new fabric.Text(e.target.value, { fontSize: 50, left: 150, top: 150 });
        canvas.add(emoText);
        canvas.setActiveObject(emoText);
        canvas.renderAll();
        e.target.value = ""; 
    });

    // --- UNIVERSAL ASSET COLOR CHANGER (SHAPE & IMAGE TINT) ---
    document.getElementById('shapeFill').addEventListener('input', (e) => {
        let activeObj = canvas.getActiveObject();
        if (!activeObj) return;

        let targetColor = e.target.value;

        if (activeObj.type === 'rect' || activeObj.type === 'circle' || activeObj.type === 'triangle' || activeObj.type === 'star' || activeObj.type === 'arrow' || activeObj.type === 'line') {
            activeObj.set('fill', targetColor);
        } 
        else if (activeObj.type === 'image') {
            activeObj.filters = [
                new fabric.Image.filters.BlendColor({
                    color: targetColor,
                    mode: 'tint',
                    alpha: 0.9
                })
            ];
            activeObj.applyFilters();
        }
        canvas.renderAll();
    });

    // --- ৫টি নির্দিষ্ট ASPECT RATIO CONTROLLER ---
    document.getElementById('canvasPreset').addEventListener('change', (e) => {
        let ratio = e.target.value;
        if (ratio === 'fb_post') { 
            canvas.setWidth(600); canvas.setHeight(450);
        } else if (ratio === 'ig_post') { 
            canvas.setWidth(500); canvas.setHeight(500);
        } else if (ratio === 'fb_banner') { 
            canvas.setWidth(820); canvas.setHeight(312);
        } else if (ratio === 'yt_thumb') { 
            canvas.setWidth(711); canvas.setHeight(400);
        } else { 
            canvas.setWidth(500); canvas.setHeight(500);
        }
        canvas.renderAll();
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

    // --- BACKGROUND COLOR ---
    document.getElementById('bgColorInput').addEventListener('input', (e) => {
        canvas.setBackgroundColor(e.target.value, canvas.renderAll.bind(canvas));
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
        container.innerHTML = `<p class="text-center text-gray-500 mt-10 italic">No layers present.</p>`;
        return;
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
window.resetZoom = function() {
    canvasScale = 1;
    document.getElementById('canvas-wrapper').style.transform = `scale(1)`;
    document.getElementById('zoomLevel').innerText = `Zoom: 100%`;
}
