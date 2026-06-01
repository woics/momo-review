const fs = require('fs');
const path = require('path');
const { scrapeMomoReport, closeBrowser } = require('./scraper.js');

const dbPath = path.join(__dirname, 'momo-reviews.json');
if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('Base de datos anterior eliminada.');
}

console.log('Iniciando scraper completo (desde 2020)...');

scrapeMomoReport(
    (count) => console.log('Progreso:', count),
    (log) => console.log('Log:', log),
    (err) => console.error('Error:', err),
    5, 2026
).then(() => {
    console.log('Scraping completado.');
    return closeBrowser();
}).then(() => {
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
