// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. SELETORES DO DOM ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');
const sessionInfo = document.getElementById('session-info');
const timelineContainer = document.getElementById('timeline-container');
const chartCanvas = document.getElementById('fear-chart');
const loader = document.getElementById('loader');
const loaderText = document.getElementById('loader-text');
const resultsContent = document.getElementById('results-content');
const modalBackdrop = document.getElementById('modal-backdrop');
const modalCloseBtn = document.getElementById('modal-close-btn');
let fearChart = null; 
let allVideoData = []; // Para guardar os dados dos vídeos

// --- 3. LÓGICA DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    userEmailDisplay.textContent = session.user.email;
    logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
    modalCloseBtn.addEventListener('click', hideModal);
    modalBackdrop.addEventListener('click', (event) => {
        if (event.target === modalBackdrop) hideModal();
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    const sessionTimestamp = urlParams.get('session');
    
    if (!sessionTimestamp) {
        sessionInfo.textContent = "ID da sessão não encontrado.";
        loader.classList.add('hidden');
        return;
    }
    
    sessionInfo.textContent = `Exibindo análise para a sessão iniciada em: ${new Date(sessionTimestamp * 1000).toLocaleString('pt-BR')}`;
    
    carregarDados(sessionTimestamp, session.user.email);
});

async function carregarDados(timestamp, userEmail) {
    const sanitizedEmail = userEmail.replace(/[@.]/g, '_');
    const fileNamePrefix = `${timestamp}_${sanitizedEmail}_`;

    const { data: videos, error } = await supabaseClient
        .from('analise_videos')
        .select('*')
        .like('nome_arquivo', `${fileNamePrefix}%`)
        .order('nome_arquivo', { ascending: true });

    if (error) {
        loaderText.textContent = `Erro ao buscar dados: ${error.message}`;
        return;
    }

    const todosProcessados = videos.every(v => v.status === 'concluido' || v.status === 'erro');

    if (!videos || videos.length === 0 || !todosProcessados) {
        loaderText.textContent = `Análise em andamento. A página será atualizada automaticamente...`;
        setTimeout(() => window.location.reload(), 20000);
        return;
    }
    
    allVideoData = videos; // Salva os dados globalmente
    loader.classList.add('hidden');
    resultsContent.classList.remove('hidden');

    construirTimeline(allVideoData);
    construirGrafico(allVideoData);
}

function construirTimeline(videos) {
    timelineContainer.innerHTML = '';
    videos.forEach((video, index) => {
        const videoElement = document.createElement('div');
        videoElement.className = 'timeline-item';
        
        const fearClass = video.fear_index > 0 ? 'emotion-fear' : '';
        const statusMessage = video.status !== 'concluido' ? `(Status: ${video.status})` : '';

        // Corrigido o bug do <details> não funcionar após a primeira vez
        videoElement.innerHTML = `
            <h3>Trecho ${index + 1} ${statusMessage}</h3>
            <p><strong>Arquivo:</strong> ${video.nome_arquivo}</p>
            <p><strong>Emoção:</strong> <span class="${fearClass}">${video.resultado_emocao}</span></p>
            <p><strong>Índice de Medo:</strong> ${video.fear_index}</p>
        `;
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Ver processo de análise do modelo';
        const detailsContent = document.createElement('p');
        detailsContent.textContent = video.processo_analise || 'N/A';
        details.appendChild(summary);
        details.appendChild(detailsContent);
        videoElement.appendChild(details);

        timelineContainer.appendChild(videoElement);
    });
}

function construirGrafico(videos) {
    const labels = videos.map((v, i) => `Trecho ${i + 1}`);
    const fearData = videos.map(v => v.fear_index);
    
    if (fearChart) {
        fearChart.destroy();
    }

    const ctx = chartCanvas.getContext('2d');
    fearChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Índice de Medo',
                data: fearData,
                borderColor: '#E50914',
                backgroundColor: 'rgba(229, 9, 20, 0.2)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointBackgroundColor: 'var(--dark-bg)', // Fundo da bolinha
                pointBorderColor: '#E50914',       // Contorno da bolinha
                pointBorderWidth: 2,
                pointHoverRadius: 10,
                pointHoverBackgroundColor: '#E50914', // Bolinha preenchida no hover
                pointHoverBorderColor: 'white'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { 
                    beginAtZero: true, 
                    max: 1.2, 
                    ticks: { color: '#a0a0a0' },
                    grid: { color: 'rgba(255, 255, 255, 0.1)' } // Linhas de grade cinza
                },
                x: { 
                    ticks: { color: '#a0a0a0' },
                    grid: { display: false } // Sem linhas de grade verticais
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false } // Desabilitamos completamente o tooltip
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const pointIndex = elements[0].index;
                    showModalForPoint(pointIndex);
                }
            }
        }
    });
}

// --- LÓGICA DO POPUP/MODAL ---
function showModalForPoint(index) {
    const videoData = allVideoData[index];
    if (!videoData) return;

    // Preenche o conteúdo do modal
    document.getElementById('modal-title').textContent = `Detalhes do Trecho ${index + 1}`;
    document.getElementById('modal-emotion').textContent = videoData.resultado_emocao;
    document.getElementById('modal-fear-index').textContent = videoData.fear_index.toFixed(2);
    document.getElementById('modal-description').textContent = videoData.processo_analise || 'N/A';
    
    // Mostra um placeholder para a thumbnail enquanto carrega
    const thumbnailImg = document.getElementById('modal-thumbnail');
    thumbnailImg.src = ""; // Limpa a imagem anterior

    // Pega a URL e gera a thumbnail
    const { data } = supabaseClient.storage.from('videos').getPublicUrl(videoData.nome_arquivo);
    generateThumbnail(data.publicUrl, (thumbnailDataUrl) => {
        thumbnailImg.src = thumbnailDataUrl;
    });

    // Mostra o modal
    modalBackdrop.classList.remove('hidden');
}

function hideModal() {
    modalBackdrop.classList.add('hidden');
}

const thumbnailCache = {}; // Cache para as thumbnails
const generateThumbnail = (videoUrl, callback) => {
    if (thumbnailCache[videoUrl]) {
        callback(thumbnailCache[videoUrl]);
        return;
    }
    const video = document.createElement('video');
    video.crossOrigin = "anonymous";
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    video.src = videoUrl;
    video.load();
    const onSeeked = () => {
        const scale = 0.5;
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL();
        thumbnailCache[videoUrl] = dataUrl;
        callback(dataUrl);
        video.removeEventListener('seeked', onSeeked);
    };
    video.addEventListener('loadeddata', () => { video.currentTime = 1; });
    video.addEventListener('seeked', onSeeked);
};
