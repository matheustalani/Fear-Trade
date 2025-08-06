// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. VARIÁVEIS GLOBAIS E SELETORES DO DOM ---
const loginForm = document.getElementById('login-form');
const authMessage = document.getElementById('auth-message');
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');

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
const actionBtn = document.getElementById('action-btn'); // Botão dinâmico

let mediaRecorder;
let sessionTimestamp; 
let chunkCounter = 0; 
const CHUNK_DURATION_MS = 30000; // Grava chunks de 30 segundos

let progressTimerInterval = null;
let recordingInterval = null;

// --- 3. CONTROLE DE SESSÃO E ROTEAMENTO ---
supabaseClient.auth.onAuthStateChange((event, session) => {
    // Detecta em qual página o usuário está
    const onAuthPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    const onAppPage = window.location.pathname.endsWith('app.html');
    
    if (session) { // Se o usuário está logado
        if (onAuthPage) window.location.replace('app.html'); // Se estiver na pág de login, vai para o app
        else if (onAppPage) initializeApp(session.user); // Se já estiver no app, inicializa
    } else { // Se o usuário NÃO está logado
        if (onAppPage) window.location.replace('index.html'); // Se estiver no app, volta para o login
        else if (onAuthPage) setupAuthForms(); // Se estiver na pág de login, prepara o formulário
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
    // Evita reinicializar a página desnecessariamente
    if (userEmailDisplay && userEmailDisplay.textContent === user.email) return;

    if (userEmailDisplay) userEmailDisplay.textContent = user.email;
    if (userNamePlaceholder) userNamePlaceholder.textContent = user.email.split('@')[0];
    if (logoutButton) logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());

    if (readyBtn) readyBtn.addEventListener('click', () => {
        step1.classList.add('hidden');
        step2.classList.remove('hidden');
    });

    if (syncBtn) syncBtn.addEventListener('click', () => {
        calibrationWizard.classList.add('hidden');
        recordingSection.classList.remove('hidden');
        startExperience();
    });
}

function startExperience() {
    // Configura o estado inicial para uma nova gravação
    sessionTimestamp = Math.floor(Date.now() / 1000); // Timestamp em segundos
    chunkCounter = 0;
    if (document.querySelector('.live-status')) {
        document.querySelector('.live-status').style.display = 'flex';
    }
    if (actionBtn) {
        actionBtn.textContent = "Finalizar Sessão";
        actionBtn.className = 'state-recording';
        actionBtn.onclick = finishExperience; // Define a ação do botão
    }

    setupWebcamAndRecording();
    startTimer();
}

async function setupWebcamAndRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        webcamPreview.srcObject = stream;
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                const videoBlob = event.data;
                const { data: { user } } = await supabaseClient.auth.getUser();
                const sanitizedEmail = user.email.replace(/[@.]/g, '_');
                // Nomenclatura corrigida para ordenação
                const fileName = `${sessionTimestamp}_${sanitizedEmail}_${String(chunkCounter).padStart(4, '0')}.webm`;
                chunkCounter++; 

                const { error } = await supabaseClient.storage.from('videos').upload(fileName, videoBlob);
                if (error) {
                    console.error(`Falha no upload do trecho ${chunkCounter - 1}:`, error);
                    if(recordingStatus) recordingStatus.textContent = `Erro no envio do trecho ${chunkCounter - 1}.`;
                } else {
                    console.log(`Trecho ${chunkCounter - 1} enviado com sucesso!`);
                    if(recordingStatus) recordingStatus.textContent = `Análise de reação ativada. (Trecho ${chunkCounter - 1} OK)`;
                }
            }
        };

        mediaRecorder.start();
        recordingInterval = setInterval(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.requestData();
            }
        }, CHUNK_DURATION_MS);

    } catch (error) {
        console.error("Erro ao acessar a webcam:", error);
        if(recordingStatus) recordingStatus.textContent = "Erro ao acessar webcam. Verifique as permissões.";
    }
}

function finishExperience() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop(); // Para a gravação (isso vai disparar um último ondataavailable)
    }
    
    if (recordingInterval) clearInterval(recordingInterval);
    if (progressTimerInterval) clearInterval(progressTimerInterval);

    // Reseta a interface
    if (recordingStatus) recordingStatus.textContent = "Sessão finalizada. Gerando relatório de resultados...";
    if (document.querySelector('.live-status')) {
        document.querySelector('.live-status').style.display = 'none';
    }
    if (progressTimer) progressTimer.textContent = "00:00:00";
    
    if (actionBtn) {
        actionBtn.textContent = "Começar de Novo";
        actionBtn.className = 'state-ready';
        actionBtn.onclick = startExperience;
    }
    
    // ===============================================
    //  **AQUI ESTÁ A ALTERAÇÃO QUE VOCÊ PEDIU**
    // ===============================================
    // Aguarda um pouco para o último chunk ser enviado e redireciona para a página de resultados
    setTimeout(() => {
        window.location.href = `results.html?session=${sessionTimestamp}`;
    }, 3000); // Espera 3 segundos
}

function formatTime(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return [h, m, s].map(v => String(v).padStart(2, '0')).join(':');
}

function startTimer() {
    let elapsedSeconds = 0;
    if (progressTimer) progressTimer.textContent = formatTime(elapsedSeconds);
    progressTimerInterval = setInterval(() => {
        elapsedSeconds++;
        if (progressTimer) progressTimer.textContent = formatTime(elapsedSeconds);
    }, 1000);
}

// Garante que a função de setup dos formulários seja chamada na página de login
if(window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    setupAuthForms();
}
