const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const base = process.env.LOCALE_TEST_URL || 'http://127.0.0.1:3108';
async function main() {
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);
    await page.setViewport({ width: 1366, height: 900 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' && /MISSING_MESSAGE|INVALID_MESSAGE|FORMATTING_ERROR|IntlError/.test(message.text())) errors.push(message.text()); });
    for (const [locale, code, target] of [['ko', 'KR', 'Tiếng Việt'], ['vi', 'VN', '한국어']]) {
      const catalog = JSON.parse(fs.readFileSync(`messages/${locale}.json`, 'utf8'));
      for (const route of ['', '/products', '/faq', '/privacy', '/login']) {
        const response = await page.goto(`${base}/${locale}${route}`, { waitUntil: 'domcontentloaded' });
        assert.equal(response.status(), 200, `${locale}${route}`);
        const heading = route === '/faq' ? catalog.Faq.title : route === '/privacy' ? catalog.Privacy.title : route === '/login' ? catalog.Login.welcome : route === '/products' ? catalog.Shop.title : catalog.Home.hero_badge;
        await page.waitForFunction(({ heading, locale }) => document.body.innerText.toLocaleLowerCase(locale).includes(heading.toLocaleLowerCase(locale)), {}, { heading, locale });
        assert.equal(await page.$eval('html', el => el.lang), locale);
        const body = await page.$eval('body', el => el.innerText);
        assert.ok(locale === 'ko' ? /[가-힣]/.test(body) : /[ăâđêôơưĂÂĐÊÔƠƯ]/.test(body), `${locale}${route}: translated content`);
        assert.ok(!body.includes('MISSING_MESSAGE'), `${locale}${route}: missing messages`);
        if (heading) assert.ok(body.toLocaleLowerCase(locale).includes(heading.toLocaleLowerCase(locale)), `${locale}${route}: page heading must be translated: ${JSON.stringify(heading)}`);
        if (!route) assert.equal(await page.title(), catalog.Meta.title);
      }
      await page.goto(`${base}/${locale}/products?slug=test&ref=KEEP#catalog`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(code => [...document.querySelectorAll('button')].some(el => el.textContent.trim() === code), {}, code);
      const button = await page.evaluateHandle(code => [...document.querySelectorAll('button')].find(el => el.textContent.trim() === code), code);
      assert.ok(button.asElement(), `${locale}: language menu button`);
      await button.asElement().click();
      await page.waitForFunction(target => [...document.querySelectorAll('button')].some(el => el.textContent.includes(target)), {}, target);
      const option = await page.evaluateHandle(target => [...document.querySelectorAll('button')].find(el => el.textContent.includes(target)), target);
      await option.asElement().click();
      await page.waitForFunction(expected => document.documentElement.lang === expected, {}, locale === 'ko' ? 'vi' : 'ko');
      assert.equal(new URL(page.url()).searchParams.get('ref'), 'KEEP');
      assert.equal(new URL(page.url()).searchParams.get('slug'), 'test');
      assert.equal(new URL(page.url()).hash, '#catalog');
      await page.setViewport({ width: 390, height: 844 });
      await page.goto(`${base}/${locale}`, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(locale => document.documentElement.lang === locale && document.querySelector('main'), {}, locale);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), `${locale}: mobile overflow`);
      await page.setViewport({ width: 1366, height: 900 });
      console.log(`PASS ${locale}: five pages, metadata, menu switching with query/hash, mobile layout`);
    }
    assert.deepEqual(errors, [], 'Browser runtime errors');
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
