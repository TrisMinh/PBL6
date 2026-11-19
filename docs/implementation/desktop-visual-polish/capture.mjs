import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const require = createRequire(new URL('../../../workspace/src/apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const phase = process.argv[2] || 'before';
const dir = new URL(`${phase}/`, import.meta.url);
await mkdir(dir, {recursive:true});
const browser = await chromium.launch({channel:'chrome', headless:true});
const records=[];
async function capture(page,name){
  await page.waitForFunction(()=> !/Đang tải|Đang khởi tạo|Đang xác thực/.test(document.body.innerText), {timeout:15000});
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:fileURLToPath(new URL(`${name}.png`,dir)),fullPage:true});
  await page.screenshot({path:fileURLToPath(new URL(`${name}-viewport.png`,dir))});
  records.push({name,url:page.url(),...await page.evaluate(()=>({
    width:innerWidth,scrollWidth:document.documentElement.scrollWidth,
    controls:[...document.querySelectorAll('button,a,input,select,textarea,[role="dialog"]')].filter(e=>e.getBoundingClientRect().width&&e.getBoundingClientRect().height).map(e=>{
      const s=getComputedStyle(e); return {tag:e.tagName,text:e.textContent?.trim().slice(0,90),label:e.getAttribute('aria-label'),class:e.className,rect:e.getBoundingClientRect().toJSON(),font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,padding:s.padding,gap:s.gap,radius:s.borderRadius,background:s.backgroundColor,color:s.color,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth};
    })
  }))});
  console.log(name);
}
async function run(target,port,paths){
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 try{
  if(target!=='customer'){
    await page.goto(`http://127.0.0.1:${port}/login`,{waitUntil:'networkidle'});await capture(page,`${target}-login`);
    await page.getByRole('button',{name:'Điền tài khoản demo'}).click();
    await page.getByRole('button',{name:'Đăng nhập',exact:true}).click();
    await page.waitForURL(new RegExp(target==='admin'?'/admin/organizations$':'/operator/trips$'));
  }
  for(const [name,path] of paths){
    try{await page.goto(`http://127.0.0.1:${port}${path}`,{waitUntil:'networkidle'});await capture(page,`${target}-${name}`)}catch(error){records.push({name:`${target}-${name}`,error:String(error)});}
  }
  if(target==='admin'){
    await page.goto(`http://127.0.0.1:${port}/admin/organizations`,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Tài khoản',exact:true}).click();await capture(page,'admin-account');await page.keyboard.press('Escape');
    await page.getByRole('button',{name:'Thêm tổ chức',exact:true}).click();await capture(page,'admin-create-organization');await page.keyboard.press('Escape');
    await page.getByRole('link',{name:'Xem chi tiết'}).first().click();await page.waitForURL(/\/admin\/organizations\/[^/]+$/);await page.waitForLoadState('networkidle');await capture(page,'admin-organization-detail');
    await page.goto(`http://127.0.0.1:${port}/admin/staff`,{waitUntil:'networkidle'});
    const add=page.getByRole('button',{name:/Thêm nhân viên|Thêm thành viên/});if(await add.count()){await add.first().click();await capture(page,'admin-create-staff');await page.keyboard.press('Escape');}
    await page.getByRole('link',{name:'Xem chi tiết'}).first().click();await page.waitForURL(/\/admin\/staff\/[^/]+$/);await page.waitForLoadState('networkidle');await capture(page,'admin-staff-detail');
  }
  if(target==='customer'){
    await page.goto(`http://127.0.0.1:${port}/login`,{waitUntil:'networkidle'});await page.getByRole('button',{name:'Đăng nhập bằng Google'}).click();await page.waitForURL(/\/account\/tickets$/);await page.waitForLoadState('networkidle');await capture(page,'customer-my-tickets');
  }
  if(target==='operator'){
    await page.goto(`http://127.0.0.1:${port}/operator/organization`,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'Thêm thành viên',exact:true}).click();await capture(page,'operator-add-member');await page.keyboard.press('Escape');
    await page.goto(`http://127.0.0.1:${port}/operator/settlements`,{waitUntil:'networkidle'});
    await page.getByRole('button',{name:/^Xem chi tiết DS-/}).first().click();await capture(page,'operator-settlement-detail');await page.keyboard.press('Escape');
  }
 }catch(error){records.push({target,error:String(error)});console.error(target,String(error));}
 await context.close();
}
await Promise.all([
 run('customer',5173,[['home','/'],['login','/login'],['register','/register'],['forgot','/forgot-password'],['explore','/explore'],['explore-detail','/explore/lam-dong'],['results','/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2'],['lookup','/tickets/lookup'],['support','/support']]),
 run('operator',5174,[['schedule','/operator/trips'],['new-trip','/operator/trips/new'],['bookings','/operator/bookings'],['passengers','/operator/bookings/trips'],['routes','/operator/routes'],['new-route','/operator/routes/new'],['vehicles','/operator/vehicles'],['drivers','/operator/drivers'],['new-driver','/operator/drivers/new'],['reports','/operator/reports'],['refunds','/operator/refund-requests'],['organization','/operator/organization'],['settlements','/operator/settlements']]),
 run('admin',5175,[['organizations','/admin/organizations'],['staff','/admin/staff'],['bookings','/admin/bookings'],['payments','/admin/payments'],['refunds','/admin/refunds']])
]);
await writeFile(new URL('inventory.json',dir),JSON.stringify(records,null,2));
await browser.close();
