const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

(async () => {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    await page.goto('https://www.google.com/maps/place/?q=place_id:ChIJKRPlY3goQg0ReZPbVi5zLk8', {waitUntil: 'networkidle2'});
    await new Promise(r => setTimeout(r, 4000));
    try {
        const btns = await page.$$('button');
        for (let b of btns) {
            let t = await page.evaluate(el => el.textContent, b);
            if (t && t.includes('Aceptar')) { await b.click(); await new Promise(r => setTimeout(r, 2000)); break; }
        }
    } catch(e){}
    try {
        const tabs = await page.$$('button[role="tab"]');
        for (let t of tabs) {
            let txt = await page.evaluate(el => el.textContent, t);
            if (txt.includes('Reseñas') || txt.includes('Reviews')) {
                await t.click();
                await new Promise(r => setTimeout(r, 3000));
                break;
            }
        }
    } catch(e){}
    const reviews = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.jftiEf')).slice(0, 5).map(el => {
            const customer = el.querySelector('.MyEned .wiI7pd');
            const owner = el.querySelector('.CDe7pd .wiI7pd');
            const allWiI = Array.from(el.querySelectorAll('.wiI7pd')).map(w => ({
                text: w.textContent,
                parentClass: w.parentElement.className,
                grandParentClass: w.parentElement.parentElement.className
            }));
            return {
                author: el.querySelector('.d4r55') ? el.querySelector('.d4r55').textContent : '',
                customerText: customer ? customer.textContent : null,
                ownerText: owner ? owner.textContent : null,
                allWiI
            };
        });
    });
    console.log(JSON.stringify(reviews, null, 2));
    await browser.close();
})();
