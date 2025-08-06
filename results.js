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
let fearChart = null; 

// --- 3. LÓGICA DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    userEmailDisplay.textContent = session.user.email;
    logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
    
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

    // Verifica se todos os vídeos encontrados já foram processados
    const todosProcessados = videos.every(v => v.status === 'concluido' || v.status === 'erro');

    if (!videos || videos.length === 0 || !todosProcessados) {
        loaderText.textContent = `Análise em andamento. A página será atualizada automaticamente...`;
        setTimeout(() => window.location.reload(), 20000); // Tenta de novo em 20s
        return;
    }
    
    // Esconde o loader e mostra o conteúdo
    loader.classList.add('hidden');
    resultsContent.classList.remove('hidden');

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
    const labels = videos.map((v, i) => `Trecho ${i + 1}`);
    const fearData = videos.map(v => v.fear_index);
    const analysisData = videos.map(v => v.processo_analise);
    const videoUrls = videos.map(v => {
        const { data } = supabaseClient.storage.from('videos').getPublicUrl(v.nome_arquivo);
        return data.publicUrl;
    });

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
                pointBackgroundColor: 'white',
                pointBorderColor: '#E50914',
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
                y: { beginAtZero: true, max: 1.2, ticks: { color: '#a0a0a0' } },
                x: { ticks: { color: '#a0a0a0' } }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    enabled: false,
                    external: createCustomTooltip
                }
            },
            // Armazena dados extras para o tooltip
            meta: {
                videoUrls: videoUrls,
                analysisData: analysisData
            }
        }
    });
}

// --- LÓGICA DO TOOLTIP CUSTOMIZADO COM THUMBNAIL ---
const getOrCreateTooltip = (chart) => {
    let tooltipEl = chart.canvas.parentNode.querySelector('div#chartjs-tooltip');
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'chartjs-tooltip';
        tooltipEl.style.opacity = 0;
        tooltipEl.style.pointerEvents = 'none';
        tooltipEl.style.position = 'absolute';
        tooltipEl.style.transition = 'all .2s ease';
        chart.canvas.parentNode.appendChild(tooltipEl);
    }
    return tooltipEl;
};

const createCustomTooltip = (context) => {
    const { chart, tooltip } = context;
    const tooltipEl = getOrCreateTooltip(chart);

    if (tooltip.opacity === 0) {
        tooltipEl.style.opacity = 0;
        return;
    }

    const pointIndex = tooltip.dataPoints[0].dataIndex;
    const fearIndex = tooltip.dataPoints[0].raw;
    const videoUrl = chart.meta.videoUrls[pointIndex];
    const analysisText = chart.meta.analysisData[pointIndex];
    // Limita o texto da descrição para não ficar gigante
    const shortAnalysis = analysisText.length > 150 ? analysisText.substring(0, 150) + '...' : analysisText;

    tooltipEl.innerHTML = `
        <div class="tooltip-title">${tooltip.title[0]}</div>
        <img id="tooltip-thumb-${pointIndex}" src="" style="width: 100%; height: auto; display: block; margin-bottom: 10px; border-radius: 4px; background: #333;" />
        <table>
            <tr>
                <td>Índice de Medo:</td>
                <td>${fearIndex.toFixed(2)}</td>
            </tr>
        </table>
        <div class="tooltip-desc">${shortAnalysis}</div>
    `;

    generateThumbnail(videoUrl, (thumbnailDataUrl) => {
        const thumbImg = document.getElementById(`tooltip-thumb-${pointIndex}`);
        if (thumbImg) {
            thumbImg.src = thumbnailDataUrl;
        }
    });

    const { offsetLeft: positionX, offsetTop: positionY } = chart.canvas;
    tooltipEl.style.opacity = 1;
    tooltipEl.style.left = positionX + tooltip.caretX + 'px';
    tooltipEl.style.top = positionY + tooltip.caretY + 'px';
    tooltipEl.style.transform = 'translate(-50%, -115%)';
};

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
        const scale = 0.3;
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL();
        thumbnailCache[videoUrl] = dataUrl; // Salva no cache
        callback(dataUrl);
        video.removeEventListener('seeked', onSeeked); // Limpa o listener
    };

    video.addEventListener('loadeddata', () => {
        video.currentTime = 1; // Pega o frame 1s
    });

    video.addEventListener('seeked', onSeeked);
};
