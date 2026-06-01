document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const startBtn = document.getElementById('start-btn');
    const startBtnLabel = document.getElementById('start-btn-label');
    const stopBtn = document.getElementById('stop-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const startMomoBtn = document.getElementById('start-momo-btn');
    const momoMonth = document.getElementById('momo-month');
    const momoYear = document.getElementById('momo-year');
    const statusText = document.getElementById('status-text');
    const statusDot = document.getElementById('status-dot');
    const progressCount = document.getElementById('progress-count');
    const progressBar = document.getElementById('progress-bar');
    const logsContainer = document.getElementById('logs');
    const reviewsList = document.getElementById('reviews-list');
    const statTotal = document.getElementById('stat-total');
    const statFive = document.getElementById('stat-five');
    const statFour = document.getElementById('stat-four');
    const totalBadge = document.getElementById('total-badge');
    const paginationEl = document.getElementById('pagination');

    // State
    let isScraping = false;
    let eventSource = null;
    let selectedRating = 5;
    let allReviews = [];
    let filteredReviews = [];
    let currentPage = 1;
    const PAGE_SIZE = 6;
    let activeFilter = 'all';

    // Avatar colors
    const avatarColors = [
        'linear-gradient(135deg, #3b82f6, #8b5cf6)',
        'linear-gradient(135deg, #ec4899, #8b5cf6)',
        'linear-gradient(135deg, #10b981, #0891b2)',
        'linear-gradient(135deg, #f59e0b, #ef4444)',
        'linear-gradient(135deg, #06b6d4, #3b82f6)',
        'linear-gradient(135deg, #8b5cf6, #ec4899)',
    ];

    // ── Star selector ──
    document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.star-btn').forEach(b => b.className = 'star-btn');
            selectedRating = parseInt(btn.dataset.rating);
            btn.classList.add(`active-${selectedRating}`);
            startBtnLabel.textContent = `Extraer 50 Reseñas (${selectedRating}★)`;
        });
    });

    // ── Filter tabs ──
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            activeFilter = tab.dataset.filter;
            currentPage = 1;
            applyFilterAndRender();
        });
    });

    // ── Log helper ──
    function addLog(message, type = '') {
        const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
        const line = document.createElement('div');
        line.className = 'log-line';
        let msgClass = '';
        if (type === 'error') msgClass = 'err';
        else if (type === 'success') msgClass = 'info';
        else if (type === 'warn') msgClass = 'warn';
        line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-msg ${msgClass}">${message}</span>`;
        logsContainer.appendChild(line);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // ── Render helpers ──
    function buildStars(rating) {
        let html = '';
        for (let i = 1; i <= 5; i++) {
            const fill = i <= rating ? '#fbbf24' : '#334155';
            html += `<svg class="star" style="fill:${fill}" viewBox="0 0 20 20"><path d="M10 1l2.4 7.3H20l-6.2 4.5 2.4 7.3L10 15.6l-6.2 4.5 2.4-7.3L0 8.3h7.6z"/></svg>`;
        }
        return html;
    }

    function buildCard(rev) {
        const initials = rev.author.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const colorIdx = rev.author.charCodeAt(0) % avatarColors.length;
        const sentimentClass = rev.rating === 5 ? 'pos5' : 'pos4';
        const sentimentText = rev.rating === 5 ? '5★ Excelente' : '4★ Muy bueno';

        const card = document.createElement('div');
        card.className = 'review-card';
        card.innerHTML = `
            <div class="review-top">
                <div style="display:flex;align-items:center;gap:8px;overflow:hidden">
                    <div class="avatar" style="background:${avatarColors[colorIdx]};flex-shrink:0">${initials}</div>
                    <span class="review-author" title="${rev.author}">${rev.author}</span>
                </div>
                <div class="stars">${buildStars(rev.rating)}</div>
            </div>
            <p class="review-text">${rev.text}</p>
            <div class="review-meta">
                <span style="font-size:11px;color:var(--muted)">Google Reviews</span>
                <span class="sentiment ${sentimentClass}">${sentimentText}</span>
            </div>
        `;
        return card;
    }

    function applyFilterAndRender() {
        if (activeFilter === '5') filteredReviews = allReviews.filter(r => r.rating === 5);
        else if (activeFilter === '4') filteredReviews = allReviews.filter(r => r.rating === 4);
        else filteredReviews = [...allReviews];

        renderPage();
        renderPagination();
    }

    function renderPage() {
        reviewsList.innerHTML = '';

        if (filteredReviews.length === 0) {
            reviewsList.innerHTML = `<div class="empty-state"><span class="empty-icon">📁</span>No hay reseñas con este filtro todavía.</div>`;
            return;
        }

        const reversed = [...filteredReviews].reverse();
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageItems = reversed.slice(start, start + PAGE_SIZE);

        pageItems.forEach(rev => reviewsList.appendChild(buildCard(rev)));
    }

    function renderPagination() {
        paginationEl.innerHTML = '';
        const total = filteredReviews.length;
        const totalPages = Math.ceil(total / PAGE_SIZE);
        if (totalPages <= 1) return;

        const prev = document.createElement('button');
        prev.className = 'page-btn';
        prev.textContent = '← Anterior';
        prev.disabled = currentPage === 1;
        prev.addEventListener('click', () => { currentPage--; renderPage(); renderPagination(); });
        paginationEl.appendChild(prev);

        // Page numbers (show max 5 around current)
        const range = [];
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) range.push(i);
        range.forEach(p => {
            const btn = document.createElement('button');
            btn.className = `page-btn${p === currentPage ? ' current' : ''}`;
            btn.textContent = p;
            btn.addEventListener('click', () => { currentPage = p; renderPage(); renderPagination(); });
            paginationEl.appendChild(btn);
        });

        const next = document.createElement('button');
        next.className = 'page-btn';
        next.textContent = 'Siguiente →';
        next.disabled = currentPage === totalPages;
        next.addEventListener('click', () => { currentPage++; renderPage(); renderPagination(); });
        paginationEl.appendChild(next);

        const info = document.createElement('span');
        info.className = 'page-info';
        info.textContent = `Pág. ${currentPage} / ${totalPages}`;
        paginationEl.appendChild(info);
    }

    // ── Load reviews from server ──
    async function loadReviews() {
        try {
            const res = await fetch('/api/reviews');
            allReviews = await res.json();

            const fiveCount = allReviews.filter(r => r.rating === 5).length;
            const fourCount = allReviews.filter(r => r.rating === 4).length;

            statTotal.textContent = allReviews.length;
            statFive.textContent = fiveCount;
            statFour.textContent = fourCount;
            totalBadge.textContent = `${allReviews.length} en DB`;

            applyFilterAndRender();
        } catch (err) {
            console.error('Error cargando reseñas', err);
        }
    }

    // ── Start scraping ──
    startBtn.addEventListener('click', async () => {
        if (isScraping) return;
        try {
            const res = await fetch('/api/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rating: selectedRating })
            });
            if (!res.ok) {
                const data = await res.json();
                addLog(`Error: ${data.error}`, 'error');
                return;
            }

            isScraping = true;
            startBtn.disabled = true;
            statusDot.classList.add('active');
            statusText.textContent = `Extrayendo reseñas de ${selectedRating}★...`;
            progressBar.style.width = '0%';
            progressCount.textContent = '0 / 50';
            addLog(`Iniciando extracción de ${selectedRating}★...`, 'success');

            if (eventSource) eventSource.close();
            eventSource = new EventSource('/api/events');

            eventSource.addEventListener('progress', (e) => {
                const data = JSON.parse(e.data);
                const pct = Math.min((data.current / data.total) * 100, 100);
                progressBar.style.width = `${pct}%`;
                progressCount.textContent = `${data.current} / ${data.total}`;
                loadReviews();
            });

            eventSource.addEventListener('log', (e) => {
                const data = JSON.parse(e.data);
                addLog(data.message);
            });

            eventSource.addEventListener('error', (e) => {
                const data = JSON.parse(e.data);
                addLog(data.error, 'error');
                finishScraping('Error en el proceso');
            });

            eventSource.addEventListener('done', (e) => {
                addLog('¡Extracción completada exitosamente! ✓', 'success');
                finishScraping(`En espera — Navegador activo (${selectedRating}★)`);
                loadReviews();
            });

        } catch (err) {
            addLog('Fallo al conectar con el servidor', 'error');
        }
    });

    // ── Start Momo Scraping ──
    if (startMomoBtn) {
        // Set current month default
        const now = new Date();
        momoMonth.value = now.getMonth() + 1; // 1-12
        momoYear.value = now.getFullYear();

        startMomoBtn.addEventListener('click', async () => {
            if (isScraping) return;
            const targetMonth = momoMonth.value;
            const targetYear = momoYear.value;
            
            try {
                const res = await fetch('/api/start-momo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ month: targetMonth, year: targetYear })
                });
                if (!res.ok) {
                    const data = await res.json();
                    addLog(`Error: ${data.error}`, 'error');
                    return;
                }

                isScraping = true;
                startBtn.disabled = true;
                startMomoBtn.disabled = true;
                statusDot.classList.add('active');
                statusText.textContent = `Extrayendo histórico de Momo desde ${targetMonth}/${targetYear}...`;
                progressBar.style.width = '0%';
                progressCount.textContent = 'Buscando...';
                addLog(`Iniciando búsqueda histórica (Mes ${targetMonth}/${targetYear})...`, 'success');

                if (eventSource) eventSource.close();
                eventSource = new EventSource('/api/events');

                eventSource.addEventListener('progress', (e) => {
                    const data = JSON.parse(e.data);
                    progressBar.style.width = `100%`;
                    progressCount.textContent = `${data.current} reseñas de Momo`;
                });

                eventSource.addEventListener('log', (e) => {
                    const data = JSON.parse(e.data);
                    addLog(data.message);
                });

                eventSource.addEventListener('error', (e) => {
                    const data = JSON.parse(e.data);
                    addLog(data.error, 'error');
                    finishScraping('Error en el proceso');
                });

                eventSource.addEventListener('done', (e) => {
                    addLog('¡Extracción de Momo completada exitosamente! ✓', 'success');
                    finishScraping(`En espera — Navegador activo (Momo)`);
                });

            } catch (err) {
                addLog('Fallo al conectar con el servidor', 'error');
            }
        });
    }

    // ── Stop / close browser ──
    stopBtn.addEventListener('click', async () => {
        try {
            const res = await fetch('/api/stop', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                addLog(data.message, 'success');
                finishScraping('Navegador cerrado');
                progressBar.style.width = '0%';
                progressCount.textContent = '0 / 0';
            } else {
                addLog(`Error: ${data.error}`, 'error');
            }
        } catch (err) {
            addLog('Error al intentar cerrar el navegador.', 'error');
        }
    });

    function finishScraping(msg) {
        if (eventSource) { eventSource.close(); eventSource = null; }
        isScraping = false;
        startBtn.disabled = false;
        if(startMomoBtn) startMomoBtn.disabled = false;
        statusText.textContent = msg;
        statusDot.classList.remove('active');
    }

    refreshBtn.addEventListener('click', loadReviews);

    // Initial load
    loadReviews();
});
