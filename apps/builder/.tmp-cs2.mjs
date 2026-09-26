import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.goto('https://developer.chrome.com/case-studies', {waitUntil:'networkidle'});
await p.waitForTimeout(2000);
for (let i=0;i<10;i++){ const btn = await p.$('button:has-text("more"), button:has-text("More"), a:has-text("Load more")'); if(!btn) break; await btn.click().catch(()=>{}); await p.waitForTimeout(1500); }
const items = await p.$$eval('a', as => as.filter(a=>/Read the study/.test(a.innerText)||/\/blog\//.test(a.href)).map(a=>a.href));
console.log([...new Set(items)].length);
const txt = await p.innerText('main');
const titles = txt.split('\n').filter((l,i,arr)=>arr[i+2]!==undefined);
const i = txt.indexOf('How NRK'); console.log(txt.slice(i, i+8000));
await b.close();
