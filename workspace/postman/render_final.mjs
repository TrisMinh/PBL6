import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load('C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Final_v2.xlsx'));
for(const [sheetName,range,name] of [['Test Statistics','A9:H52','final-stats-preview.png'],['Booking_Service','A53:O60','final-booking-date-preview.png']]){
 const png=await wb.render({sheetName,range,scale:1,format:'png'});
 await fs.writeFile('C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/'+name,new Uint8Array(await png.arrayBuffer()));
}
