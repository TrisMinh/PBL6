import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';
const file=await FileBlob.load('C:/Users/minht/Downloads/Test_Report_API_Round3.xlsx');
const wb=await SpreadsheetFile.importXlsx(file);
console.log((await wb.inspect({kind:'sheet',include:'id,name',maxChars:2000})).ndjson);
for(const name of ['Auth_Register','Booking_SeatHold','Test Statistics','Round3 Evidence']){const s=wb.worksheets.getItem(name); console.log(name, (await wb.inspect({kind:'region',sheetId:name,range:name==='Round3 Evidence'?'A1:B22':name==='Test Statistics'?'B33:H42':'A10:P20',maxChars:2500})).ndjson)}
