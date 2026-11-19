import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../workspace/src/apps/web/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1280}});
await page.goto('http://127.0.0.1:5173/trips?originId=loc-hcm&destinationId=loc-dalat&departureDate=2099-01-01&passengerCount=2',{waitUntil:'networkidle'});
await page.getByRole('article').first().waitFor();await page.evaluate(()=>document.fonts.ready);
console.log(JSON.stringify(await page.evaluate(()=>({fonts:[...document.fonts].map(f=>({family:f.family,status:f.status,weight:f.weight})),nodes:[...document.querySelectorAll('.trip-filters__group,.trip-filters__legend,.trip-filters__range,.trip-card__operator,.trip-card__fare,.trip-results__title,.trip-results__search-action')].map(e=>({class:e.className,rect:e.getBoundingClientRect().toJSON(),font:getComputedStyle(e).fontFamily,weight:getComputedStyle(e).fontWeight,border:getComputedStyle(e).borderTop}))})),null,2));
await browser.close();
