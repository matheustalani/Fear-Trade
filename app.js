// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co'; // Cole sua URL do Supabase aqui
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg'; // Cole sua chave anon public aqui
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIÁVEIS GLOBAIS E SELETORES DO DOM ---
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');
const recordingSection = document.getElementById('recording-section');
const dashboardSection = document.getElementById('dashboard-section');
const webcamPreview = document.getElementById('webcam-preview');
const startButton = document.getElementById('start-button');
const timerDisplay = document.getElementById('timer');
const recordingStatus = document.getElementById('recording-status');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');
const fearChartCanvas = document.getElementById('fear-index-chart');
const videoFilesList = document.getElementById('video-files-list');

let mediaRecorder;
let recordedChunks = [];
const RECORDING_DURATION_S = 10;

// --- 3. LÓGICA DE ROTEAMENTO E AUTENTICAÇÃO ---

async function route() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const onAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const onAppPage = window.location.pathname.endsWith('app.html');

    if (!session && onAppPage) {
        window.location.replace('index.html');
        return;
    }
    if (session && onAuthPage) {
        window.location.replace('app.html');
        return;
    }
    if (session && onAppPage) {
        initializeApp(session.user);
    }
    if (!session && onAuthPage) {
        setupAuthForms();
    }
}

function setupAuthForms() {
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        
        authMessage.textContent = '';

        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        
        if (error) {
            if (error.message === 'Invalid login credentials') {
                authMessage.textContent = 'E-mail ou senha inválidos. Tente novamente.';
            } else {
                authMessage.textContent = `Erro: ${error.message}`;
            }
        }
    });
}

// --- 4. LÓGICA DA APLICAÇÃO (app.html) ---

function initializeApp(user) {
    if (!recordingSection) return;
    recordingSection.classList.remove('hidden');
    setupWebcam();
    startButton.addEventListener('click', startRecording);
    logoutButton.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
    });
    userEmailDisplay.textContent = `Usuário: ${user.email}`;
    setupDashboard();
}

async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        webcamPreview.srcObject = stream;
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) recordedChunks.push(event.data);
        };
        mediaRecorder.onstop = uploadVideo;
    } catch (error) {
        console.error("Erro ao acessar a webcam:", error);
        recordingStatus.textContent = "Erro ao acessar webcam. Verifique as permissões.";
    }
}

function startRecording() {
    if (!mediaRecorder) {
        recordingStatus.textContent = "Câmera não está pronta.";
        return;
    }
    recordedChunks = [];
    mediaRecorder.start();
    startButton.disabled = true;
    recordingStatus.textContent = "Gravando...";
    let timeLeft = RECORDING_DURATION_S;
    timerDisplay.textContent = timeLeft;
    const timerInterval = setInterval(() => {
        timeLeft--;
        timerDisplay.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            timerDisplay.textContent = "";
            if (mediaRecorder.state === "recording") mediaRecorder.stop();
        }
    }, 1000);
}

async function uploadVideo() {
    recordingStatus.textContent = "Processando e enviando...";
    const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
    const { data: { user } } = await supabaseClient.auth.getUser();
    const sanitizedEmail = user.email.replace(/[@.]/g, '_');
    const fileName = `${Date.now()}_${sanitizedEmail}.webm`;

    const { data, error } = await supabaseClient.storage.from('videos').upload(fileName, videoBlob);
    if (error) {
        console.error("Erro no upload:", error);
        recordingStatus.textContent = `Falha no envio: ${error.message}`;
        startButton.disabled = false;
    } else {
        console.log("Upload bem-sucedido:", data);
        recordingStatus.textContent = "Gravação enviada com sucesso!";
        setTimeout(() => {
            recordingSection.classList.add('hidden');
            dashboardSection.classList.remove('hidden');
            updateVideoList();
        }, 2000);
    }
}

async function setupDashboard() {
    renderMockChart();
    await updateVideoList();
}

function renderMockChart() {
    const ctx = fearChartCanvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['0s', '10s', '20s', '30s', '40s', '50s', '60s'],
            datasets: [{
                label: 'Fear Index (Mock)',
                data: [12, 19, 3, 25, 40, 33, 50],
                borderColor: 'rgba(229, 9, 20, 1)',
                backgroundColor: 'rgba(229, 9, 20, 0.2)',
                fill: true,
                tension: 0.4
            }]
        },
        options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });
}

async function updateVideoList() {
    const { data: { user } } = await supabaseClient.auth.getUser();
    const { data, error } = await supabaseClient.storage.from('videos').list(``, {
        limit: 100,
        search: user.email.replace(/[@.]/g, '_'),
    });
    if (error) { console.error("Erro ao listar vídeos:", error); return; }
    videoFilesList.innerHTML = '';
    if (data.length === 0) {
        videoFilesList.innerHTML = '<li>Nenhuma gravação encontrada.</li>';
    } else {
        data.forEach(file => {
            const listItem = document.createElement('li');
            listItem.textContent = file.name;
            videoFilesList.appendChild(listItem);
        });
    }
}

// --- 5. INICIALIZAÇÃO E CONTROLE DE SESSÃO ---
document.addEventListener('DOMContentLoaded', route);
supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        window.location.replace('index.html');
    } else if (event === 'SIGNED_IN') {
        window.location.replace('app.html');
    }
});
