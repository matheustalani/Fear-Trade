// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIÁVEIS GLOBAIS E SELETORES DO DOM ---
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');

// Elementos do Wizard e da Gravação
const calibrationWizard = document.getElementById('calibration-wizard');
const step1 = document.getElementById('step-1');
const step2 = document.getElementById('step-2');
const readyBtn = document.getElementById('ready-btn');
const syncBtn = document.getElementById('sync-btn');
const userNamePlaceholder = document.querySelector('.user-name-placeholder');

const recordingSection = document.getElementById('recording-section');
const webcamPreview = document.getElementById('webcam-preview');
const progressTimer = document.getElementById('progress-timer');
const recordingStatus = document.getElementById('recording-status');

let timerInterval = null;
const RECORDING_DURATION_S = 5400; // Grava por 1h e 30m, por exemplo

// --- 3. CONTROLE DE SESSÃO E ROTEAMENTO ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    const onAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/');
    const onAppPage = window.location.pathname.endsWith('app.html');
    if (session) {
        if (onAuthPage) window.location.replace('app.html');
        else if (onAppPage) initializeApp(session.user);
    } else {
        if (onAppPage) window.location.replace('index.html');
        else if (onAuthPage) setupAuthForms();
    }
});

// --- 4. FUNÇÕES ---
function setupAuthForms() {
    if (!loginForm) return;
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        authMessage.textContent = '';
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            authMessage.textContent = error.message === 'Invalid login credentials' ? 'E-mail ou senha inválidos.' : `Erro: ${error.message}`;
        }
    });
}

function initializeApp(user) {
    if (!calibrationWizard) return;
    if (userEmailDisplay.textContent === user.email) return;

    userEmailDisplay.textContent = user.email;
    if (userNamePlaceholder) userNamePlaceholder.textContent = user.email.split('@')[0];
    logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

    // Lógica do assistente de calibração
    readyBtn.addEventListener('click', () => {
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });

    syncBtn.addEventListener('click', () => {
        calibrationWizard.classList.add('hidden');
        recordingSection.classList.remove('hidden');
        startExperience();
    });
}

function startExperience() {
    setupWebcam();
    startTimer();
    // Aqui é onde a análise de IA começaria a rodar sobre o stream da webcam
}

async function setupWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamPreview.srcObject = stream;
    } catch (error) {
        console.error("Erro ao acessar a webcam:", error);
        recordingStatus.textContent = "Erro ao acessar webcam. Verifique as permissões.";
    }
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function startTimer() {
    let elapsedSeconds = 0;
    progressTimer.textContent = formatTime(elapsedSeconds);

    timerInterval = setInterval(() => {
        elapsedSeconds++;
        progressTimer.textContent = formatTime(elapsedSeconds);

        if (elapsedSeconds >= RECORDING_DURATION_S) {
            clearInterval(timerInterval);
            recordingStatus.textContent = "Sessão encerrada. Obrigado!";
        }
    }, 1000);
}
