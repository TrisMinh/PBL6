import fs from 'node:fs/promises';
const id=process.argv[2];if(!id)throw new Error('trip id required');
const base='http://localhost:5080/api/v1';
const collection={info:{name:'PBL6 Round 1 TRIP-06 readiness after recovery',schema:'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'},item:[{name:'TRIP-06 Inventory ready after booking consumer recovers',request:{method:'GET',header:[],url:`${base}/trips/${id}`},event:[{listen:'test',script:{type:'text/javascript',exec:["pm.test('Trip becomes sellable only after inventory is ready',()=>{pm.response.to.have.status(200);pm.expect(pm.response.json().sellable).to.eql(true);});"]}}]}]};
await fs.writeFile('C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/r1-trip06-ready.postman_collection.json',JSON.stringify(collection,null,2));
