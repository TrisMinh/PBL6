import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const input=await FileBlob.load('C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Result_Round3_Final.xlsx');
const wb=await SpreadsheetFile.importXlsx(input);
for (const [sheetName,range,file] of [
  ['Test Statistics','A1:H52','C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/report-stats-preview.png'],
  ['Payment_Service','A10:O26','C:/Users/minht/OneDrive/Desktop/PBL6/workspace/postman/runs/report-payment-preview.png'],
]) {
  const png=await wb.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(file,new Uint8Array(await png.arrayBuffer()));
  console.log(file);
}
