const express = require('express');
const path = require('path');
const fs = require('fs');
const { runScraper, closeBrowser, scrapeMomoReport } = require('./scraper');

const app = express();
const PORT = 4000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

let currentClient = null;
let isScraping = false;

app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    currentClient = res;

    const keepAlive = setInterval(() => res.write(': ping\n\n'), 20000);

    req.on('close', () => {
        clearInterval(keepAlive);
        if (currentClient === res) currentClient = null;
    });
});

function emit(type, data) {
    if (currentClient) {
        currentClient.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
    }
}

app.post('/api/start', async (req, res) => {
    if (isScraping) {
        return res.status(400).json({ error: 'Ya hay un proceso en curso.' });
    }

    const targetRating = parseInt(req.body.rating) || 5;

    isScraping = true;
    res.json({ message: 'Scraping iniciado' });

    emit('log', { message: `Iniciando extracción de reseñas de ${targetRating}★...` });

    try {
        await runScraper(
            (current, total) => emit('progress', { current, total }),
            (message) => emit('log', { message }),
            (error) => emit('error', { error }),
            targetRating
        );
        emit('done', { message: '¡Proceso completado exitosamente!' });
    } catch (err) {
        emit('error', { error: err.message });
    } finally {
        isScraping = false;
    }
});

app.post('/api/start-momo', async (req, res) => {
    if (isScraping) {
        return res.status(400).json({ error: 'Ya hay un proceso en curso.' });
    }

    const targetMonth = parseInt(req.body.month);
    const targetYear = parseInt(req.body.year);

    if (!targetMonth || !targetYear) {
        return res.status(400).json({ error: 'Falta mes o año objetivo.' });
    }

    isScraping = true;
    res.json({ message: 'Scraping de Reporte Momo iniciado' });

    emit('log', { message: `Iniciando búsqueda histórica de Momo desde ${targetMonth}/${targetYear}...` });

    try {
        await scrapeMomoReport(
            (current, total) => emit('progress', { current, total }),
            (message) => emit('log', { message }),
            (error) => emit('error', { error }),
            targetMonth,
            targetYear
        );
        emit('done', { message: '¡Extracción del reporte completada exitosamente!' });
    } catch (err) {
        emit('error', { error: err.message });
    } finally {
        isScraping = false;
    }
});

app.post('/api/stop', async (req, res) => {
    if (isScraping) {
        return res.status(400).json({ error: 'Espera a que termine la extracción actual antes de cerrar el navegador.' });
    }
    await closeBrowser();
    res.json({ message: 'Navegador cerrado correctamente.' });
});

app.get('/api/reviews', (req, res) => {
    const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
    if (fs.existsSync(REVIEWS_FILE)) {
        const data = fs.readFileSync(REVIEWS_FILE, 'utf8');
        res.json(JSON.parse(data));
    } else {
        res.json([]);
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor iniciado en http://localhost:${PORT}`);
});
