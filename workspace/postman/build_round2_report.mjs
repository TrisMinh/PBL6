import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const root = 'C:/Users/minht/OneDrive/Desktop/PBL6/.worktrees/pbl6-production-ready';
const evidenceDirectory = `${root}/outputs/pbl6-round2`;
const templatePath = `${root}/Test_Report_API_Postman_Final_Round1.xlsx`;
const outputPath = `${evidenceDirectory}/Test_Report_API_Postman_Round2.xlsx`;
const previewDirectory = `${evidenceDirectory}/previews`;
const summary = JSON.parse((await fs.readFile(`${evidenceDirectory}/round2-summary.json`, 'utf8')).replace(/^\uFEFF/, ''));
const excelDate = 46325;
const modules = [
  ['Auth_Service', 'Auth Service'],
  ['Trip_Service', 'Trip Service'],
  ['Booking_Service', 'Booking Service'],
  ['Payment_Service', 'Payment Service'],
  ['Notification_Service', 'Notification Service'],
  ['Report_Service', 'Report Service'],
];

const coveredIds = new Set();
const failedIds = new Set();
for (const result of summary.results) {
  const log = await fs.readFile(`${evidenceDirectory}/${result.Log}`, 'utf8');
  for (const match of log.matchAll(/\b([A-Z]{2,}-\d{2})\b/g)) coveredIds.add(match[1]);
  const failureSection = log.split(/\n\s*#\s+failure\s+detail/i).slice(1).join('\n');
  for (const match of failureSection.matchAll(/inside\s+"([^"]+)"/g)) {
    const id = match[1].match(/\b([A-Z]{2,}-\d{2})\b/);
    if (id) failedIds.add(id[1]);
  }
}

const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(templatePath));
const count = () => ({ Passed: 0, Failed: 0, Pending: 0, 'N/A': 0, Total: 0 });
const add = (target, status) => {
  if (Object.hasOwn(target, status)) target[status] += 1;
  target.Total += 1;
};

const perModule = [];
for (const [sheetName, label] of modules) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const values = sheet.getRange('A1:R100').values;
  const rows = [];
  for (let index = 0; index < values.length; index += 1) {
    const id = String(values[index][0] ?? '').trim();
    if (/^[A-Z]{2,}-\d{2}$/.test(id)) rows.push({ row: index + 1, id });
    else if (sheetName === 'Booking_Service' && id === 'Check-in hành khách') rows.push({ row: index + 1, id: null });
  }

  sheet.getRange('I10:K10').values = [['Round 2', 'Test date', 'Tester']];
  sheet.getRange('I10:K10').format = {
    fill: '#0B1F6A',
    font: { name: 'Arial', bold: true, color: '#FFFFFF' },
    horizontalAlignment: 'center',
  };
  const counts = count();
  for (const entry of rows) {
    const round1 = String(sheet.getRange(`F${entry.row}`).values[0][0] ?? '');
    const status = entry.id && coveredIds.has(entry.id) ? (failedIds.has(entry.id) ? 'Failed' : 'Passed') : (round1 === 'N/A' ? 'N/A' : 'Pending');
    sheet.getRange(`I${entry.row}:K${entry.row}`).values = [[status, status === 'Passed' || status === 'Failed' ? excelDate : null, status === 'Passed' || status === 'Failed' ? 'Minh Trí' : null]];
    sheet.getRange(`O${entry.row}`).values = [[
      status === 'Passed'
        ? 'Round 2: đạt; có bằng chứng trong Postman log/JUnit.'
        : status === 'Failed'
          ? 'Round 2: chưa đạt; xem collection log tương ứng trong outputs/pbl6-round2/logs.'
          : status === 'N/A'
            ? 'Không áp dụng theo phạm vi SRS hiện tại.'
            : 'Chưa có assertion Round 2 ánh xạ trực tiếp tới test case này.',
    ]];
    add(counts, status);
  }
  sheet.getRange('A7:E7').values = [['Round 2', counts.Passed, counts.Failed, counts.Pending, counts['N/A']]];
  sheet.getRange('I11:I100').format.horizontalAlignment = 'center';
  sheet.getRange('J11:J100').format.numberFormat = 'yyyy-mm-dd';
  sheet.getRange('I:I').format.columnWidth = 11;
  sheet.getRange('J:J').format.columnWidth = 13;
  sheet.getRange('K:K').format.columnWidth = 13;
  sheet.getRange('O:O').format.columnWidth = 52;
  sheet.getRange('O11:O100').format.wrapText = true;
  perModule.push({ sheetName, label, counts });
}

const statistics = workbook.worksheets.getItem('Test Statistics');
const total = count();
perModule.forEach((module, index) => {
  const row = 11 + index;
  const round2Row = 36 + index;
  const values = [[index + 1, module.label, module.counts.Passed, module.counts.Failed, module.counts.Pending, module.counts['N/A'], module.counts.Total]];
  statistics.getRange(`B${row}:H${row}`).values = values;
  statistics.getRange(`B${round2Row}:H${round2Row}`).values = values;
  for (const key of ['Passed', 'Failed', 'Pending', 'N/A']) total[key] += module.counts[key];
  total.Total += module.counts.Total;
});
statistics.getRange('C18:H18').values = [['Sub total', total.Passed, total.Failed, total.Pending, total['N/A'], total.Total]];
statistics.getRange('C42:H42').values = [['Sub total', total.Passed, total.Failed, total.Pending, total['N/A'], total.Total]];
statistics.getRange('B9').values = [['Kết quả mới nhất — Round 2 (2026-10-30)']];
statistics.getRange('B34').values = [['Round 2 — Kiểm tra bổ sung và hồi quy']];
statistics.getRange('E20').formulas = [['=(D18+E18)/H18']];
statistics.getRange('E21').formulas = [['=D18/H18']];
statistics.getRange('E20:E21').format.numberFormat = '0.00%';

const cover = workbook.worksheets.getItem('Cover');
cover.getRange('B6').values = [['PBL6_API_TestReport_Round2_v2.0']];
cover.getRange('F5').values = [[excelDate]];
cover.getRange('F6').values = [['2.0']];
cover.getRange('A13:F13').values = [[excelDate, '2.0', 'Kết quả Round 2', 'M', 'Cập nhật kết quả API Round 2 từ 72 Postman collection; giữ nguyên toàn bộ assertion fail để bảo đảm minh bạch.', 'outputs/pbl6-round2/round2-summary.json']];
cover.getRange('A13').format.numberFormat = 'yyyy-mm-dd';

const evidence = workbook.worksheets.add('Round2_Evidence');
evidence.tabColor = '#0B1F6A';
evidence.showGridLines = false;
evidence.getRange('A1:I1').merge();
evidence.getRange('A1').values = [['ROUND 2 — POSTMAN EXECUTION EVIDENCE']];
evidence.getRange('A1:I1').format = {
  fill: '#0B1F6A',
  font: { name: 'Arial', size: 16, bold: true, color: '#FFFFFF' },
  horizontalAlignment: 'center',
  verticalAlignment: 'center',
};
evidence.getRange('A2:E5').values = [
  ['Round', 'Assertions', 'Passed', 'Failed', 'Pass rate'],
  ['Round 1 baseline', summary.round1Baseline.assertions, summary.round1Baseline.passed, summary.round1Baseline.failed, null],
  ['Round 2', summary.assertions, summary.passed, summary.failed, null],
  ['Delta R2 - R1', null, null, null, null],
];
evidence.getRange('E3').formulas = [['=C3/B3']];
evidence.getRange('E4').formulas = [['=C4/B4']];
evidence.getRange('C5').formulas = [['=C4-C3']];
evidence.getRange('D5').formulas = [['=D4-D3']];
evidence.getRange('E5').formulas = [['=E4-E3']];
evidence.getRange('E3:E5').format.numberFormat = '0.00%';
evidence.getRange('G2:I5').values = [
  ['Execution', 'Value', 'Result'],
  ['Collections', summary.collections, `${summary.collections - summary.failedCollections} clean / ${summary.failedCollections} with failures`],
  ['Target', summary.readinessUrl, summary.exceededRound1 ? 'PASS — vượt Round 1' : 'FAIL'],
  ['Completed UTC', summary.completedAt, 'Evidence retained'],
];
evidence.getRange('H5').format.numberFormat = 'yyyy-mm-dd hh:mm:ss';
evidence.getRange('A2:E2').format = { fill: '#D9EAF7', font: { name: 'Arial', bold: true, color: '#17365D' } };
evidence.getRange('G2:I2').format = { fill: '#D9EAF7', font: { name: 'Arial', bold: true, color: '#17365D' } };
evidence.getRange('A7:I7').merge();
evidence.getRange('A7').values = [['Kết luận: Round 2 vượt baseline cả số pass (+28) và tỷ lệ pass (+6,28 điểm phần trăm). Các failure còn lại được giữ nguyên trong log/JUnit, chủ yếu thuộc collection lịch sử dùng ID runtime cũ.']];
evidence.getRange('A7:I7').format = { fill: '#E2F0D9', font: { name: 'Arial', bold: true, color: '#375623' }, wrapText: true };
evidence.getRange('A10:I10').values = [['#', 'Collection', 'Assertions', 'Passed', 'Failed', 'Exit', 'Duration (s)', 'Log', 'JUnit']];
evidence.getRange('A10:I10').format = { fill: '#0B1F6A', font: { name: 'Arial', bold: true, color: '#FFFFFF' }, horizontalAlignment: 'center' };
const collectionRows = summary.results.map((result, index) => [
  index + 1,
  result.Collection,
  result.Assertions,
  result.Passed,
  result.Failed,
  result.ExitCode,
  result.DurationSeconds,
  result.Log,
  result.JUnit,
]);
evidence.getRange(`A11:I${10 + collectionRows.length}`).values = collectionRows;
evidence.getRange(`A11:A${10 + collectionRows.length}`).format.horizontalAlignment = 'center';
evidence.getRange(`C11:G${10 + collectionRows.length}`).format.horizontalAlignment = 'center';
evidence.getRange(`A11:I${10 + collectionRows.length}`).format.font = { name: 'Arial', size: 9 };
evidence.getRange('A:A').format.columnWidth = 6;
evidence.getRange('B:B').format.columnWidth = 48;
evidence.getRange('C:G').format.columnWidth = 13;
evidence.getRange('H:I').format.columnWidth = 52;
evidence.getRange(`H11:I${10 + collectionRows.length}`).format.wrapText = true;
evidence.freezePanes.freezeRows(10);

workbook.recalculate();
await fs.mkdir(previewDirectory, { recursive: true });
for (const sheet of workbook.worksheets.items) {
  const used = sheet.getUsedRange();
  const png = await workbook.render({ sheetName: sheet.name, range: used.address, scale: 0.65, format: 'png' });
  await fs.writeFile(`${previewDirectory}/round2-${sheet.name}.png`, new Uint8Array(await png.arrayBuffer()));
}
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, assertionSummary: { passed: summary.passed, failed: summary.failed, total: summary.assertions, passRate: summary.passRate }, caseSummary: total, coveredIds: coveredIds.size, failedIds: failedIds.size }, null, 2));
