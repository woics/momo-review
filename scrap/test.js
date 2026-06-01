const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.google.com/maps/place/?q=place_id:ChIJKRPlY3goQg0ReZPbVi5zLk8', {waitUntil: 'networkidle2'});
    const btns = await page.$$('button');
    for(const b of btns) {
        const text = await page.evaluate(el => el.textContent, b);
        if(text && (text.includes('Aceptar') || text.includes('Accept'))) {
            await b.click();
            await new Promise(r => setTimeout(r, 2000));
            break;
        }
    }
    const rBtns = await page.$$('.F7nice, span[aria-label*="estrellas"], button[role="tab"]');
    for(const el of rBtns) {
        const text = await page.evaluate(e => e.textContent || e.getAttribute('aria-label') || '', el);
        if(text.includes('Reseñas') || text.includes('Reviews') || text.includes('estrellas')) {
            await el.click();
            await new Promise(r => setTimeout(r, 2000));
            break;
        }
    }
    await page.waitForSelector('.jftiEf', {timeout: 10000}).catch(e=>console.log(e));
    const html = await page.evaluate(() => {
        const el = document.querySelector('.jftiEf');
        return el ? el.outerHTML : 'none';
    });
    console.log(html);
    await browser.close();
})();
