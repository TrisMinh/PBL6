import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const path='C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Final_v2.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const coverage=new Set(); const failures=new Set();
for(const f of await (await import('node:fs/promises')).readdir('C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs')) if(f.endsWith('.log')&&f.startsWith('r1-full-')){const t=await(await import('node:fs/promises')).readFile('C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/'+f,'utf8'); for(const m of t.matchAll(/\b([A-Z]+-\d{2})\b/g))coverage.add(m[1]); for(const m of t.matchAll(/inside "([^"]+)"/g)){const id=m[1].match(/\b([A-Z]+-\d{2})\b/); if(id) failures.add(id[1]);}}
const ids=new Set();
for (const name of ['Test Statistics','Auth_Service','Trip_Service','Booking_Service','Payment_Service','Notification_Service','Report_Service']) {
 const ws=wb.worksheets.getItem(name); const u=ws.getUsedRange(); console.log('\nSHEET',name,u.address);
 const vals=u.values;
 if(name==='Test Statistics') for(let j=0;j<vals.length;j++) if(vals[j].some(v=>String(v??'').trim())) console.log('STATROW',j+1,JSON.stringify(vals[j]));
 for(let i=0;i<vals.length;i++) { const row=vals[i]; const id=String(row[0]??''); if(/^[A-Z]+-\d+/.test(id)){ ids.add(id); if(name!=='Test Statistics'&&row[5]==='Pending') console.log('PENDING_CASE',name,i+1,id,row[1]);} else if(name!=='Test Statistics'&&i>10&&row.some(v=>String(v??'').trim())) console.log('NO_ID',i+1,JSON.stringify(row)); }
}
console.log('\nIDCOUNT',ids.size,'COVERAGECOUNT',coverage.size,'COVERAGE',JSON.stringify([...coverage].sort())); console.log('UNCOVERED',JSON.stringify([...ids].filter(x=>!coverage.has(x)).sort())); console.log('FAILED_CASES',JSON.stringify([...failures].sort()));
