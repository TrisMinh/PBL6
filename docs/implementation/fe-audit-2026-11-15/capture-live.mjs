import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const require = createRequire(new URL('../../../workspace/src/apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const out = new URL('./', import.meta.url);
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const id = n => `019a3a71-0000-7000-8000-${String(n).padStart(12,'0')}`;
try {
 for (const width of [1440,360]) for(const [name,path,role] of [['home','/','CUSTOMER'],['admin-bookings','/admin/bookings','PLATFORM_ADMIN'],['operator-bookings','/operator/bookings','OPERATOR_ADMIN']]) {
  const context = await browser.newContext({viewport:{width,height:1000}});
  await context.addInitScript(({role,userId,sessionId})=>{
    const expiresAt=Date.now()+3600000;
    sessionStorage.setItem('blue-api-session',JSON.stringify({accessToken:'audit-fixture-token',refreshToken:'audit-fixture-refresh',tokenType:'Bearer',expiresIn:3600,expiresAt,sessionId,user:{id:userId,roles:[role]}}));
    sessionStorage.setItem('blue-mock-session',JSON.stringify({userId,role:role==='PLATFORM_ADMIN'?'admin':'customer',expiresAt:new Date(expiresAt).toISOString(),token:'audit-fixture-token'}));
  },{role,userId:id(9),sessionId:id(8)});
  const page=await context.newPage();const errors=[];const requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/v1/**', async route=>{
    const pathname=new URL(route.request().url()).pathname;requests.push(pathname);
    const items=pathname.includes('bookings')?[{id:id(6),code:'BK-AUDIT-001',status:'CONFIRMED',total:640000,paymentChannel:'PREPAID',createdAt:'2026-11-15T08:00:00+07:00',customerName:'Khách kiểm tra',organizationId:id(2)}]:[];
    await route.fulfill({json:pathname.includes('/explore/')?[]:{items,page:0,size:20,totalPages:items.length?1:0,totalElements:items.length,nextCursor:null}});
  });
  await page.goto(`http://127.0.0.1:5181${path}`,{waitUntil:'networkidle'});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:new URL(`live-${name}-${width}.png`,out).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:true});
  results.push({name,path,width,url:page.url(),headings:await page.locator('h1,h2').allTextContents(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),errors,requests,bodyText:(await page.locator('body').innerText()).slice(0,5000)});
  await context.close();
 }
} finally {await browser.close();}
await writeFile(new URL('live-capture.json',out),JSON.stringify({note:'Live frontend with intercepted HTTP fixtures; no real backend transactions.',results},null,2));
console.log(JSON.stringify(results.map(({bodyText,requests,...r})=>r),null,2));
