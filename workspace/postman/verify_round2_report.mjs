import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const root = 'C:/Users/minht/OneDrive/Desktop/PBL6/.worktrees/pbl6-production-ready';
const file = `${root}/outputs/pbl6-round2/Test_Report_API_Postman_Round2.xlsx`;
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(file));
const errors = [];
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  for (let row = 0; row < used.values.length; row += 1) {
    for (let column = 0; column < (used.values[row]?.length ?? 0); column += 1) {
      const value = String(used.values[row][column] ?? '');
      if (/^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!)/.test(value)) errors.push(`${sheet.name}!R${row + 1}C${column + 1}=${value}`);
    }
  }
}
const evidence = workbook.worksheets.getItem('Round2_Evidence');
const round2 = evidence.getRange('A4:E4').values[0];
if (Number(round2[1]) !== 421 || Number(round2[2]) !== 358 || Number(round2[3]) !== 63) {
  throw new Error(`Unexpected Round 2 summary: ${JSON.stringify(round2)}`);
}
if (errors.length) throw new Error(`Formula errors: ${errors.join(', ')}`);
const stat = workbook.worksheets.getItem('Test Statistics').getRange('C18:H18').values[0];
console.log(JSON.stringify({ file, sheets: workbook.worksheets.items.map((sheet) => sheet.name), round2, latestCaseSummary: stat, formulaErrors: errors.length, bytes: (await fs.stat(file)).size }, null, 2));
