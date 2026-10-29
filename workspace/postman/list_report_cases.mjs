import { FileBlob, SpreadsheetFile } from 'file:///C:/Users/minht/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const file='C:/Users/minht/OneDrive/Desktop/PBL6/Test_Report_API_Postman_Result_Updated.xlsx';
const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(file));
for(let i=3;i<wb.worksheets.items.length;i++){
 const s=wb.worksheets.getItemAt(i), v=s.getRange('A11:E100').values;
 console.log('\n## '+s.name);
 for(const row of v) if(typeof row[0]==='string'&&row[0].includes('-')) console.log(`${row[0]}\t${row[1]}\nPROC: ${(row[2]||'').replaceAll('\n',' | ')}\nEXP: ${(row[3]||'').replaceAll('\n',' | ')}`);
}
