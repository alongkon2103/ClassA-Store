// Browser-only QA of the real storefront and ProductModal. Every HTTP request
// is answered in Puppeteer; no Next server, DB, provider or payment is contacted.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const esbuild = require('esbuild');
const puppeteer = require('puppeteer');

const root = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'classa-real-membership-ui-'));
const origin = 'https://membership-ui-fixture.invalid';
const offerId = randomUUID(), variantId = randomUUID();
const names = ['AC Slash', 'AC Universe', 'AC Jump EVO', 'AC Hyper Run', 'AC Magnet', 'AC Fame', 'AC Runner', 'AC Pig Panic'];
const games = names.map((name, index) => ({ id: randomUUID(), slug: 'qa-own-' + index, name_th: name, name_en: name,
  type: index > 5 ? 'desktop_program' : 'roblox_whitelist', is_active: true, is_consignment: false,
  product_images: [{ url: '/uploads/qa-game-' + index + '.svg' }],
}));
const offer = { id: offerId, slug: 'qa-real-membership', name_th: 'สมาชิก A Class Games', name_en: 'A Class Games membership', type: 'bundle',
  is_active: true, is_consignment: false, bundle_product_ids: [], bundle_all_ac_games: true, bundle_includes_tikkies: true,
  product_images: [{ url: '/uploads/qa-membership.svg' }], product_variants: [{ id: variantId, price: 669, is_active: true, variant_type: 'normal',
    label_th: 'รายเดือน 30 วัน', label_en: 'Monthly 30 days', duration_type: 'days', duration_days: 30, discount_pct: 0 }],
};

async function main() {
  const messages = { th: require('../messages/th.json'), en: require('../messages/en.json') };
  const bundle = await esbuild.build({
    stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import Page from './app/[locale]/bundles/checkout/BundleCheckout';import{buildBundleCatalog}from'./lib/bundleCatalog';
      const catalog=buildBundleCatalog([${JSON.stringify(offer)}],${JSON.stringify(games)});window.actualCatalog=catalog;
      const root=createRoot(document.getElementById('root'));let generation=0;function Harness({locale}){const[value,setValue]=React.useState(catalog[0]);window.updateBundle=setValue;return React.createElement(Page,{bundle:value,locale,usdRate:0.03})}
      window.mount=(locale='th')=>{window.fixtureLocale=locale;root.render(React.createElement(Harness,{key:locale+':'+(++generation),locale}))};window.mount();`, resolveDir: root, loader: 'jsx' },
    bundle: true, write: false, format: 'iife', platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"', 'process.env.NEXT_PUBLIC_BASE_URL_IMG': JSON.stringify(origin) },
    plugins: [{ name: 'framework-fixture-only', setup(build) {
      build.onResolve({ filter: /^(?:next-auth\/react|next-intl|@\/i18n\/routing|@\/components\/(?:Navbar|home\/Footer|HalloweenPage))$/ }, args => process.argv.includes('--real-navbar')&&args.path==='@/components/Navbar'?null:({ path: args.path, namespace: 'framework-fixture' }));
      build.onResolve({filter:/ThemeContext$/},args=>({path:args.path,namespace:'framework-fixture'}));
      build.onLoad({ filter: /.*/, namespace: 'framework-fixture' }, args => {
        let contents;
        if (args.path === 'next-auth/react') contents = `const session={user:{id:'${randomUUID()}',email:'ui-admin@localhost.test',name:'Synthetic UI Admin',role:'user'}};export const useSession=()=>({data:{...session,user:{...session.user,provider:window.fixtureProvider||'google',role:window.fixtureProvider==='tikkies-checkout'?'user':session.user.role}},status:'authenticated'});export const signOut=()=>Promise.resolve();`;
        else if(args.path.endsWith('ThemeContext')) contents=`export const useTheme=()=>({theme:document.documentElement.getAttribute('data-theme')||'dark',toggleTheme:()=>{},halloweenEnabled:false});`;
        else if (args.path === '@/i18n/routing') contents = `import React from'react';export const Link=({children,href,...props})=>React.createElement('a',{href,...props},children);const router={push:url=>window.routeAttempts.push(url),replace:url=>window.routeAttempts.push(url)};export const useRouter=()=>router;export const usePathname=()=>'/bundles/checkout';`;
        else if (args.path === 'next-intl') contents = `import React from'react';const messages=${JSON.stringify(messages)};export const useLocale=()=>window.fixtureLocale||'th';export function useTranslations(namespace){
          const t=(key,values={})=>{let value=messages[window.fixtureLocale||'th'][namespace]?.[key];if(typeof value!=='string')throw new Error('Missing real translation '+namespace+'.'+key);return value.replace(/\\{(\\w+)\\}/g,(_,name)=>String(values[name]??'{'+name+'}'))};
          t.rich=(key,values={})=>{const text=t(key);const parts=text.split(new RegExp('<link>(.*?)</link>'));return parts.length===3?React.createElement(React.Fragment,null,parts[0],values.link(parts[1]),parts[2]):text};return t;}`;
        else contents = `import React from'react';export const HalloweenSurface=({children,className})=>React.createElement('div',{className},children);export default function Component({children,className}){return React.createElement('div',{className},children)}`;
        return { loader: 'js', resolveDir: root, contents };
      });
      build.onLoad({ filter: /\.module\.css$/ }, args => {
        const source = fs.readFileSync(args.path, 'utf8');
        const classes = Object.fromEntries([...source.matchAll(/\.([A-Za-z_][\w-]*)/g)].map(match => [match[1], match[1]]));
        return { loader: 'js', contents: 'export default ' + JSON.stringify(classes) };
      });
    } }],
  });
  const globalsPath = path.join(root, 'app/globals.css');
  const css = (await require('postcss')([require('@tailwindcss/postcss')()]).process(fs.readFileSync(globalsPath, 'utf8'), { from: globalsPath })).css
    + '\n' + fs.readFileSync(path.join(root, 'app/[locale]/bundles/BundleStorefront.module.css'), 'utf8')
    + '\n' + fs.readFileSync(path.join(root, 'components/bundles/BundleCheckout.module.css'), 'utf8')
    + (fs.existsSync(path.join(root,'components/bundles/MembershipCheckout.module.css'))?'\n'+fs.readFileSync(path.join(root,'components/bundles/MembershipCheckout.module.css'),'utf8'):'');
  const browser = await puppeteer.launch({ headless: true, args: ['--disable-background-networking'] });
  try {
    const page = await browser.newPage();
    const errors = [], requests = [], unexpected = [], alerts = [], checkout = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept() });
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      const entry = { url: request.url(), method: request.method(), type: request.resourceType(), body: request.postData() || null };
      requests.push(entry);
      const json = (body, status = 200) => request.respond({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (url.origin !== origin) { unexpected.push(entry); void request.abort(); return }
      if (request.resourceType() === 'document' && url.pathname === '/') { void request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div></body></html>' }); return }
      if (url.pathname === '/favicon.ico' && request.method() === 'GET') { void request.respond({ status: 204, body: '' }); return }
      if(url.pathname==='/api/public/feature-flags'){void json({});return}
      if(url.pathname==='/api/notifications'){void json({items:[],notifications:[],unread:0,unreadCount:0});return}
      if(url.pathname==='/api/points/daily'){void json({enabled:false,signedIn:true});return}
      if(url.pathname==='/AClassStoreLogo.png'){void request.respond({status:200,contentType:'image/png',body:fs.readFileSync(path.join(root,'public/AClassStoreLogo.png'))});return}
      if(url.pathname==='/tikkies-logo.webp'){void request.respond({status:200,contentType:'image/webp',body:fs.readFileSync(path.join(root,'public/tikkies-logo.webp'))});return}
      if (request.resourceType() === 'image') {
        const number = Math.max(0, Number(/qa-game-(\d+)/.exec(url.pathname)?.[1] || 0));
        void request.respond({ status: 200, contentType: 'image/svg+xml', body: `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="${['#155e75', '#4338ca', '#047857', '#9a3412'][number % 4]}"/><circle cx="320" cy="200" r="95" fill="#ffffff" opacity=".12"/><text x="320" y="370" text-anchor="middle" fill="white" font-size="36" font-family="sans-serif">${names[number] || 'Synthetic membership'}</text></svg>` }); return;
      }
      if (url.pathname === '/api/points/config' && request.method() === 'GET') { void json({ enabled: true, per_baht: 10 }); return }
      if (url.pathname === '/api/public/payment-config' && request.method() === 'GET') { void json({ card: { enabled: true, fee_pct: 6 }, promptpay: { enabled: true, fee_pct: 0 }, paypal: { enabled: true, fee_pct: 0 }, paypal_me: { enabled: true, fee_pct: 9.9 } }); return }
      if (url.pathname === '/api/public/exchange-rate' && request.method() === 'GET') { void json({ rate: 0.03 }); return }
      if (url.pathname === '/api/discount-codes/public' && request.method() === 'GET') { void json({ codes: [] }); return }
      if (url.pathname === '/api/discount-codes/resolve' && request.method() === 'GET') { void json({ found: false }); return }
      if (url.pathname === '/api/checkout/trial' && request.method() === 'GET') { void json({ hasUsedTrial: false, isTrialEnabled: false }); return }
      if (url.pathname === '/api/roblox/verify' && request.method() === 'GET') { void json({ ok: true, user: { username: url.searchParams.get('username'), displayName: 'Synthetic Roblox Admin', avatarUrl: null } }); return }
      if (url.pathname === '/api/discount-codes/validate' && request.method() === 'POST') { const body=JSON.parse(entry.body);void json(body.code==='MINIMUM'?{valid:false,errorCode:'BELOW_MIN_AMOUNT',params:{minAmount:1000}}:{valid:true,code:'SAVE50',amountOff:50}); return }
      if (['/api/checkout','/api/checkout/paypal','/api/checkout/paypal-me'].includes(url.pathname) && request.method() === 'POST') { checkout.push(JSON.parse(entry.body)); void json({ error: 'SYNTHETIC_CHECKOUT_STOP' }, 400); return }
      unexpected.push(entry); void json({ error: 'UNEXPECTED_FIXTURE_REQUEST' }, 500);
    });
    await page.setViewport({ width: 1440, height: 1000 });
    await page.goto(origin, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => { window.routeAttempts = [] });
    await page.addStyleTag({ content: css });
    await page.addScriptTag({ content: bundle.outputFiles[0].text });

    await page.waitForSelector('[data-testid=bundle-checkout]');
    assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden','full-page checkout must use document scrolling');
    await page.waitForSelector('[data-testid=membership-checkout-page]');
    assert.ok(await page.$eval('[data-testid=membership-checkout-page]',e=>e.getBoundingClientRect().width)>1000,'desktop checkout uses the page width');
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('[data-testid=bundle-checkout]')].some(e=>getComputedStyle(e).position==='fixed')),false);
    assert.equal(await page.$$eval('[data-testid=checkout-game]',nodes=>nodes.length),8,'all included games are visible');
    const buy='[data-testid=checkout-pay]';
    await page.click(buy);await page.waitForSelector('[role=alert]');assert.equal(alerts.length,0,'page errors must not open browser alert dialogs');
    await page.type('input[name=robloxUsername]','FixtureRoblox');
    await page.waitForFunction(()=>document.body.textContent.includes('Synthetic Roblox Admin'));
    assert.equal(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>getComputedStyle(e).position==='fixed'&&!e.matches('header,nav')&&!e.closest('header,nav')).length),0,'focusing the username must not automatically open help');
    assert.ok(await page.$eval('[data-testid=checkout-total]',e=>e.textContent.includes('709.14')),'card fee is included in the live total');
    for(const [index,method]of ['card','promptpay','paypal','paypal_me'].entries()){
      await page.click('[data-checkout-method='+method+']');
      if(method==='promptpay')assert.ok(await page.$eval('[data-testid=checkout-total]',e=>e.textContent.includes('669')),'zero-fee method updates the total');
      await page.click(buy);for(let i=0;i<80&&checkout.length!==index+1;i++)await new Promise(r=>setTimeout(r,25));
      assert.equal(checkout.length,index+1);assert.equal(checkout[index].paymentMethod,method);assert.equal(checkout[index].productId,offerId);assert.equal(checkout[index].variantId,variantId);assert.equal(checkout[index].whitelistUsername,'FixtureRoblox');assert.equal(checkout[index].isPremium,false);
      await page.waitForFunction(selector=>!document.querySelector(selector).disabled,{},buy);
    }
    await page.click('[data-checkout-method=card]');
    const codeSelector='input[placeholder='+JSON.stringify(messages.th.ProductModal.discount_placeholder)+']';
    await page.type(codeSelector,'SAVE50');await page.evaluate(label=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label).click(),messages.th.ProductModal.discount_apply);
    await page.waitForFunction(()=>document.body.textContent.includes('SAVE50'));
    assert.ok(await page.$eval('[data-testid=checkout-total]',e=>e.textContent.includes('656.14')),'discount applies before the card fee');
    await page.click(buy);for(let i=0;i<80&&checkout.length!==5;i++)await new Promise(r=>setTimeout(r,25));assert.equal(checkout[4].discountCode,'SAVE50');
    await page.evaluate(()=>{window.fixtureProvider='tikkies-checkout';window.mount('th')});await page.waitForSelector('[data-testid=checkout-pay]');
    assert.ok(await page.$$eval('a[href="/bundles"]',n=>n.length)>0,'public catalog is visible even to scoped buyers');
    await page.evaluate(()=>window.updateBundle(null));await page.waitForFunction(()=>!document.querySelector('[data-testid=bundle-checkout]'));
    assert.equal(await page.$$eval('a[href="/bundles"]',n=>n.length),1,'public nav remains available; scoped stale-offer recovery returns to Tikkies');
    assert.ok(await page.$eval('main',e=>e.textContent.includes('Tikkies')),'recovery tells a native buyer where to reopen purchase');
    await page.evaluate(()=>{window.fixtureProvider='google';window.mount('th')});await page.waitForSelector('[data-testid=checkout-pay]');
    assert.ok(await page.$$eval('a[href="/bundles"]',n=>n.length)>0,'ordinary website buyers keep the existing catalog link');
    const updatedId=randomUUID();
    await page.evaluate(id=>window.updateBundle({...window.actualCatalog[0],product_variants:[{...window.actualCatalog[0].product_variants[0],id,price:1000,duration_days:365,label_th:'UPDATED 365 DAYS'}]}),updatedId);
    await page.waitForFunction(()=>document.body.textContent.includes('UPDATED 365 DAYS'));
    assert.ok(await page.$eval('[data-testid=checkout-total]',e=>e.textContent.includes('1,060.00')),'refreshed offer props reset the shared form and its amount');
    await page.type('input[name=robloxUsername]','FixtureUpdated');await page.waitForFunction(()=>document.body.textContent.includes('Synthetic Roblox Admin'));
    await page.click(buy);for(let i=0;i<80&&checkout.length!==6;i++)await new Promise(r=>setTimeout(r,25));assert.equal(checkout[5].variantId,updatedId,'the submitted variant must match the newly displayed offer');
    await page.evaluate(()=>{window.fixtureProvider='tikkies-checkout'});
    if(process.argv.includes('--real-navbar')){
      for(const provider of ['tikkies-checkout','google','discord','unknown-provider']){
        await page.evaluate(provider=>{window.fixtureProvider=provider;window.mount('th')},provider);await page.waitForSelector('[data-testid=checkout-pay]');
        const name='Synthetic UI Admin';
        const hasName=await page.$$eval('nav button',(nodes,name)=>nodes.some(e=>e.textContent.trim()===name),name);
        assert.equal(hasName,true,'the ordinary account profile must not be replaced by a Tikkies brand button');
        assert.ok(await page.$eval('[aria-labelledby=membership-payment-title]',e=>e.textContent.includes('Synthetic UI Admin')&&e.textContent.includes('ui-admin@localhost.test')),'the purchasing profile and email remain visible');
        await page.$$eval('nav button',(nodes,name)=>nodes.find(e=>e.textContent.trim()===name).click(),name);
        const expected=provider==='google'?messages.th.Navbar.signed_in_google:provider==='discord'?messages.th.Navbar.signed_in_discord:messages.th.Navbar.logged_in;
        await page.waitForFunction(label=>document.body.textContent.includes(label),{},expected);
        if(!['google','discord'].includes(provider))assert.equal(await page.evaluate(label=>document.body.textContent.includes(label),messages.th.Navbar.signed_in_discord),false,'checkout and unknown providers must not claim a Discord login');
        await page.evaluate(label=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label).click(),messages.th.Navbar.cancel);
      }
      await page.evaluate(()=>{window.fixtureProvider='google';window.mount('th')});await page.waitForSelector('[data-testid=checkout-pay]');
    }
    const screenshots=path.join(root,'.codex/fullpage-checkout-qa'+(process.argv.includes('--real-navbar')?'-navbar':''));fs.mkdirSync(screenshots,{recursive:true});
    for(const [locale,theme,width]of [['th','dark',1440],['th','dark',390],['en','light',1440]]){
      await page.setViewport({width,height:1000});await page.evaluate(({locale,theme})=>{document.documentElement.setAttribute('data-theme',theme);window.mount(locale)},{locale,theme});await page.waitForSelector('[data-testid=checkout-pay]');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');
      assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
      if(width===390)assert.equal(await page.evaluate(()=>document.querySelector('[aria-labelledby=membership-payment-title]').getBoundingClientRect().top<document.querySelector('[aria-labelledby=membership-games-title]').getBoundingClientRect().top),true,'mobile checkout prioritizes the form before browsing every game');
      await page.evaluate(()=>window.scrollTo(0,0));await new Promise(r=>setTimeout(r,400));
      if(process.argv.includes('--real-navbar'))assert.ok(await page.$eval('nav',e=>Math.abs(e.getBoundingClientRect().top)<2),'real website navigation stays at the top');
      if(width===390&&process.argv.includes('--real-navbar')){
        const menu='button[aria-label='+JSON.stringify(messages[locale].Navbar.toggle_menu)+']';
        await page.click(menu);await page.waitForFunction(()=>document.body.innerText.includes('Tikkies'));
        assert.equal(await page.evaluate(label=>document.body.innerText.includes(label),messages[locale].Navbar.signed_in_discord),false,'mobile delegated checkout must not be labelled Discord');
        await page.click(menu);await new Promise(r=>setTimeout(r,300));
      }
      await page.screenshot({path:path.join(screenshots,locale+'-'+theme+'-'+width+'.png'),fullPage:true});
    }
    await page.type('input[placeholder='+JSON.stringify(messages.en.ProductModal.discount_placeholder)+']','MINIMUM');
    await page.evaluate(label=>[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===label).click(),messages.en.ProductModal.discount_apply);
    await page.waitForFunction(()=>document.body.textContent.includes('Minimum'));
    assert.ok(await page.$eval('main',e=>e.textContent.includes('$30.00')),'minimum-discount guidance uses the same USD conversion as the page total');
    assert.deepEqual(errors,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(alerts,[]);
    console.log('PASS full-page checkout: document scroll, page width, game art, on-demand help, live fees, all provider payloads, inline errors, TH/EN, responsive themes and accurate Google/Discord/Tikkies account labels');
  } finally {await browser.close();fs.rmSync(output,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1});
