import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='C:/Users/minht/OneDrive/Desktop/PBL6';
const path=root+'/Test_Report_API_Postman_Final_v2.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const modules=[['Auth_Service','Auth Service'],['Trip_Service','Trip Service'],['Booking_Service','Booking Service'],['Payment_Service','Payment Service'],['Notification_Service','Notification Service'],['Report_Service','Report Service']];
const pendingNotes={
 'CMN-02':'Chưa đủ log để đối chiếu riêng toàn bộ mã lỗi HTTP.',
 'SEC-06':'Chưa có minh chứng truy vấn log ứng dụng để kiểm tra dữ liệu nhạy cảm.',
 'TRIP-06':'Chưa giả lập được lỗi tạo kho ghế khi công bố chuyến.',
 'TRIP-09':'Chưa có dữ liệu tài xế không được phân công để kiểm tra quyền.',
 'BOOK-11':'Chưa kết luận: ghế thử bị giữ (409), nên request tạo đơn trả 404.',
 'BOOK-19':'Chưa kết luận: API cập nhật trả sau trả 500, chưa tạo được điều kiện kiểm tra.',
 'CAN-07':'Chưa giả lập được lỗi từ cổng hoàn tiền.',
 'CAN-08':'Chưa đủ dữ liệu đối soát để xác nhận số tiền hoàn và phí sàn.',
 'CAN-07':'Project hiện không có cấu hình/mô phỏng lỗi cổng hoàn tiền.',
 'PAY-10':'Fail: webhook muộn chuyển booking hết hạn thành PAID và phát vé. Round 2-3 API không cho giữ lại ghế (409), nhưng lỗi thanh toán muộn tái hiện.'
};
const directResults={
 'CMN-02':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: booking hết hạn vẫn nhận thanh toán 201; kỳ vọng 410.'},
 'SEC-06':{r1:'Passed',r2:'',r3:'',note:'Pass: quét 925 KB log; không thấy password, OTP, token, PAN/CVV hoặc document number.'},
 'TRIP-06':{r1:'Passed',r2:'',r3:'',note:'Pass: chuyến chưa bán được khi inventory consumer dừng; bán được sau khi chạy lại.'},
 'TRIP-09':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: tài xế không được phân công vẫn đổi trạng thái và xem manifest (HTTP 200).'},
 'BOOK-11':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: sửa expectedTotal về 1 thì API trả 422 PRICE_MISMATCH.'},
 'BOOK-19':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: tắt PAY_LATER nhưng API trả 422; kỳ vọng 409.'},
 'CAN-08':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: yêu cầu hoàn cao hơn số đã trả vẫn nhận 202 ACCEPTED.'},
 'PAY-10':{r1:'Failed',r2:'Failed',r3:'Failed',note:'Fail: webhook muộn chuyển booking hết hạn thành PAID và phát vé. Round 2-3 không giữ lại được ghế (409), nhưng lỗi chính tái hiện.'}
};
const cols={r1:5,r2:8,r3:11};
const dateSerial=46323;
const count=()=>({Passed:0,Failed:0,Pending:0,'N/A':0,Total:0});
const plus=(a,s)=>{if(s==='Passed'||s==='Failed'||s==='Pending'||s==='N/A'){a[s]++;a.Total++;}};
const perModule=[];
for(const [sheet,label] of modules){
 const ws=wb.worksheets.getItem(sheet), vals=ws.getUsedRange().values;
 const entries=[];
 for(let i=0;i<vals.length;i++){
  const row=vals[i], id=String(row[0]??'');
  if(/^[A-Z]+-\d+$/.test(id)) entries.push({row:i+1,values:row});
  else if(sheet==='Booking_Service'&&String(row[0]??'').trim()==='Check-in hành khách'){
   const rowNo=i+1; ws.getRange(`F${rowNo}:N${rowNo}`).values=[['Pending',null,null,null,null,null,null,null,null]];
   ws.getRange(`O${rowNo}`).values=[['Chưa có ca kiểm tra riêng gắn với dòng này.']];
   entries.push({row:rowNo,values:ws.getRange(`A${rowNo}:O${rowNo}`).values[0]});
  }
 }
 for(const e of entries){const id=String(ws.getRange(`A${e.row}`).values[0][0]??'');if(pendingNotes[id]&&String(ws.getRange(`F${e.row}`).values[0][0]??'')==='Pending')ws.getRange(`O${e.row}`).values=[[pendingNotes[id]]];}
 for(const e of entries){
  const id=String(ws.getRange(`A${e.row}`).values[0][0]??''), result=directResults[id]; if(!result)continue;
  for(const [key,status,dateCol,testerCol] of [['r1',result.r1,'G','H'],['r2',result.r2,'J','K'],['r3',result.r3,'M','N']]){
   const col={r1:'F',r2:'I',r3:'L'}[key];
   ws.getRange(`${col}${e.row}`).values=[[status]];
   ws.getRange(`${dateCol}${e.row}`).values=[[status?dateSerial:null]];
   ws.getRange(`${testerCol}${e.row}`).values=[[status?'Minh Trí':null]];
  }
  ws.getRange(`O${e.row}`).values=[[result.note]];
 }
 const rounds={r1:count(),r2:count(),r3:count(),latest:count()};
 for(const e of entries){
  const row=ws.getRange(`A${e.row}:O${e.row}`).values[0];
  for(const [key,index] of Object.entries(cols))plus(rounds[key],String(row[index]??''));
  plus(rounds.latest,String(row[11]||row[8]||row[5]||''));
 }
 const total=entries.length;
 const summaryRows=[
  ['Round 1',rounds.r1],['Round 2',rounds.r2],['Round 3',rounds.r3]
 ];
 summaryRows.forEach(([label,c],idx)=>ws.getRange(`A${6+idx}:E${6+idx}`).values=[[label,c.Passed,c.Failed,c.Pending,c['N/A']]]);
 perModule.push({sheet,label,total,rounds});
}
const stat=wb.worksheets.getItem('Test Statistics');
const setSummary=(rowNo,index,name,c)=>stat.getRange(`B${rowNo}:H${rowNo}`).values=[[index,name,c.Passed,c.Failed,c.Pending,c['N/A'],c.Total]];
const allLatest=count(), allR1=count(), allR2=count(), allR3=count();
perModule.forEach((m,i)=>{
 const c=m.rounds;
 setSummary(11+i,i+1,m.label,c.latest);
 setSummary(26+i,i+1,m.label,c.r1);
 setSummary(36+i,i+1,m.label,c.r2);
 // The lower block is the cumulative state after Round 3.
 setSummary(46+i,i+1,m.label,c.latest);
 for(const k of ['Passed','Failed','Pending','N/A']){allLatest[k]+=c.latest[k];allR1[k]+=c.r1[k];allR2[k]+=c.r2[k];allR3[k]+=c.r3[k];}
 allLatest.Total+=c.latest.Total;allR1.Total+=c.r1.Total;allR2.Total+=c.r2.Total;allR3.Total+=c.r3.Total;
});
const setTotal=(rowNo,c)=>stat.getRange(`C${rowNo}:H${rowNo}`).values=[['Sub total',c.Passed,c.Failed,c.Pending,c['N/A'],c.Total]];
setTotal(18,allLatest);setTotal(32,allR1);setTotal(42,allR2);setTotal(52,allLatest);
stat.getRange('E20:E21').values=[[(allLatest.Passed+allLatest.Failed)/allLatest.Total*100],[allLatest.Passed/allLatest.Total*100]];
stat.getRange('B9').values=[['Kết quả mới nhất, cộng dồn đến Round 3 (2026-10-28)']];
stat.getRange('B44').values=[['Round 3 — Kết quả cộng dồn sau 3 vòng']];
const out=await SpreadsheetFile.exportXlsx(wb);await out.save(path);
console.log(JSON.stringify({path,allLatest,allR1,allR2,allR3,perModule},null,2));
