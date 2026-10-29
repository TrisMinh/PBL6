import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const root='C:/Users/minht/OneDrive/Desktop/PBL6';
const runDir=root+'/workspace/postman/runs';
const input=root+'/Test_Report_API_Postman_Final.xlsx';
const output=root+'/Test_Report_API_Postman_Final_v2.xlsx';
const modules=['Auth_Service','Trip_Service','Booking_Service','Payment_Service','Notification_Service','Report_Service'];
const runFiles=(await fs.readdir(runDir)).filter(n=>n.endsWith('.log'));
const getSet=async(prefix)=>{
 const covered=new Set(), failed=new Set();
 for(const f of runFiles.filter(x=>x.startsWith(prefix))){
  const t=await fs.readFile(runDir+'/'+f,'utf8');
  for(const m of t.matchAll(/\b([A-Z]+-\d{2})\b/g)) covered.add(m[1]);
  const section=t.split(/\n\s*#?\s*failure\s+detail/i).slice(1).join('\n');
  for(const m of section.matchAll(/inside\s+"([^"]+)"/g)){const id=m[1].match(/\b([A-Z]+-\d{2})\b/);if(id)failed.add(id[1]);}
 }
 return {covered,failed};
};
const r1=await getSet('r1-full-');
// The idempotency suite explicitly replays a success webhook; its collection log is direct evidence for PAY-06.
if(runFiles.some(x=>x.startsWith('r1-full-PBL6_R3_PaymentIdempotency'))) r1.covered.add('PAY-06');
const r2=await getSet('r2-retest-');
const r3=await getSet('r3-retest-');
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const day=46323; // 2026-10-28, Excel date serial.
let counts={r1:{Passed:0,Failed:0,Pending:0,'N/A':0},r2:{Passed:0,Failed:0,Pending:0,'N/A':0},r3:{Passed:0,Failed:0,Pending:0,'N/A':0}};
for(const name of modules){
 const ws=wb.worksheets.getItem(name); const used=ws.getUsedRange(); const vals=used.values;
 for(let i=0;i<vals.length;i++){
  const row=vals[i], id=String(row[0]??'');
  if(!/^[A-Z]+-\d{2}$/.test(id))continue;
  let s1, s2='', s3='';
  if(r1.covered.has(id)) s1=r1.failed.has(id)?'Failed':'Passed';
  else if(String(row[11]??'')==='N/A') s1='N/A';
  else s1='Pending';
  if(s1==='Failed' && r2.covered.has(id)) s2=r2.failed.has(id)?'Failed':'Passed';
  if(s2==='Failed' && r3.covered.has(id)) s3=r3.failed.has(id)?'Failed':'Passed';
  const excelRow=i+2; // used range starts at row 2
  const write=(col,status,dateCol,testerCol)=>{
    ws.getRange(`${col}${excelRow}`).values=[[status]];
    ws.getRange(`${dateCol}${excelRow}`).values=[[status==='Passed'||status==='Failed'?day:null]];
    ws.getRange(`${testerCol}${excelRow}`).values=[[status==='Passed'||status==='Failed'?'Minh Trí':null]];
  };
  write('F',s1,'G','H'); write('I',s2,'J','K'); write('L',s3,'M','N');
  let note='';
  if(s1==='Failed') note='Postman có kiểm tra chưa đạt; xem log Round 1.';
  else if(s1==='Pending') note='Chưa có đủ bộ kiểm tra hoặc dữ liệu để kết luận.';
  else if(s1==='N/A') note=String(row[14]??'Không áp dụng theo phạm vi dự án.');
  else note='Đã kiểm tra bằng Postman; kết quả đáp ứng yêu cầu.';
  if(s3==='Failed') note='Round 3 vẫn còn kiểm tra chưa đạt; xem log Round 3.';
  else if(s3==='Passed') note='Round 3 kiểm tra lại đạt; xem log Round 3.';
  else if(s2==='Failed') note='Round 2 kiểm tra lại vẫn chưa đạt; xem log Round 2.';
  else if(s2==='Passed') note='Round 2 kiểm tra lại đạt; xem log Round 2.';
  ws.getRange(`O${excelRow}`).values=[[note]];
  counts.r1[s1]++;
  if(s2)counts.r2[s2]++; if(s3)counts.r3[s3]++;
 }
 for(const col of ['G','J','M']){ws.getRange(`${col}1:${col}100`).format.numberFormat='yyyy-mm-dd';ws.getRange(`${col}:${col}`).format.columnWidth=13;}
 for(const col of ['F','I','L'])ws.getRange(`${col}:${col}`).format.columnWidth=11;
 for(const col of ['H','K','N'])ws.getRange(`${col}:${col}`).format.columnWidth=13;
 ws.getRange('O:O').format.columnWidth=48;
}
const xlsx=await SpreadsheetFile.exportXlsx(wb); await xlsx.save(output);
console.log(JSON.stringify({output,counts,round1Covered:r1.covered.size,round1Failed:r1.failed.size,round2Covered:r2.covered.size,round3Covered:r3.covered.size},null,2));
