// Isolated Chromium fixture: no Next server, login, database or production calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aclass-function-ui-'));
let browser;
async function run() {
  const bundle = await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Manager from './components/admin/products/FunctionManager';createRoot(document.getElementById('root')).render(React.createElement(Manager,window.fixture));`, resolveDir: root, loader: 'jsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_BASE_URL_IMG': '""' }, plugins: [{ name: 'isolated-next', setup(build) {
    build.onResolve({ filter: /^(next\/image|next-intl)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', resolveDir: root, contents: args.path === 'next/image' ? `import React from 'react';export default function Image({unoptimized,priority,...props}){return React.createElement('img',props)}` : `export const useLocale=()=>window.fixtureLocale||'en';export const useTranslations=()=>((key,vars={})=>(window.messages[key]||key).replace(/\\{(\\w+)\\}/g,(_,k)=>vars[k]??''));` }));
  } }] });
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })).css;
  browser = await puppeteer.launch({ headless: true, userDataDir: path.join(directory, 'profile'), args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1440, height: 1000 });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.setRequestInterception(true); page.on('request', request => request.respond({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }));
  await page.setContent('<!doctype html><html lang="en"><body style="background:var(--color-bg-base);color:var(--color-text-base);padding:32px;font-family:Arial,sans-serif"><main id="root" style="max-width:1240px;margin:auto"></main></body></html>');
  await page.addStyleTag({ content: css });
  const initial = [
    { id: 'h1', name: 'addmobs', label_en: 'Mob Rain', category: 'help', sort_order: 0, default_gift_id: 5660 },
    { id: 't1', name: 'cage', label_en: 'Cage', category: 'troll', sort_order: 1 },
    { id: 'h2', name: 'removemobs', label_en: 'Herd Home', category: 'help', sort_order: 2 },
    { id: 'spin', name: 'spin', label_en: 'Spin', category: 'neutral', sort_order: 3 },
    { id: 'old', name: 'mystery', label_en: 'Mystery', category: null, sort_order: 4 },
  ].map(item => ({ product_id: 'fixture', label_th: null, image_url: null, default_gift_id: null, default_trigger_threshold: null, created_at: null, ...item }));
  await page.evaluate(({ initial, messages }) => {
    window.messages = messages; window.saved = []; window.uploadNames = []; window.uploadFailure = 'beta.png'; window.rows = initial;
    window.fixture = { productId: 'fixture', functions: initial, allGifts: [
      { id: 5660, name: 'Hand Heart', diamonds: 100, image_url: 'https://images.invalid/heart1.png', trigger_type: 'gift' },
      { id: 5924, name: 'Hand Heart', diamonds: 200, image_url: 'https://images.invalid/heart2.png', trigger_type: 'gift' },
      { id: 9000, name: 'Like', diamonds: 0, image_url: null, trigger_type: 'Like' },
    ] };
    window.confirm = () => true;
    window.fetch = async (url, options) => {
      const payload = options.body ? JSON.parse(options.body) : null; window.saved.push({ url, method: options.method, payload });
      if (url.endsWith('/reorder')) { if (window.failReorder) return { ok: false, json: async () => ({ error: 'invalid_input' }) }; return { ok: true, json: async () => ({ ok: true }) }; }
      if (url.endsWith('/bulk')) { const functions = payload.items.map((item, i) => ({ ...item, id: 'batch-' + i, sort_order: window.rows.length + i })); window.rows.push(...functions); return { ok: true, json: async () => ({ functions }) }; }
      if (options.method === 'POST') { const item = { ...payload, id: 'new-' + window.saved.length }; window.rows.push(item); return { ok: true, json: async () => item }; }
      const id = url.split('/').at(-1), old = window.rows.find(item => item.id === id), item = { ...old, ...payload };
      window.rows = window.rows.map(row => row.id === id ? item : row); return { ok: true, json: async () => item };
    };
    window.XMLHttpRequest = class {
      upload = {}; open() {} abort() { this.onabort?.(); }
      send(body) { const name = body.get('file').name; window.uploadNames.push(name); setTimeout(() => { this.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 100 }); this.status = window.uploadFailure === name ? 500 : 200; this.response = this.status === 200 ? { url: '/uploads/' + name + '.webp' } : { error: 'failed' }; this.onload?.(); }, 15); }
    };
  }, { initial, messages: JSON.parse(fs.readFileSync(path.join(root, 'messages/en.json'), 'utf8')).AdminFunctions });
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  const wait = expression => page.waitForFunction(expression);
  const click = text => page.evaluate(text => { const button = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === text && !button.disabled); if (!button) throw Error('Missing button ' + text); button.click(); }, text);
  const aria = label => page.evaluate(label => { const button = [...document.querySelectorAll('button')].find(button => button.getAttribute('aria-label') === label); if (!button) throw Error('Missing action ' + label); button.click(); }, label);
  const input = async (suffix, value) => page.evaluate(({ suffix, value }) => { const node = [...document.querySelectorAll('input,select')].find(node => node.id.endsWith(suffix)); if (!node) throw Error('Missing field ' + suffix); Object.getOwnPropertyDescriptor(node.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value').set.call(node, value); node.dispatchEvent(new Event(node.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }, { suffix, value });
  await wait('document.querySelectorAll("[data-function-id]").length===5');
  assert.equal(await page.evaluate(() => document.querySelector('[data-function-id="old"]').closest('section').textContent.includes('Not grouped yet')), true);
  const desktop = await page.evaluate(() => { const rows = ['h1', 't1'].map(id => document.querySelector(`[data-function-id="${id}"]`).closest('section').getBoundingClientRect()); return { paired: Math.abs(rows[0].top - rows[1].top) < 2, overflow: document.documentElement.scrollWidth > innerWidth }; });
  assert.ok(desktop.paired); assert.equal(desktop.overflow, false);
  await aria('Move Herd Home up in this group'); await wait('window.saved.length===1');
  assert.deepEqual(await page.evaluate(() => window.saved[0].payload.map(item => item.id)), ['h2', 't1', 'h1', 'spin', 'old']);
  await page.evaluate(() => { window.failReorder = true; }); await aria('Move Herd Home down in this group');
  await wait('!!document.querySelector("[role=alert]")');
  assert.equal(await page.evaluate(() => document.querySelector('[data-function-id="h2"]').previousElementSibling), null, 'Failed reorder restores the original category order');
  await page.evaluate(() => { window.failReorder = false; });
  await aria('Edit Mystery'); await input('-label_en', 'Existing custom name'); await click('Save');
  await wait('window.saved.length===3');
  assert.equal(await page.evaluate(() => Object.hasOwn(window.saved.at(-1).payload, 'category')), false, 'An unrelated legacy edit never guesses its category');
  await aria('Edit Existing custom name'); await input('-category', 'help'); await click('Save'); await wait('window.rows.find(item=>item.id==="old").category==="help"');
  assert.equal(await page.evaluate(() => document.querySelector('[data-function-id="old"]').closest('section').querySelector('h3').textContent.trim().startsWith('Help')), true);
  await aria('Edit Existing custom name'); await input('-name', 'spin'); await input('-label_en', 'Gacha 2'); await input('-category', 'neutral'); await click('Save');
  await wait('window.rows.find(item=>item.id==="old").name==="spin"');
  assert.equal(await page.evaluate(() => window.rows.filter(item=>item.name==='spin').length),2,'Two buttons may use the same command key');
  assert.equal(await page.evaluate(() => window.rows.find(item=>item.id==='spin').label_en),'Spin','Editing the second binding never changes the first binding');
  await page.screenshot({ path: path.join(directory, 'functions-desktop.png'), fullPage: true });
  await page.setViewport({ width: 700, height: 1000 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  await page.screenshot({ path: path.join(directory, 'functions-narrow.png'), fullPage: true });
  await page.setViewport({ width: 1440, height: 1000 });
  await aria('Add multiple to Help');
  await page.$eval('input[multiple]', node => { const files = new DataTransfer(); for (const name of ['alpha.png', 'beta.png']) files.items.add(new File([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIW2P4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='), char => char.charCodeAt(0))], name, { type: 'image/png' })); node.files = files.files; node.dispatchEvent(new Event('change', { bubbles: true })); });
  await wait('document.querySelectorAll("[data-staged-id]").length===2');
  await input('-bulk-0-name', ''); await click('Add 2 functions'); await wait('document.body.textContent.includes(window.messages.nameRequired)');
  assert.equal(await page.evaluate(() => window.uploadNames.length), 0, 'Invalid empty keys are rejected before uploading');
  await input('-bulk-0-name', 'spin'); await input('-bulk-1-name', 'spin');
  const giftInput = await page.$('[data-staged-id] input[id$="-gift"]'); await giftInput.type('5924'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  const likeInput = await page.$('[data-staged-id]:nth-child(2) input[id$="-gift"]'); await likeInput.type('9000'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  await input('-bulk-1-threshold', '30');
  await click('Add 2 functions'); await wait('document.body.textContent.includes("Some images failed")');
  assert.equal(await page.evaluate(() => window.saved.filter(call => call.url.endsWith('/bulk')).length), 0, 'Partial image upload never creates a partial function batch');
  await page.evaluate(() => { window.uploadFailure = null; }); await click('Add 2 functions'); await wait('window.saved.some(call=>call.url.endsWith("/bulk"))');
  assert.deepEqual(await page.evaluate(() => window.uploadNames), ['alpha.png', 'beta.png', 'beta.png'], 'Retry reuses successful uploads');
  const payload = await page.evaluate(() => window.saved.find(call => call.url.endsWith('/bulk')).payload.items);
  assert.equal(payload.length, 2); assert.ok(payload.every(item => item.category === 'help'));
  assert.ok(payload.every(item=>item.name==='spin'),'Bulk rows can share an existing key and each other’s key');
  assert.equal(payload[0].default_gift_id, 5924, 'Duplicate human gift names remain distinguished by canonical ID');
  assert.equal(payload[1].default_gift_id, 9000); assert.equal(payload[1].default_trigger_threshold, 30, 'Like gifts retain an allowed threshold');
  assert.equal(await page.evaluate(() => document.querySelectorAll('[data-staged-id]').length), 0);
  assert.deepEqual(errors, []);
  console.log('PASS isolated FunctionManager UI: reusable edit/bulk keys with distinct IDs, grouping/reorder rollback, canonical gift IDs, responsive layout, partial upload retry and atomic batch');
  console.log('Screenshots: ' + directory);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { if (browser) await browser.close(); });
