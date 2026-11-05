import fs from 'node:fs/promises';
import {FileBlob,SpreadsheetFile} from '@oai/artifact-tool';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/minht/Downloads/Test_Report_API_Round3_Verified.xlsx'));
for(const [name,range] of [['Test Statistics','B33:H42'],['Auth_Register','A10:P18'],['Booking_SeatHold','A10:P20'],['Round3 Evidence','A1:B19']]) console.log(name,(await wb.inspect({kind:'region',sheetId:name,range,maxChars:4500})).ndjson);
for(const sheetName of ['Test Statistics','Auth_Register','Booking_SeatHold']){const img=await wb.render({sheetName,autoCrop:'all',scale:1,format:'png'});await fs.writeFile(`outputs/pbl6-round3/qa-${sheetName.replaceAll(' ','-')}.png`,new Uint8Array(await img.arrayBuffer()))}
console.log('RENDERED');
