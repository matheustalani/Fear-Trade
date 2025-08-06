// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWjj343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. SELETORES DO DOM ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');
const backToAppBtn = document.getElementById('back-to-app-btn');
const sessionInfo = document.getElementById('session-info');
const timelineContainer = document.getElementById('timeline-container');
const chartCanvas = document.getElementById('fear-chart');
let fearChart = null; // Variável para guardar nosso gráfico

// --- 3. LÓGICA DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    userEmailDisplay.textContent = session.user.email;
    logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
    backToAppBtn.addEventListener('click', () => window.location.href = 'app.html');
    
    const urlParams = new URLSearchParams(window.location.search);
    const sessionTimestamp = urlParams.get('session');
    
    if (!sessionTimestamp) {
        sessionInfo.textContent = "ID da sessão não encontrado.";
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
        timelineContainer.innerHTML = `<p>Erro ao buscar dados: ${error.message}</p>`;
        return;
    }

    if (!videos || videos.length === 0) {
        timelineContainer.innerHTML = `<p>Nenhum resultado de análise encontrado ainda. O processamento pode levar alguns minutos. A página será atualizada automaticamente.</p>`;
        setTimeout(() => window.location.reload(), 30000);
        return;
    }

    // Com os dados em mãos, construímos a timeline e o gráfico
    construirTimeline(videos);
    construirGrafico(videos);
}

function construirTimeline(videos) {
    timelineContainer.innerHTML = '';
    videos.forEach((video, index) => {
        const videoElement = document.createElement('div');
        videoElement.className = 'timeline-item';
        
        const fearClass = video.fear_index > 0 ? 'emotion-fear' : '';
        const statusMessage = video.status !== 'concluido' ? `(Status: ${video.status})` : '';

        videoElement.innerHTML = `
            <h3>Trecho ${index + 1} ${statusMessage}</h3>
            <p><strong>Arquivo:</strong> ${video.nome_arquivo}</p>
            <p><strong>Emoção:</strong> <span class="${fearClass}">${video.resultado_emocao}</span></p>
            <p><strong>Índice de Medo:</strong> ${video.fear_index}</p>
            <details>
                <summary>Ver processo de análise do modelo</summary>
                <p>${video.processo_analise || 'N/A'}</p>
            </details>
        `;
        timelineContainer.appendChild(videoElement);
    });
}

function construirGrafico(videos) {
    // 1. Prepara os dados para o gráfico
    const labels = videos.map((v, i) => `Trecho ${i + 1}`);
    const fearData = videos.map(v => v.fear_index);
    const videoUrls = videos.map(v => {
        const { data } = supabaseClient.storage.from('videos').getPublicUrl(v.nome_arquivo);
        return data.publicUrl;
    });

    // 2. Destrói o gráfico anterior se ele existir (para atualizações)
    if (fearChart) {
        fearChart.destroy();
    }

    // 3. Cria o novo gráfico
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
                tension: 0.3,
                pointRadius: 6,
                pointHoverRadius: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    max: 1.2,
                    ticks: { color: '#808080' }
                },
                x: {
                    ticks: { color: '#808080' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false, // Desabilita o tooltip padrão
                    external: createCustomTooltip // Habilita nosso tooltip customizado
                }
            }
        },
        // Armazena as URLs dos vídeos no objeto do gráfico para acesso pelo tooltip
        meta: {
            videoUrls: videoUrls
        }
    });
}

// --- LÓGICA DO TOOLTIP CUSTOMIZADO COM THUMBNAIL ---

// Função para gerar uma thumbnail de um vídeo
const generateThumbnail = (videoUrl, callback) => {
    const video = document.createElement('video');
    video.crossOrigin = "anonymous"; // Essencial para vídeos de outro domínio (Supabase)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    video.src = videoUrl;
    video.load();

    video.addEventListener('loadeddata', () => {
        video.currentTime = 1; // Pega o frame no segundo 1
    });

    video.addEventListener('seeked', () => {
        canvas.width = video.videoWidth / 4; // Reduz o tamanho para performance
        canvas.height = video.videoHeight / 4;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        callback(canvas.toDataURL());
    });
};

const createCustomTooltip = (context) => {
    const { chart, tooltip } = context;
    let tooltipEl = document.getElementById('chartjs-tooltip');

    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.style.background = 'rgba(20, 20, 20, 0.9)';
        tooltipEl.style.borderRadius = '8px';
        tooltipEl.style.color = 'white';
        tooltipEl.style.opacity = 1;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transform = 'translate(-50%, -120%)';
        tooltipEl.style.transition = 'all .1s ease';
        tooltipEl.style.padding = '10px';
        tooltipEl.style.border = '1px solid #E50914';
        chart.canvas.parentNode.appendChild(tooltipEl);
    }

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    // Define o conteúdo do tooltip
    const pointIndex = tooltip.dataPoints[0].dataIndex;
    const fearIndex = tooltip.dataPoints[0].raw;
    const videoUrl = chart.meta.videoUrls[pointIndex];

    tooltipEl.innerHTML = `
        <img id="tooltip-thumb" src="" width="160" style="display: block; margin-bottom: 5px;" />
        <div>Índice de Medo: <strong>${fearIndex.toFixed(2)}</strong></div>
    `;

    // Gera a thumbnail e a insere no tooltip
    generateThumbnail(videoUrl, (thumbnailDataUrl) => {
        const thumbImg = document.getElementById('tooltip-thumb');
        if (thumbImg) {
            thumbImg.src = thumbnailDataUrl;
        }
    });

    // Posiciona o tooltip
    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
};
