// --- CONFIGURATION ---
// REPLACE with your actual Render URL when deploying (e.g., 'https://your-app.onrender.com')
// For local testing, use 'http://localhost:3000'
const BACKEND_URL = 'https://whiteboard-server-7uvq.onrender.com'; 

const socket = io(BACKEND_URL);

// --- DOM ELEMENTS ---
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');
const downloadBtn = document.getElementById('downloadBtn');

// --- STATE VARIABLES ---
let drawing = false;
let current = { x: 0, y: 0 };
let isEraser = false; // Track if eraser is active

// --- 1. HELPER FUNCTIONS ---

// Throttle: Limits how often we send data (Performance optimization)
function throttle(callback, delay) {
    let previousCall = new Date().getTime();
    return function() {
        const time = new Date().getTime();
        if ((time - previousCall) >= delay) {
            previousCall = time;
            callback.apply(null, arguments);
        }
    };
}

// Resize Canvas: Keeps canvas full screen
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); // Initial call

// --- 2. CORE DRAWING FUNCTIONS ---

// Draw Line (Pencil & Eraser)
function drawLine(x0, y0, x1, y1, color, size, emit) {
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.closePath();

    if (!emit) return;

    const w = canvas.width;
    const h = canvas.height;

    socket.emit('draw', {
        x0: x0 / w, // Normalize (0-1)
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color,
        size: size
    });
}

// Draw Text
function drawText(text, x, y, fontSize, color, emit) {
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    if (!emit) return;

    const w = canvas.width;
    const h = canvas.height;

    socket.emit('text', {
        text: text,
        x: x / w,
        y: y / h,
        fontSize: fontSize,
        color: color
    });
}

// --- 3. MOUSE EVENT LISTENERS ---

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    current.x = e.clientX;
    current.y = e.clientY;
});

canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

// Throttled Mouse Move (Handles Drawing & Erasing)
const onMouseMove = throttle((e) => {
    if (!drawing) return;

    // Logic: If Eraser is ON, use background color (#f0f0f0) and big size (20)
    // If Eraser is OFF, use User's chosen color and size
    const color = isEraser ? '#f0f0f0' : colorPicker.value;
    const size = isEraser ? 20 : sizePicker.value;

    drawLine(
        current.x, 
        current.y, 
        e.clientX, 
        e.clientY, 
        color, 
        size, 
        true
    );

    current.x = e.clientX;
    current.y = e.clientY;
}, 10);

canvas.addEventListener('mousemove', onMouseMove);

// --- 4. TEXT TOOL LISTENER (Double Click) ---

window.addEventListener('dblclick', (e) => {
    // Create temporary input box
    const input = document.createElement('textarea');
    input.classList.add('temp-text-input');
    input.style.left = `${e.clientX}px`;
    input.style.top = `${e.clientY}px`;
    input.style.color = colorPicker.value;
    input.style.fontSize = '20px';

    document.body.appendChild(input);
    input.focus();

    // When user clicks away, "burn" text to canvas
    input.addEventListener('blur', () => {
        const text = input.value;
        if (text.trim().length > 0) {
            const boxHeight = input.clientHeight;
            // Font size roughly matches box height
            const calculatedFontSize = Math.floor(boxHeight * 0.7);
            
            // Adjust Y position (canvas draws text from bottom-left corner)
            drawText(text, e.clientX, e.clientY + (boxHeight/2), calculatedFontSize, colorPicker.value, true);
        }
        document.body.removeChild(input);
    });
});

// --- 5. TOOLBAR BUTTON LISTENERS ---

// Eraser Toggle
eraserBtn.addEventListener('click', () => {
    isEraser = !isEraser;
    if (isEraser) {
        eraserBtn.classList.add('active-tool'); // Ensure you have CSS for this class
        eraserBtn.innerText = "Stop Erasing";
        canvas.style.cursor = 'cell'; // distinctive cursor
    } else {
        eraserBtn.classList.remove('active-tool');
        eraserBtn.innerText = "Eraser";
        canvas.style.cursor = 'crosshair';
    }
});

// Auto-turn off eraser if user picks a color
colorPicker.addEventListener('input', () => {
    if (isEraser) {
        isEraser = false;
        eraserBtn.classList.remove('active-tool');
        eraserBtn.innerText = "Eraser";
        canvas.style.cursor = 'crosshair';
    }
});

// Download / Save Board
downloadBtn.addEventListener('click', () => {
    // Create temp canvas to merge background color (otherwise it is transparent)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Fill white/grey background first
    tempCtx.fillStyle = '#f0f0f0';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // Draw original canvas on top
    tempCtx.drawImage(canvas, 0, 0);

    // Trigger download
    const link = document.createElement('a');
    link.download = 'whiteboard-art.png';
    link.href = tempCanvas.toDataURL();
    link.click();
});

// Clear Board
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear');
});

// --- 6. SOCKET.IO EVENT LISTENERS (Incoming Data) ---

socket.on('draw', (data) => {
    const w = canvas.width;
    const h = canvas.height;
    // Receive normalized coordinates, multiply by local screen size
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, false);
});

socket.on('text', (data) => {
    const w = canvas.width;
    const h = canvas.height;
    drawText(data.text, data.x * w, data.y * h, data.fontSize, data.color, false);
});

socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});