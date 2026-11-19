import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFile } from 'node:fs/promises';
const require=createRequire(new URL('../../../workspace/src/apps/web/package.json',import.meta.url));
const {chromium,expect}=require('@playwright/test');
const browser=await chromium.launch({headless:true});
const results=[];
try {
 for(const width of [360,1440]) {
  const ctx=await browser.newContext({viewport:{width,height:1000},baseURL:'http://127.0.0.1:5183'});
  const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/login');
  await expect(page.getByRole('button',{name:'Đăng nhập bằng Google'})).toContainText('Google');
  await expect(page.getByRole('button',{name:'Đăng nhập bằng Facebook'})).toContainText('Facebook');
  await page.screenshot({path:fileURLToPath(new URL(`customer-auth-${width}.png`,import.meta.url)),fullPage:true});
  await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();
  await expect(page).toHaveURL(/\/account\/tickets/);
  await page.goto('/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2');
  await page.getByRole('button',{name:'Chọn chuyến',exact:true}).first().click();
  await page.getByRole('button',{name:'Ghế A01',exact:true}).click();
  await page.getByRole('button',{name:'Ghế A02',exact:true}).click();
  await page.getByRole('button',{name:'Tiếp tục',exact:true}).click();
  await page.getByLabel('Họ và tên (ghế A01)').fill('Nguyễn Minh An');
  await page.getByLabel('Họ và tên (ghế A02)').fill('Trần Thu Hà');
  await page.getByLabel('Họ và tên người liên hệ').fill('Nguyễn Minh An',{force:true});
  await page.getByLabel('Số điện thoại người liên hệ').fill('0912345678',{force:true});
  await page.getByLabel('Email nhận vé').fill('test+review@example.invalid');
  await page.getByRole('button',{name:'Xác nhận thông tin',exact:true}).click();
  await page.getByRole('button',{name:/^Tiếp tục thanh toán/}).click();
  await page.getByRole('button',{name:'Chọn phương thức thanh toán'}).click();
  const dialog=page.getByRole('dialog',{name:'Thanh toán VNPay mô phỏng'});
  await expect(dialog).toBeVisible();
  await dialog.getByRole('tab',{name:'Thẻ ATM / Ngân hàng'}).click();
  await dialog.getByRole('radio',{name:/Vietcombank/}).check();
  await page.screenshot({path:fileURLToPath(new URL(`customer-vnpay-gateway-${width}.png`,import.meta.url)),fullPage:true});
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  await expect(dialog.getByRole('button',{name:'Xác nhận thanh toán mô phỏng'})).toBeEnabled();
  await dialog.getByRole('button',{name:'Xác nhận thanh toán mô phỏng'}).click();
  await expect(page.getByRole('heading',{name:'Thanh toán thành công',exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:/Xem vé BLUE-/})).toHaveCount(2);
  results.push({width,socialLogin:true,bankGateway:true,issuedTickets:2,overflow,errors});
  await ctx.close();
 }
} finally { await browser.close(); }
await writeFile(new URL('customer-browser-check.json',import.meta.url),JSON.stringify(results,null,2));
console.log(JSON.stringify(results,null,2));
