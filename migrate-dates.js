/**
 * migrate-dates.js
 * Adds scraped_at field to existing reviews that don't have one.
 * Run once: node migrate-dates.js
 */
const fs = require('fs');
const path = require('path');

const REVIEWS_FILE = path.join(__dirname, 'reviews.json');
const today = new Date().toISOString();

const reviews = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
let updated = 0;

const migrated = reviews.map(r => {
    if (!r.scraped_at) {
        updated++;
        return { ...r, scraped_at: today };
    }
    return r;
});

fs.writeFileSync(REVIEWS_FILE, JSON.stringify(migrated, null, 2));
console.log(`✅ Migración completa. ${updated} reseñas actualizadas con fecha de hoy.`);
