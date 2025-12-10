// CHANGE THIS URL AFTER DEPLOYING YOUR SERVER TO RENDER
// Local testing: 'http://localhost:3000'
// Production: 'https://your-app-name.onrender.com'
const BACKEND_URL = 'https://whiteboard-server-7uvq.onrender.com'; 

const socket = io(BACKEND_URL);

const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const clearBtn = document.getElementById('clearBtn');

let drawing = false;
let current = { x: 0, y: 0 };

// --- 1. Helper: Throttle Function (Optimization) ---
// Limits how often we emit data to the server (e.g once every 10ms)
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

// --- 2. Canvas Resizing ---
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- 3. Drawing Logic ---
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
        x0: x0 / w, // Normalize coordinates (0 to 1)
        y0: y0 / h,
        x1: x1 / w,
        y1: y1 / h,
        color: color,
        size: size
    });
}

// --- 4. Mouse Events ---
canvas.addEventListener('mousedown', (e) => {
    drawing = true;
    current.x = e.clientX;
    current.y = e.clientY;
});

// -. for new text featurre:

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
        fontSize: fontSize, // Send raw pixel size for simplicity
        color: color
    });
}

// Handle Double Click to Spawn Input
window.addEventListener('dblclick', (e) => {
    // 1. Create the temporary input
    const input = document.createElement('textarea');
    input.classList.add('temp-text-input');
    
    // 2. Position it at mouse click
    input.style.left = `${e.clientX}px`;
    input.style.top = `${e.clientY}px`;
    
    // 3. Style match
    input.style.color = colorPicker.value;
    input.style.fontSize = '20px'; // Default start size

    document.body.appendChild(input);
    input.focus();

    // 4. Handle "Finishing" the text (Blur event)
    input.addEventListener('blur', () => {
        const text = input.value;
        
        if (text.trim().length > 0) {
            // Calculate final font size based on box height
            // We use roughly 70% of the box height as the font size
            const boxHeight = input.clientHeight;
            const calculatedFontSize = Math.floor(boxHeight * 0.7);

            // Draw locally
            // Note: We add boxHeight to Y because canvas draws text from bottom-left
            drawText(text, e.clientX, e.clientY + (boxHeight/2), calculatedFontSize, colorPicker.value, true);
        }
        
        // Remove the input box
        document.body.removeChild(input);
    });
});




canvas.addEventListener('mouseup', () => drawing = false);
canvas.addEventListener('mouseout', () => drawing = false);

// The throttled event handler
const onMouseMove = throttle((e) => {
    if (!drawing) return;
    
    drawLine(
        current.x, 
        current.y, 
        e.clientX, 
        e.clientY, 
        colorPicker.value, 
        sizePicker.value, 
        true
    );
    
    current.x = e.clientX;
    current.y = e.clientY;
}, 10); // Run max once every 10ms

canvas.addEventListener('mousemove', onMouseMove);

// --- 5. Button Events ---
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    socket.emit('clear');
});

// --- 6. Socket Events ---
socket.on('draw', (data) => {
    const w = canvas.width;
    const h = canvas.height;
    // Denormalize coordinates
    drawLine(data.x0 * w, data.y0 * h, data.x1 * w, data.y1 * h, data.color, data.size, false);
});

socket.on('clear', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});