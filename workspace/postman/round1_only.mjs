import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const src='C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Final.xlsx';
const p='C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Final_Round1.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(src));
const names=['Auth_Service','Trip_Service','Booking_Service','Payment_Service','Notification_Service','Report_Service'];
for (const name of names) {
 const ws=wb.worksheets.getItem(name);
 const used=ws.getUsedRange();
 const rows=used.values.length;
 // Remove Round 2/3 result, date, and tester fields from every test case.
 ws.getRange(`I1:N${rows}`).clear({contents:true});
 // Keep only the Round 1 module summary.
 ws.getRange('A7:E8').clear({contents:true});
}
const stat=wb.worksheets.getItem('Test Statistics');
stat.getRange('B9').values=[['Round 1 — Kết quả kiểm thử']];
stat.getRange('B36:H52').clear({contents:true});
const out=await SpreadsheetFile.exportXlsx(wb); await out.save(p);
console.log('Saved Round 1 only:',p);


