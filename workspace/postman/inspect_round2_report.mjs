import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const root = 'C:/Users/minht/OneDrive/Desktop/PBL6/.worktrees/pbl6-production-ready';
const input = `${root}/Test_Report_API_Postman_Final_Round1.xlsx`;
const previewDirectory = `${root}/outputs/pbl6-round2/previews`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
await fs.mkdir(previewDirectory, { recursive: true });

for (const worksheet of workbook.worksheets.items) {
  const used = worksheet.getUsedRange();
  console.log(`${worksheet.name}|${used.address}|${used.values.length}x${used.values[0]?.length ?? 0}`);
  const png = await workbook.render({ sheetName: worksheet.name, range: used.address, scale: 0.7, format: 'png' });
  await fs.writeFile(`${previewDirectory}/round1-${worksheet.name}.png`, new Uint8Array(await png.arrayBuffer()));
}

console.log('COVER_VALUES');
console.log(JSON.stringify(workbook.worksheets.getItem('Cover').getRange('A2:F17').values));
console.log('AUTH_HEADERS');
console.log(JSON.stringify(workbook.worksheets.getItem('Auth_Service').getRange('A1:R14').values));
