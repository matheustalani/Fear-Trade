// ===================================================================
// ARQUIVO: app.js (Versão Final - Chaves Preenchidas)
// ===================================================================

// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIÁVEIS GLOBAIS E SELETORES DO DOM ---
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');

// Elementos da página da App (app.html)
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');
const webcamPreview = document.getElementById('webcam-preview');
const startButton = document.getElementById('start-button');
const timerDisplay = document.getElementById('timer');
const recordingStatus = document.getElementById('recording-status');

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
    if (!document.getElementById('recording-section')) return;

    // Mostra o e-mail do usuário e configura o botão de logout
    userEmailDisplay.textContent = user.email;
    logoutButton.addEventListener('click', async () => {
        await supabaseClient.auth.signOut();
    });

    // Inicia a webcam e o botão de gravação
    setupWebcam();
    startButton.addEventListener('click', startRecording);
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
        startButton.disabled = false; // Permite tentar de novo
    } else {
        console.log("Upload bem-sucedido:", data);
        recordingStatus.textContent = "Gravação enviada com sucesso! Obrigado por participar.";
        startButton.textContent = "Gravar Novamente";
        startButton.disabled = false;
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
