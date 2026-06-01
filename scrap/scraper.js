const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const PLACE_ID = 'ChIJKRPlY3goQg0ReZPbVi5zLk8';
const TARGET_REVIEWS = 50;
const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const MOMO_REVIEWS_FILE = path.join(__dirname, 'momo-reviews.json');

// Estado global para mantener el navegador persistente
let browser = null;
let activePage = null;
let lastRating = null; // Para saber si cambió el filtro y hay que reabrir el navegador

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
        activePage = null;
        lastRating = null;
    }
}

async function runScraper(emitProgress, emitLog, emitError, targetRating = 5) {
    let existingReviews = [];
    if (fs.existsSync(REVIEWS_FILE)) {
        const data = fs.readFileSync(REVIEWS_FILE, 'utf8');
        try {
            existingReviews = JSON.parse(data);
        } catch (e) {
            existingReviews = [];
        }
        emitLog(`Base de datos cargada. Reseñas guardadas hasta ahora: ${existingReviews.length}`);
    }

    function isDuplicate(review) {
        return existingReviews.some(
            (r) => r.author === review.author && 
                   r.text.substring(0, 30) === review.text.substring(0, 30)
        );
    }

    try {
        // Si cambió el rating buscado, hay que reiniciar el navegador para ir a un filtro distinto
        if (lastRating !== null && lastRating !== targetRating) {
            emitLog(`Cambiando filtro de ${lastRating}★ a ${targetRating}★. Reiniciando navegador...`);
            await closeBrowser();
        }

        if (!browser || !activePage) {
            lastRating = targetRating;
            emitLog(`Iniciando nueva instancia del navegador (buscando ${targetRating}★)...`);
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage',
                    '--window-size=1280,800'
                ],
                defaultViewport: { width: 1280, height: 800 },
            });
            activePage = await browser.newPage();
            
            const url = `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`;
            emitLog(`Navegando al restaurante...`);
            await activePage.goto(url, { waitUntil: 'networkidle2' });

            emitLog('Esperando a que cargue la interfaz...');
            await new Promise(r => setTimeout(r, 4000));

            // Saltar aviso de Cookies de Google
            try {
                const buttons = await activePage.$$('button');
                for (const btn of buttons) {
                    const text = await activePage.evaluate(el => el.textContent, btn);
                    if (text && (text.includes('Aceptar todo') || text.includes('Rechazar todo') || text.includes('Accept all') || text.includes('Reject all'))) {
                        emitLog('Saltando pantalla de privacidad/cookies...');
                        await btn.click();
                        await new Promise(r => setTimeout(r, 4000)); 
                        break;
                    }
                }
            } catch (e) {}

            const tabs = await activePage.$$('button[role="tab"]');
            let clicked = false;
            for (const tab of tabs) {
                const text = await activePage.evaluate(el => el.textContent, tab);
                if (text.includes('Reseñas') || text.includes('Reviews')) {
                    await tab.click();
                    clicked = true;
                    emitLog('Entrando en la sección de reseñas...');
                    break;
                }
            }

            if (!clicked) {
                emitLog('Pestaña no encontrada, intentando hacer clic en la calificación...');
                const ratingElements = await activePage.$$('.F7nice, span[aria-label*="estrellas"], span[aria-label*="stars"]');
                for(const el of ratingElements) {
                    try {
                        await el.click();
                        clicked = true;
                        emitLog('Entrando en la sección de reseñas (haciendo clic en las estrellas)...');
                        await new Promise(r => setTimeout(r, 3000));
                        break;
                    } catch(e) {}
                }
            }
            
            if (!clicked) throw new Error('No se encontró la pestaña de reseñas.');
            await new Promise(r => setTimeout(r, 3000));

            // Aplicar filtro por número de estrellas
            emitLog(`Aplicando filtro de ${targetRating} estrellas...`);
            const filtered = await activePage.evaluate((rating) => {
                // Buscamos los botones de filtro de estrellas
                const allButtons = Array.from(document.querySelectorAll('button'));
                const starBtn = allButtons.find(b => {
                    const label = b.getAttribute('aria-label') || b.textContent || '';
                    return label.includes(`${rating} estrellas`) || label.includes(`${rating} stars`) || label.includes(`${rating} star`);
                });
                if (starBtn) {
                    starBtn.click();
                    return true;
                }
                return false;
            }, targetRating);

            if (filtered) {
                emitLog(`Filtro de ${targetRating}★ aplicado con éxito.`);
                await new Promise(r => setTimeout(r, 3000));
            } else {
                emitLog(`Filtro de ${targetRating}★ no encontrado. Extrayendo todas y filtrando manualmente...`);
            }

        } else {
            emitLog(`Usando el navegador ya abierto. Reanudando extracción de ${targetRating}★...`);
        }

        let newReviewsCollected = [];
        let previousCount = 0;
        let retries = 0;

        emitLog(`Objetivo: Extraer ${TARGET_REVIEWS} NUEVAS reseñas de ${targetRating}★.`);

        while (newReviewsCollected.length < TARGET_REVIEWS) {
            
            // 1. Expandir textos PRIMERO (clic en botones "Más")
            await activePage.evaluate(() => {
                const moreButtons = document.querySelectorAll('button.w8nwRe.kyuRq');
                moreButtons.forEach(btn => {
                    if(btn.textContent.includes('Más') || btn.textContent.includes('More')) {
                        btn.click();
                    }
                });
            });
            await new Promise(r => setTimeout(r, 500));

            const reviewsInDOM = await activePage.evaluate((rating) => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                let data = [];
                reviewElements.forEach((el) => {
                    const authorEl = el.querySelector('.d4r55'); 
                    const author = authorEl ? authorEl.textContent.trim() : 'Anónimo';
                    const starSpan = el.querySelector('.kvMYJc');
                    let reviewRating = 0;
                    if (starSpan && starSpan.getAttribute('aria-label')) {
                        const ariaLabel = starSpan.getAttribute('aria-label');
                        // Extraer número de estrellas del aria-label
                        const match = ariaLabel.match(/(\d)/);
                        if (match) reviewRating = parseInt(match[1]);
                    }
                    let text = '';
                    const customerDiv = el.querySelector('.MyEned');
                    if (customerDiv) {
                        const tEl = customerDiv.querySelector('.wiI7pd');
                        text = tEl ? tEl.textContent.trim() : customerDiv.textContent.trim();
                    } else {
                        const tEl = el.querySelector('.wiI7pd');
                        if (tEl) {
                            text = tEl.textContent.trim();
                        }
                    }

                    if (/^¡?Hola/i.test(text) && (text.includes('gracias') || text.includes('restaurante'))) {
                        text = ''; 
                    }
                    if (reviewRating === rating && text.length > 5) {
                        data.push({ author, rating: reviewRating, text, scraped_at: new Date().toISOString() });
                    }
                });
                return data;
            }, targetRating);

            let addedInThisCheck = 0;
            for (const rev of reviewsInDOM) {
                if (!isDuplicate(rev) && !newReviewsCollected.some(r => r.author === rev.author && r.text.substring(0, 30) === rev.text.substring(0, 30))) {
                    newReviewsCollected.push(rev);
                    addedInThisCheck++;
                    emitProgress(newReviewsCollected.length, TARGET_REVIEWS);
                    if (newReviewsCollected.length >= TARGET_REVIEWS) break;
                }
            }

            if (newReviewsCollected.length >= TARGET_REVIEWS) break;

            // Si existe el botón "Más opiniones", entrar a la lista completa
            const clickedMasOpiniones = await activePage.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button'));
                const masBtn = buttons.find(b => b.textContent.includes('Más opiniones') || b.textContent.includes('More reviews'));
                if (masBtn) { masBtn.click(); return true; }
                return false;
            });

            if (clickedMasOpiniones) {
                emitLog('Entrando a la lista completa de opiniones...');
                await new Promise(r => setTimeout(r, 3000));
            }

            // Scroll con DOM Tree Walking
            await activePage.evaluate(() => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                if (reviewElements.length > 0) {
                    const lastReview = reviewElements[reviewElements.length - 1];
                    let parent = lastReview.parentElement;
                    while (parent && parent !== document.body) {
                        const style = window.getComputedStyle(parent);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowY === 'overlay') {
                            parent.scrollBy(0, 4000);
                            break;
                        }
                        parent = parent.parentElement;
                    }
                    lastReview.scrollIntoView();
                }
            });
            
            await activePage.keyboard.press('PageDown');
            await activePage.keyboard.press('PageDown');

            emitLog('Haciendo scroll para buscar más resultados...');
            await new Promise(r => setTimeout(r, 3500));

            const currentCount = await activePage.evaluate(() => document.querySelectorAll('.jftiEf').length);

            if (currentCount === previousCount && addedInThisCheck === 0) {
                retries++;
                if (retries > 4) {
                    emitLog('Ya no cargan más reseñas o hemos llegado al final de la lista.');
                    break;
                }
            } else {
                retries = 0;
                previousCount = currentCount;
            }
        }

        if (newReviewsCollected.length > 0) {
            existingReviews = existingReviews.concat(newReviewsCollected);
            fs.writeFileSync(REVIEWS_FILE, JSON.stringify(existingReviews, null, 2));
            emitLog(`✓ Guardadas ${newReviewsCollected.length} reseñas nuevas de ${targetRating}★.`);
        } else {
            emitLog('No se encontraron reseñas nuevas en esta pasada.');
        }

    } catch (err) {
        emitError(err.message);
    }
}

// Helper para convertir "hace X semanas/meses" en una fecha aproximada
function parseRelativeDate(text) {
    const now = new Date();
    if (!text) return now;
    const match = text.match(/hace (\d+)\s+(d[ií]a|semana|mes|año)s?/i);
    if (!match) {
        // En algunos casos dice "hace un día" o "hace un mes"
        if (text.includes('un día')) now.setDate(now.getDate() - 1);
        else if (text.includes('una semana')) now.setDate(now.getDate() - 7);
        else if (text.includes('un mes')) now.setMonth(now.getMonth() - 1);
        else if (text.includes('un año')) now.setFullYear(now.getFullYear() - 1);
        return now;
    }
    const amount = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    
    if (unit.startsWith('d')) now.setDate(now.getDate() - amount);
    else if (unit.startsWith('semana')) now.setDate(now.getDate() - (amount * 7));
    else if (unit.startsWith('mes')) now.setMonth(now.getMonth() - amount);
    else if (unit.startsWith('año')) now.setFullYear(now.getFullYear() - amount);
    
    return now;
}

async function scrapeMomoReport(emitProgress, emitLog, emitError, targetMonth, targetYear) {
    let existingMomo = [];
    if (fs.existsSync(MOMO_REVIEWS_FILE)) {
        try { existingMomo = JSON.parse(fs.readFileSync(MOMO_REVIEWS_FILE, 'utf8')); } 
        catch (e) { existingMomo = []; }
    }

    try {
        if (!browser || !activePage || lastRating !== 'momo') {
            lastRating = 'momo';
            emitLog(`Iniciando navegador para Reporte Momo (${targetMonth}/${targetYear})...`);
            await closeBrowser();
            browser = await puppeteer.launch({
                headless: true,
                args: [ '--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--window-size=1280,800' ],
                defaultViewport: { width: 1280, height: 800 },
            });
            activePage = await browser.newPage();
            
            const url = `https://www.google.com/maps/place/?q=place_id:${PLACE_ID}`;
            emitLog(`Navegando a Google Maps...`);
            await activePage.goto(url, { waitUntil: 'networkidle2' });
            await new Promise(r => setTimeout(r, 4000));

            // Saltar cookies
            try {
                const buttons = await activePage.$$('button');
                for (const btn of buttons) {
                    const text = await activePage.evaluate(el => el.textContent, btn);
                    if (text && (text.includes('Aceptar') || text.includes('Accept'))) {
                        await btn.click();
                        await new Promise(r => setTimeout(r, 4000)); 
                        break;
                    }
                }
            } catch (e) {}

            // Clic en reseñas (aquí no filtramos estrellas, leemos TODAS)
            const ratingElements = await activePage.$$('.F7nice, span[aria-label*="estrellas"], span[aria-label*="stars"], button[role="tab"]');
            for(const el of ratingElements) {
                try {
                    const text = await activePage.evaluate(el => el.textContent || el.getAttribute('aria-label') || '', el);
                    if(text.includes('Reseñas') || text.includes('Reviews') || text.includes('estrellas')) {
                        await el.click();
                        await new Promise(r => setTimeout(r, 3000));
                        break;
                    }
                } catch(e) {}
            }

            // Ordenar por Más Recientes
            emitLog('Ordenando por "Más recientes"...');
            await activePage.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button'));
                const sortBtn = btns.find(b => b.textContent.includes('Ordenar') || b.textContent.includes('Sort'));
                if(sortBtn) sortBtn.click();
            });
            await new Promise(r => setTimeout(r, 1000));
            await activePage.evaluate(() => {
                const menus = Array.from(document.querySelectorAll('div[role="menuitemradio"]'));
                const newestBtn = menus.find(m => m.textContent.includes('recientes') || m.textContent.includes('newest'));
                if(newestBtn) newestBtn.click();
            });
            await new Promise(r => setTimeout(r, 3000));
        }

        let newMomoCollected = [];
        let previousCount = 0;
        let retries = 0;
        let reachedTargetDate = false;

        const targetDateStart = new Date(targetYear, targetMonth - 1, 1);
        emitLog(`Buscando reseñas de "Momo" desde ${targetMonth}/${targetYear} en adelante...`);

        while (!reachedTargetDate && retries <= 15) {
            // Expandir textos
            await activePage.evaluate(() => {
                document.querySelectorAll('button.w8nwRe.kyuRq').forEach(btn => {
                    if(btn.textContent.includes('Más') || btn.textContent.includes('More')) btn.click();
                });
            });
            await new Promise(r => setTimeout(r, 500));

            const reviewsInDOM = await activePage.evaluate(() => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                let data = [];
                reviewElements.forEach((el) => {
                    const author = el.querySelector('.d4r55') ? el.querySelector('.d4r55').textContent.trim() : 'Anónimo';
                    const starSpan = el.querySelector('.kvMYJc');
                    let rating = 0;
                    if (starSpan && starSpan.getAttribute('aria-label')) {
                        const match = starSpan.getAttribute('aria-label').match(/(\d)/);
                        if (match) rating = parseInt(match[1]);
                    }
                    let text = '';
                    const customerDiv = el.querySelector('.MyEned');
                    if (customerDiv) {
                        const tEl = customerDiv.querySelector('.wiI7pd');
                        text = tEl ? tEl.textContent.trim() : customerDiv.textContent.trim();
                    } else {
                        const tEl = el.querySelector('.wiI7pd');
                        if (tEl) {
                            text = tEl.textContent.trim();
                        }
                    }

                    if (/^¡?Hola/i.test(text) && (text.includes('gracias') || text.includes('restaurante'))) {
                        text = ''; 
                    }
                    const dateText = el.querySelector('.rsqaWe') ? el.querySelector('.rsqaWe').textContent.trim() : '';
                    
                    // Extraer ID del autor para construir la URL directa a la reseña
                    let authorUrl = '';
                    const authorBtn = el.querySelector('.al6Kxe');
                    if (authorBtn) {
                        authorUrl = authorBtn.getAttribute('data-href') || authorBtn.href || '';
                    }
                    let reviewUrl = 'https://www.google.com/maps/place/?q=place_id:ChIJKRPlY3goQg0ReZPbVi5zLk8'; // fallback
                    const authorIdMatch = authorUrl.match(/\/contrib\/([0-9]+)/);
                    if (authorIdMatch) {
                        reviewUrl = `https://www.google.com/maps/contrib/${authorIdMatch[1]}/place/ChIJKRPlY3goQg0ReZPbVi5zLk8`;
                    }

                    data.push({ author, rating, text, dateText, reviewUrl });
                });
                return data;
            });

            let added = 0;
            let indicesToKeep = new Set();
            let momoIndices = new Set();

            for (let i = 0; i < reviewsInDOM.length; i++) {
                const rev = reviewsInDOM[i];
                if (rev.text.length > 5 && /momo/i.test(rev.text)) {
                    momoIndices.add(i);
                    indicesToKeep.add(i);
                    // Agregar 3 arriba y 3 abajo
                    for (let j = 1; j <= 3; j++) {
                        if (i - j >= 0) indicesToKeep.add(i - j);
                        if (i + j < reviewsInDOM.length) indicesToKeep.add(i + j);
                    }
                }
            }

            // Si el último elemento cargado en el DOM ya es anterior a la fecha límite, terminamos de hacer scroll.
            if (reviewsInDOM.length > 0) {
                const lastRev = reviewsInDOM[reviewsInDOM.length - 1];
                const lastParsedDate = parseRelativeDate(lastRev.dateText);
                if (lastParsedDate < targetDateStart) {
                    reachedTargetDate = true;
                    emitLog(`El último elemento en el DOM (${lastRev.dateText}) ya superó la fecha límite de ${targetMonth}/${targetYear}. Deteniendo scroll de forma optimizada.`);
                }
            }

            // Convertir set a array y ordenar para mantener el orden cronológico
            const sortedIndices = Array.from(indicesToKeep).sort((a, b) => a - b);

            for (const i of sortedIndices) {
                const rev = reviewsInDOM[i];
                const parsedDate = parseRelativeDate(rev.dateText);
                
                if (momoIndices.has(i) && parsedDate < targetDateStart) {
                    reachedTargetDate = true;
                }

                let isMomo = momoIndices.has(i);
                
                // Si no me menciona, solo guardar si es de 4 o 5 estrellas y si no nombra a compañeros
                if (!isMomo) {
                    if (rev.rating < 4) continue;
                    
                    // Excluir si la reseña contiene el nombre de algún otro compañero
                    const otherStaffRegex = /\b(jes[uú]s|daniela|fernando|jos[eé]\s*manuel|jos[eé]|manuel)\b/i;
                    if (otherStaffRegex.test(rev.text)) {
                        continue;
                    }
                }

                // Evitar duplicados exactos
                const isDupLocal = newMomoCollected.some(r => r.author === rev.author && r.text === rev.text);
                const isDupGlobal = existingMomo.some(r => r.author === rev.author && r.text === rev.text);
                
                if (!isDupLocal && !isDupGlobal) {
                    newMomoCollected.push({
                        author: rev.author,
                        rating: rev.rating,
                        text: rev.text,
                        scraped_at: parsedDate.toISOString(),
                        reviewUrl: rev.reviewUrl,
                        isIndirect: !isMomo
                    });
                    if (isMomo) added++; // Solo contamos las directas para la lógica de reintentos de scroll
                    emitProgress(newMomoCollected.length, "??");
                }
            }

            if (reachedTargetDate) {
                emitLog(`Se alcanzó el mes límite (${targetMonth}/${targetYear}). Extracción finalizada.`);
                break;
            }

            // Scroll down
            await activePage.evaluate(() => {
                const reviewElements = document.querySelectorAll('.jftiEf');
                if (reviewElements.length > 0) {
                    const lastReview = reviewElements[reviewElements.length - 1];
                    let parent = lastReview.parentElement;
                    while (parent && parent !== document.body) {
                        const style = window.getComputedStyle(parent);
                        if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
                            parent.scrollBy(0, 4000); break;
                        }
                        parent = parent.parentElement;
                    }
                    lastReview.scrollIntoView();
                }
            });
            await activePage.keyboard.press('PageDown');
            await activePage.keyboard.press('PageDown');
            
            emitLog(`Scroll... (encontradas ${newMomoCollected.length} reseñas de Momo hasta ahora)`);
            await new Promise(r => setTimeout(r, 3500));

            const currentCount = await activePage.evaluate(() => document.querySelectorAll('.jftiEf').length);
            if (currentCount === previousCount && added === 0) retries++;
            else { retries = 0; previousCount = currentCount; }
        }

        if (newMomoCollected.length > 0) {
            existingMomo = existingMomo.concat(newMomoCollected);
            fs.writeFileSync(MOMO_REVIEWS_FILE, JSON.stringify(existingMomo, null, 2));
            emitLog(`✓ Guardadas ${newMomoCollected.length} reseñas de Momo (total histórico: ${existingMomo.length}).`);
        } else {
            emitLog('No se encontraron reseñas nuevas de Momo en este periodo.');
        }

    } catch (err) {
        emitError(err.message);
    }
}

module.exports = { runScraper, closeBrowser, scrapeMomoReport };
