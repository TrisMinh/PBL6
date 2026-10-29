import fs from 'node:fs/promises';
const date=process.argv[2]??'2027-01-10';
const output=process.argv[3]??'r1-book19-fullflow';
const src='C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/PBL6_R3_BookingFresh.postman_collection.json';
const c=JSON.parse(await fs.readFile(src,'utf8'));
c.info.name=`PBL6 ${output.toUpperCase()} BOOK-19 pay later disabled`;
const header=(token)=>[{key:'Authorization',value:`Bearer {{${token}}}`},{key:'Content-Type',value:'application/json'}];
const req=(name,method,url,token,raw,script)=>({name,request:{method,header:header(token),url,...(raw?{body:{mode:'raw',raw}}:{})},event:[{listen:'test',script:{type:'text/javascript',exec:script}}]});
const getOrg=req('Read organization current settings','GET','http://localhost:5080/api/v1/operator/organization','operatorToken',null,[
 "pm.test('Read current organization settings',()=>{pm.response.to.have.status(200);const o=pm.response.json();pm.environment.set('orgName',o.name);pm.environment.set('orgEmail',o.contactEmail);pm.environment.set('orgPhone',o.contactPhone);pm.environment.set('orgOriginalPayLater',String(o.allowPayLater));pm.environment.set('orgVersion',String(o.rowVersion));});"
]);
const disable=req('Disable PAY_LATER temporarily','PATCH','http://localhost:5080/api/v1/operator/organization','operatorToken','{"name":"{{orgName}}","contactEmail":"{{orgEmail}}","contactPhone":"{{orgPhone}}","allowPayLater":false,"expectedVersion":{{orgVersion}}}',[
 "pm.test('Disable PAY_LATER setting',()=>{pm.response.to.have.status(200);const o=pm.response.json();pm.expect(o.allowPayLater).to.eql(false);pm.environment.set('orgVersion',String(o.rowVersion));});"
]);
c.item.splice(1,0,getOrg,disable);
for(const item of c.item){
 if(item.request?.url&&typeof item.request.url==='string')item.request.url=item.request.url.replaceAll('2026-12-07',date);
 if(item.request?.body?.raw)item.request.body.raw=item.request.body.raw.replaceAll('2026-12-07',date);
 for(const h of item.request?.header??[])if(h.key==='Idempotency-Key')h.value='pbl6-book19-'+Math.random().toString(36).slice(2,10)+'-'+h.value.slice(-5);
 if(item.request?.url?.includes('/api/v1/bookings')){
  item.name='BOOK-19 Reject PAY_LATER booking when operator disabled it';
  item.request.body.raw=item.request.body.raw.replace('"paymentChannel":"PREPAID"','"paymentChannel":"PAY_LATER"');
  item.event[0].script.exec=["console.log('BOOK19 '+pm.response.text());pm.test('Disabled PAY_LATER is rejected without creating booking',()=>{pm.response.to.have.status(409);pm.expect(pm.response.json().error.code).to.eql('PAY_LATER_NOT_ALLOWED');});"];
 }
}
const restore=req('Restore original PAY_LATER setting','PATCH','http://localhost:5080/api/v1/operator/organization','operatorToken','{"name":"{{orgName}}","contactEmail":"{{orgEmail}}","contactPhone":"{{orgPhone}}","allowPayLater":{{orgOriginalPayLater}},"expectedVersion":{{orgVersion}}}',[
 "pm.test('Restore PAY_LATER setting',()=>{pm.response.to.have.status(200);pm.expect(pm.response.json().allowPayLater).to.eql(pm.environment.get('orgOriginalPayLater')==='true');});"
]);
c.item.push(restore);
await fs.writeFile(`C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/${output}.postman_collection.json`,JSON.stringify(c,null,2));
