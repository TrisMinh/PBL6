import fs from 'node:fs/promises';
const date=process.argv[2]??'2027-01-06';
const output=process.argv[3]??'r1-book11-fullflow';
const path='C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/PBL6_R3_BookingFresh.postman_collection.json';
const c=JSON.parse(await fs.readFile(path,'utf8'));
c.info.name=`PBL6 ${output.toUpperCase()} BOOK-11 Client total tampering`;
for(const item of c.item){
  if(item.request?.url){
    if(typeof item.request.url==='string') item.request.url=item.request.url.replaceAll('2026-12-07',date);
    else if(item.request.url.raw) item.request.url.raw=item.request.url.raw.replaceAll('2026-12-07',date);
  }
  for(const h of item.request?.header??[]) if(h.key==='Idempotency-Key') h.value='pbl6-r1-book11-'+Math.random().toString(36).slice(2,12)+'-'+h.value.slice(-6);
  if(item.request?.body?.raw) item.request.body.raw=item.request.body.raw.replaceAll('2026-12-07',date);
  if(item.request?.url?.raw?.includes('/bookings') || item.request?.url?.includes('/bookings')){
    item.name='BOOK-11 Create booking with tampered expectedTotal';
    item.request.body.raw=item.request.body.raw.replace('"expectedTotal":150000','"expectedTotal":1');
    const test=item.event?.find(e=>e.listen==='test');
    if(test) test.script.exec=["console.log('BOOK11 '+pm.response.text());pm.test('Server calculates the fare and ignores client total',()=>{pm.response.to.have.status(201);pm.expect(pm.response.json().total).to.eql(150000);});"];
  }
}
await fs.writeFile(`C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/${output}.postman_collection.json`,JSON.stringify(c,null,2));
