
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
// Display the room name
document.getElementById('roomNameDisplay').innerText = room;

// --- STATE VARIABLES ---
let drawing = false;
let current = { x: 0, y: 0 };
let isEraser = false;


const urlParams = new URLSearchParams(window.location.search);
const room = urlParams.get('room') || 'general'; // Default to 'general'

console.log("Joined Room:", room);

// 2. Join the room immediately upon connection
socket.on('connect', () => {
    socket.emit('join_room', room);
});

// --- HELPER FUNCTIONS ---

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

// --- CORE DRAWING FUNCTIONS ---

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

    // FIX: Send 'room' with the data
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

    // FIX: Send 'room' with the data
    socket.emit('text', {
        room: room,
        text: text,
        x: x / w,
        y: y / h,
        fontSize: fontSize,
        color: color
    });
}

// --- MOUSE EVENT LISTENERS ---

canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    current.x = e.clientX;
    current.y = e.clientY;
});

canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

const onMouseMove = throttle((e) => {
    if (!drawing) return;

    const color = isEraser ? '#f0f0f0' : colorPicker.value;
    const size = isEraser ? 20 : sizePicker.value;

    drawLine(current.x, current.y, e.clientX, e.clientY, color, size, true);
    current.x = e.clientX;
    current.y = e.clientY;
}, 10);

canvas.addEventListener('mousemove', onMouseMove);

// --- TOOL LISTENERS ---

// Double Click for Text
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

// Eraser
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

colorPicker.addEventListener('input', () => {
    if (isEraser) {
        isEraser = false;
        eraserBtn.classList.remove('active-tool');
        eraserBtn.innerText = "Eraser";
        canvas.style.cursor = 'crosshair';
    }
});

// Download
downloadBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    tempCtx.fillStyle = '#f0f0f0';
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    tempCtx.drawImage(canvas, 0, 0);
    
    const link = document.createElement('a');
    link.download = `whiteboard-${room}.png`;
    link.href = tempCanvas.toDataURL();
    link.click();
});

// Clear Board
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // FIX: Send room ID so we only clear OUR room
    socket.emit('clear', room);
});

// --- SOCKET.IO EVENT LISTENERS ---

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