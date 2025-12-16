// --- 1. CONFIGURATION & ROOM SETUP ---

const BACKEND_URL = 'https://whiteboard-server-7uvq.onrender.com'; 

// CRITICAL: Define 'room' BEFORE connecting
const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'general'; 
console.log("Current Room:", room);

// --- 2. CONNECTION ---
const socket = io(BACKEND_URL);

// Join the room as soon as we connect
socket.on('connect', () => {
    socket.emit('join_room', room);
});

// --- 3. DOM ELEMENTS ---
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');
const eraserBtn = document.getElementById('eraserBtn');
const downloadBtn = document.getElementById('downloadBtn');

// --- 4. STATE VARIABLES ---
let drawing = false;
let current = { x: 0, y: 0 };
let isEraser = false;

// --- 5. HELPER FUNCTIONS ---

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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 6. CORE DRAWING FUNCTIONS ---

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

    // Must include 'room' in the data
    socket.emit('draw', {
        room: room, 
        x0: x0 / w, 
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color,
        size: size
    });
}

function drawText(text, x, y, fontSize, color, emit) {
    ctx.font = `${fontSize}px sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);

    if (!emit) return;

    const w = canvas.width;
    const h = canvas.height;

    socket.emit('text', {
        room: room,
        text: text,
        x: x / w,
        y: y / h,
        fontSize: fontSize,
        color: color
    });
}

// --- 7. EVENT LISTENERS ---

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    current.x = e.clientX;
    current.y = e.clientY;
});

canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

const onMouseMove = throttle((e) => {
    if (!drawing) return;

    // Eraser Logic: if active, force color to background and size to 20
    const color = isEraser ? '#f0f0f0' : colorPicker.value;
    const size = isEraser ? 20 : sizePicker.value;

    drawLine(current.x, current.y, e.clientX, e.clientY, color, size, true);
    current.x = e.clientX;
    current.y = e.clientY;
}, 10);

canvas.addEventListener('mousemove', onMouseMove);

// Double Click Text Tool
window.addEventListener('dblclick', (e) => {
    const input = document.createElement('textarea');
    input.classList.add('temp-text-input');
    input.style.left = `${e.clientX}px`;
    input.style.top = `${e.clientY}px`;
    input.style.color = colorPicker.value;
    input.style.fontSize = '20px';

    document.body.appendChild(input);
    input.focus();

    input.addEventListener('blur', () => {
        const text = input.value;
        if (text.trim().length > 0) {
            const boxHeight = input.clientHeight;
            const calculatedFontSize = Math.floor(boxHeight * 0.7);
            drawText(text, e.clientX, e.clientY + (boxHeight/2), calculatedFontSize, colorPicker.value, true);
        }
        document.body.removeChild(input);
    });
});

// Eraser Button
eraserBtn.addEventListener('click', () => {
    isEraser = !isEraser;
    if (isEraser) {
        eraserBtn.classList.add('active-tool');
        eraserBtn.innerText = "Stop Erasing";
        canvas.style.cursor = 'cell';
    } else {
        eraserBtn.classList.remove('active-tool');
        eraserBtn.innerText = "Eraser";
        canvas.style.cursor = 'crosshair';
    }
});

// Disable eraser if color changes
colorPicker.addEventListener('input', () => {
    if (isEraser) {
        isEraser = false;
        eraserBtn.classList.remove('active-tool');
        eraserBtn.innerText = "Eraser";
        canvas.style.cursor = 'crosshair';
    }
});

// Download Button
downloadBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    
    // Fill background
    tempCtx.fillStyle = '#f0f0f0';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    
    // Draw canvas
    tempCtx.drawImage(canvas, 0, 0);
    
    // Trigger Download
    const link = document.createElement('a');
    link.download = `whiteboard-${room}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
});

// Clear Button
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear', room); // Send room ID to clear ONLY this room
});

// --- 8. SOCKET INCOMING EVENTS ---

socket.on('draw', (data) => {
    const w = canvas.width;
    const h = canvas.height;
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