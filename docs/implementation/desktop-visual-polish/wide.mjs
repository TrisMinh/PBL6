import {createRequire} from 'node:module';
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../../../workspace/src/apps/web/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const data=[];
for(const width of [1280,1920]){
 const page=await browser.newPage({viewport:{width,height:1000}});
 await page.goto('http://127.0.0.1:5173/explore',{waitUntil:'networkidle'});
 await page.locator('.customer-layout__booking-link').click();await expect(page).toHaveURL(/\/#booking-search$/);
 await expect(page.getByRole('form',{name:'Tìm chuyến'})).toBeVisible();
 data.push({screen:'customer-booking-anchor',width,...await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,search:document.querySelector('#booking-search').getBoundingClientRect().toJSON()}))});
 await page.screenshot({path:fileURLToPath(new URL(`reviewed/customer-booking-anchor-${width}.png`,import.meta.url))});
 await page.goto('http://127.0.0.1:5175/login',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Điền tài khoản demo'}).click();await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();await expect(page).toHaveURL(/admin\/organizations$/);
 await expect(page.getByRole('table')).toBeVisible();
 await page.getByRole('button',{name:'Tài khoản',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.screenshot({path:fileURLToPath(new URL(`reviewed/admin-account-${width}.png`,import.meta.url))});
 data.push({screen:'admin-account',width,...await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,dialog:document.querySelector('[role=dialog]').getBoundingClientRect().toJSON()}))});
 await page.close();
}
const page=await browser.newPage({viewport:{width:1100,height:530}});
const base=new URL('../../../workspace/src/apps/web/src/',import.meta.url);
const css=(await readFile(new URL('styles/tokens.css',base),'utf8'))+(await readFile(new URL('shared/ui/Button/Button.css',base),'utf8'));
const rows=['primary','secondary','ghost','danger'].map(type=>`<section><h2>${type}</h2><button class="button button--${type}">Tìm chuyến</button><button class="button button--${type}" disabled>Tìm chuyến</button><button class="button button--${type}" disabled aria-busy="true"><span class="button__content" aria-hidden="true">Tìm chuyến</span><span class="button__progress" aria-hidden="true"></span><span class="button__loading-label">Đang xử lý</span></button></section>`).join('');
await page.setContent(`<html lang="vi"><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap"><style>@layer base,components;${css}body{padding:32px;margin:0;background:#f7faff;font:14px 'Be Vietnam Pro',sans-serif;color:#10243e}h1{font-size:22px;margin:0 0 24px}section{display:flex;align-items:center;gap:24px;margin:20px 0}h2{width:160px;font-size:14px;font-weight:500}section .button{width:180px;height:48px;box-sizing:border-box}header{margin-left:184px;display:flex;gap:24px}header span{width:180px}</style></head><body><h1>BLUE / Shared button states · CSS từ source</h1><header><span>Default</span><span>Disabled</span><span>Loading · giữ kích thước</span></header>${rows}<p>Preview CSS dùng chung; không thay thế kiểm tra trên từng trang.</p></body></html>`);
await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:fileURLToPath(new URL('button-states.png',import.meta.url))});
await page.close();await browser.close();await writeFile(new URL('wide-check.json',import.meta.url),JSON.stringify(data,null,2));
