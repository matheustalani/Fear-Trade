// ======================================================
// ARQUIVO: app.js (Versão Final - Apenas Login)
// ======================================================

// --- 1. CONFIGURAÇÃO DO SUPABASE ---
// !!! IMPORTANTE: Cole sua URL e Chave Pública aqui !!!
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIÁVEIS GLOBAIS E SELETORES DO DOM ---
// Elementos da página de Login (index.html)
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');

// Elementos da página da App (app.html)
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

// Variáveis de estado da gravação
let mediaRecorder;
let recordedChunks = [];
const RECORDING_DURATION_S = 10; // Duração em segundos

// --- 3. LÓGICA DE ROTEAMENTO E AUTENTICAÇÃO ---

async function route() {
    const { data: { session } } = await supabase.auth.getSession();
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
    
    // Configura apenas o formulário de
