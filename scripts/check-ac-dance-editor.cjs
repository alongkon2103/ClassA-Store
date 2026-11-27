// Exercise the real admin controls without accounts, writes, or a running shop.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.codex/ac-dance-api/ui');
async function run() {
  const bundle = await esbuild.build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Editor from './components/admin/products/GameEffectEditor';let n=0;const root=createRoot(document.getElementById('root'));window.mount=(effect=null,interactive=true,platform='roblox',th=false)=>{window.kept=null;root.render(React.createElement(Editor,{key:++n,effect,interactive,platform,th,onKeep:v=>window.kept=v,onCancel:()=>{}}))};window.mount();`, resolveDir: root, loader: 'jsx' }, bundle: true, write: false, format: 'iife', platform: 'browser', define: { 'process.env.NODE_ENV': '"development"' } });
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setContent('<!doctype html><html><body style="background:#070d18;color:white;font-family:Arial;padding:16px"><main id="root" style="max-width:640px;margin:auto"></main></body></html>');
    const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(path.join(root, 'app/globals.css'), 'utf8'), { from: path.join(root, 'app/globals.css') })).css;
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    await page.waitForSelector('[data-testid=roblox-event]');
    assert.equal(await page.$$eval('[data-testid=roblox-input]', nodes => nodes.length), 1, 'API command offers an optional input selector');
    assert.equal(await page.$eval('[data-testid=roblox-input]', node => node.value), '');
    assert.deepEqual(await page.$$eval('[data-testid=roblox-input] option', nodes => nodes.map(node => node.textContent)), ['None', 'Roblox username from chat', 'Chat text']);
    const keep = async () => { await page.$$eval('button', buttons => buttons.find(button => /^(Keep event|เก็บอีเวนต์)$/.test(button.textContent.trim())).click()); await page.waitForFunction('window.kept!==null'); return page.evaluate(() => window.kept); };
    await page.type('[data-testid=effect-name]', 'Join Dance');
    await page.type('[data-testid=roblox-event]', 'JoinDance');
    await page.select('[data-testid=roblox-input]', 'robloxUsername');
    fs.mkdirSync(output, { recursive: true });
    for (const width of [1280, 390]) {
      await page.setViewport({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Input selector fits narrow and wide layouts');
      await page.screenshot({ path: path.join(output, `input-${width}.png`), fullPage: true });
    }
    const typed = await keep();
    assert.deepEqual(typed.responses, [{ type: 'robloxEvent', event: 'JoinDance', input: 'robloxUsername' }]);
    await page.evaluate(effect => window.mount(effect), typed);
    await page.waitForFunction("document.querySelector('[data-testid=roblox-input]')?.value==='robloxUsername'");
    await page.select('[data-testid=roblox-input]', 'chatText');
    const typedChat = await keep();
    assert.deepEqual(typedChat.responses, [{ type: 'robloxEvent', event: 'JoinDance', input: 'chatText' }]);
    await page.evaluate(effect => window.mount(effect), typedChat);
    await page.waitForFunction("document.querySelector('[data-testid=roblox-input]')?.value==='chatText'");
    await page.select('[data-testid=roblox-input]', '');
    assert.deepEqual((await keep()).responses, [{ type: 'robloxEvent', event: 'JoinDance' }], 'Choosing None removes the optional field entirely');
    await page.evaluate(effect => window.mount({ ...effect, responses: [{ type: 'robloxEvent', event: 'Rose' }] }), typed);
    await page.waitForFunction("document.querySelector('[data-testid=roblox-event]')?.value==='Rose'");
    assert.deepEqual((await keep()).responses, [{ type: 'robloxEvent', event: 'Rose' }], 'Editing a legacy command does not add input metadata');
    await page.evaluate(effect => window.mount({ ...effect, responses: [...effect.responses, { type: 'delay', ms: 50 }] }), typed);
    await page.waitForFunction("document.body.textContent.includes('Imported sequence preserved')");
    assert.match(await page.evaluate(() => document.body.textContent), /Roblox username from chat/);
    assert.deepEqual((await keep()).responses, [{ type: 'robloxEvent', event: 'JoinDance', input: 'robloxUsername' }, { type: 'delay', ms: 50 }]);
    await page.evaluate(() => window.mount(null, true, 'roblox', true));
    await page.waitForSelector('[data-testid=roblox-input]');
    assert.match(await page.$eval('[data-testid=roblox-input] option[value=robloxUsername]', node => node.textContent), /แชท/);
    assert.match(await page.$eval('[data-testid=roblox-input] option[value=chatText]', node => node.textContent), /ข้อความแชท/);
    await page.evaluate(() => window.mount(null, false));
    await page.waitForSelector('[data-testid=record-key]');
    assert.equal(await page.$$eval('[data-testid=roblox-input]', nodes => nodes.length), 0);
    await page.evaluate(() => window.mount(null, false, 'minecraft'));
    await page.waitForSelector('[data-testid=minecraft-command]');
    assert.equal(await page.$$eval('[data-testid=roblox-input]', nodes => nodes.length), 0);
    assert.deepEqual(errors, []);
    console.log('PASS Dance editor: actual input select/save/remove/reopen, legacy field absence, sequence preservation, Thai/English, narrow/wide layout, keyboard/Minecraft compatibility');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
