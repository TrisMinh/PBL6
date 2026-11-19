import { createRequire } from 'node:module';
const require=createRequire(new URL('../../../workspace/src/apps/web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage();
page.on('console',msg=>{if(msg.type()==='error')console.log('console',msg.text())});page.on('pageerror',e=>console.log('error',e.message));
page.on('response',async response=>{if(response.url().includes('/api/'))console.log(response.status(),response.url(),(await response.text()).slice(0,200));});
await page.goto('http://127.0.0.1:5375/login');await page.getByRole('button',{name:'Điền tài khoản demo'}).click();await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await page.waitForURL('**/admin/organizations');await page.getByRole('table').waitFor();
console.log('storage',await page.evaluate(()=>Object.entries(sessionStorage).map(([k,v])=>[k,v.length])));
await page.goto('http://127.0.0.1:5375/admin/staff');await page.waitForTimeout(2000);console.log('body',(await page.locator('body').innerText()).slice(-2000));await browser.close();
