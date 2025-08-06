// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://mckpavgreddulcvrlmeg.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1ja3BhdmdyZWRkdWxjdnJsbWVnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNzM4NDYsImV4cCI6MjA2OTc0OTg0Nn0.lAdWj9343aJVy5H6No6yV13Fihqlp0g_ucBTQc3ToWg';
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

// --- 2. SELETORES DO DOM ---
const userEmailDisplay = document.getElementById('user-email-display');
const logoutButton = document.getElementById('logout-button');
const sessionInfo = document.getElementById('session-info');
const timelineContainer = document.getElementById('timeline-container');

// --- 3. LÓGICA DA PÁGINA ---
document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se o usuário está logado
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
        window.location.replace('index.html');
        return;
    }
    
    // Mostra informações do usuário
    userEmailDisplay.textContent = session.user.email;
    logoutButton.addEventListener('click', () => supabaseClient.auth.signOut());
    
    // Pega o timestamp da sessão a partir da URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionTimestamp = urlParams.get('session');
    
    if (!sessionTimestamp) {
        sessionInfo.textContent = "ID da sessão não encontrado.";
        return;
    }
    
    sessionInfo.textContent = `Exibindo análise para a sessão iniciada em: ${new Date(sessionTimestamp * 1000).toLocaleString('pt-BR')}`;
    
    carregarTimeline(sessionTimestamp, session.user.email);
});

async function carregarTimeline(timestamp, userEmail) {
    const sanitizedEmail = userEmail.replace(/[@.]/g, '_');
    const fileNamePrefix = `${timestamp}_${sanitizedEmail}_`;

    // Busca todos os vídeos concluídos para esta sessão
    const { data: videos, error } = await supabaseClient
        .from('analise_videos')
        .select('*')
        .like('nome_arquivo', `${fileNamePrefix}%`) // Filtra pela sessão
        .order('nome_arquivo', { ascending: true }); // Ordena os chunks

    if (error) {
        timelineContainer.innerHTML = `<p>Erro ao buscar dados: ${error.message}</p>`;
        return;
    }

    if (!videos || videos.length === 0) {
        timelineContainer.innerHTML = `<p>Nenhum resultado de análise encontrado ainda. O processamento pode levar alguns minutos. Tente atualizar a página em breve.</p>`;
        // Recarregar automaticamente a cada 30 segundos
        setTimeout(() => window.location.reload(), 30000);
        return;
    }

    timelineContainer.innerHTML = ''; // Limpa a mensagem de "Carregando..."

    // Constrói a timeline
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
