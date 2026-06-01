const puppeteer = require('puppeteer');
const fs = require('fs');
(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.google.com/maps/place/?q=place_id:ChIJKRPlY3goQg0ReZPbVi5zLk8', {waitUntil: 'networkidle2'});
    await new Promise(r => setTimeout(r, 6000));
    
    // Clic en reseñas
    const rBtns = await page.$$('.F7nice, span[aria-label*="estrellas"], button[role="tab"]');
    for(const el of rBtns) {
        const text = await page.evaluate(e => e.textContent || e.getAttribute('aria-label') || '', el);
        if(text.includes('Reseñas') || text.includes('Reviews') || text.includes('estrellas')) {
            await el.click();
            await new Promise(r => setTimeout(r, 3000));
            break;
        }
    }
    
    const html = await page.evaluate(() => {
        const el = document.querySelector('.jftiEf');
        return el ? el.outerHTML : 'none';
    });
    fs.writeFileSync('review_dom.html', html);
    await browser.close();
})();
