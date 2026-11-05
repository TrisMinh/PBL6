import fs from 'node:fs/promises';
import { FileBlob, SpreadsheetFile } from '@oai/artifact-tool';

const input = 'C:/Users/minht/Downloads/Test_Report_API_Round3_Final6 (2).xlsx';
const output = 'C:/Users/minht/Downloads/Test_Report_API_Round3_Final6 (2)_Aliases.xlsx';
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const sheet = workbook.worksheets.getItem('Booking_SeatHold');
const set = (cell, value) => { sheet.getRange(cell).values = [[value]]; };

set('B9', 'Chú giải biến Postman dùng trong Test Data: {{baseUrl}} = http://localhost:5080/api/v1; {{tripId}} = T1, chuyến Đà Nẵng–Huế, ID 01990a00-0000-7000-8000-000000000007. {{customerId01}}/{{customerId02}} = tài khoản Customer 1/2; {{customerToken01}}/{{customerToken02}} = accessToken lấy sau khi đăng nhập từng tài khoản. {{seatId1A}}=01990a00-0000-7000-8000-000000000021; {{seatId1B}}=01990a00-0000-7000-8000-000000000022; {{seatId1C}}=01990a00-0000-7000-8000-000000000041; {{seatId1D}}=01990a00-0000-7000-8000-000000000042; {{seatId2A}}=01990a00-0000-7000-8000-000000000043; {{seatId2B}}=01990a00-0000-7000-8000-000000000044. {{pickupStopId01}}=01990a00-0000-7000-8000-000000000004; {{dropoffStopId01}}=01990a00-0000-7000-8000-000000000005. {{cancelledTripId}}=01a18b07-9a75-756d-8f13-0d5e8c90a025; {{cancelledSeatId}}=01a18b07-9f35-70ac-af07-934a5f14e04b; {{departedTripId}}=01a18b06-7537-78b0-8952-4413bcadc98d; {{departedSeatId}}=01a18b06-7de0-70e3-9240-eddb86a03f8f. {{idempotencyKey08}} = key mới mỗi lượt, giữ nguyên ở hai request replay; {{idempotencyKey09Lazy}}/{{idempotencyKey09Proactive}} = key riêng cho hai hold; {{$guid}} do Postman tự tạo. Các biến {{...}} cần khai báo trong Postman Environment; token lấy từ login, không dùng customerId làm token.');

set('B9', 'Các biến {{...}} dùng trong cột Test Data được định nghĩa tại sheet SeatHold Data. customerToken lấy từ accessToken sau khi đăng nhập tài khoản tương ứng.');
set('P12', 'Request: GET {{baseUrl}}/trips/{{tripId}}/seats\nHeader: Authorization: Bearer {{customerToken01}}\nKiểm tra seat_code: 1A=BOOKED; 1B chuyển tạm sang DISABLED rồi khôi phục; 1C, 1D, 2A, 2B=AVAILABLE. HELD được kiểm tra sau khi chạy BOOK-02/03.');
set('P13', 'Trước test: seat_code 2A AVAILABLE.\nPOST {{baseUrl}}/trips/{{tripId}}/seat-holds\nHeader: Authorization: Bearer {{customerToken01}}; Content-Type: application/json; Idempotency-Key: hold-book02-01\nBody: {"seatIds":["{{seatId2A}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}\nSau test: 2A=HELD; GET hold xác nhận holdToken, expiresAt, giá và policySnapshot.');
set('P14', 'Trước test: seat_code 2A và 2B AVAILABLE.\nPOST {{baseUrl}}/trips/{{tripId}}/seat-holds\nHeader: Authorization: Bearer {{customerToken01}}; Content-Type: application/json; Idempotency-Key: hold-book03-01\nBody: {"seatIds":["{{seatId2A}}","{{seatId2B}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}\nSau test: 2A, 2B=HELD cùng một holdToken; release hold sau kiểm tra.');
set('P15', 'Trước test: 2A, 2B AVAILABLE.\nBước 1, Customer 2: POST {{baseUrl}}/trips/{{tripId}}/seat-holds; Authorization: Bearer {{customerToken02}}; Idempotency-Key: hold-book04-c2-01; body: {"seatIds":["{{seatId2A}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}.\nBước 2, Customer 1: POST cùng URL; Authorization: Bearer {{customerToken01}}; Idempotency-Key: hold-book04-c1-01; body: {"seatIds":["{{seatId2B}}","{{seatId2A}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}.\nMong đợi: 409; 2B vẫn AVAILABLE, 2A HELD bởi Customer 2.');
set('P16', 'Trước test: 2A AVAILABLE; hai customer đã đăng nhập.\nGửi đồng thời hai POST {{baseUrl}}/trips/{{tripId}}/seat-holds với cùng body: {"seatIds":["{{seatId2A}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}.\nRequest 1 dùng {{customerToken01}}, key hold-book05-c1-{{$guid}}; request 2 dùng {{customerToken02}}, key hold-book05-c2-{{$guid}}.\nMong đợi: một 201, một 409; release hold thắng sau khi kiểm tra.');
set('P17', 'POST {{baseUrl}}/trips/{{tripId}}/seat-holds\nHeader: không gửi Authorization; Content-Type: application/json\nBody: {"seatIds":["{{seatId2A}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}\nMong đợi: 401 AUTHENTICATION_REQUIRED; không tạo hold, 2A vẫn AVAILABLE.');
set('P18', 'Dữ liệu nền: {{cancelledTripId}} ở CANCELLED; {{departedTripId}} ở DEPARTED (fixture cô lập, khôi phục sau test).\nHeader: Authorization: Bearer {{customerToken01}}; Content-Type: application/json.\nLần 1: POST {{baseUrl}}/trips/{{cancelledTripId}}/seat-holds; Idempotency-Key: hold-book07-cancelled-01; body: {"seatIds":["{{cancelledSeatId}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}.\nLần 2: POST {{baseUrl}}/trips/{{departedTripId}}/seat-holds; Idempotency-Key: hold-book07-departed-01; body: {"seatIds":["{{departedSeatId}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}.\nMong đợi cả hai lần: 409 TRIP_NOT_SELLABLE; không tạo hold.');
set('P19', 'Trước test: 2B AVAILABLE.\nPOST {{baseUrl}}/trips/{{tripId}}/seat-holds hai lần với cùng customerToken01, cùng body {"seatIds":["{{seatId2B}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"} và cùng một Idempotency-Key đã khai báo là {{idempotencyKey08}}. Khai báo key mới cho mỗi lượt test, nhưng giữ nguyên key trong hai request của cùng lượt.\nMong đợi: hai response cùng holdToken; chỉ một hold cho 2B; release hold sau kiểm tra.');
set('P20', 'Dữ liệu nền: 1B và 1C AVAILABLE trên T1.\nCả hai POST: Header Authorization: Bearer {{customerToken01}}; Content-Type: application/json.\nLazy: POST {{baseUrl}}/trips/{{tripId}}/seat-holds, key {{idempotencyKey09Lazy}}, body {"seatIds":["{{seatId1C}}"],"pickupStopId":"{{pickupStopId01}}","dropoffStopId":"{{dropoffStopId01}}"}; chờ hết hạn rồi GET seats, xác nhận 1C AVAILABLE và hold EXPIRED.\nProactive: POST cùng URL, key {{idempotencyKey09Proactive}}, body dùng {{seatId1B}} và hai stop ID trên; chờ TTL tự nhiên, kiểm tra DB trước GET: hold EXPIRED, released_at có giá trị, 1B AVAILABLE; sau đó GET seats xác nhận.');

const legend = workbook.worksheets.add('SeatHold Data');
legend.getRange('A1:C1').values = [['Alias Postman', 'Ý nghĩa', 'Giá trị / cách lấy']];
legend.getRange('A2:C24').values = [
  ['{{baseUrl}}', 'Địa chỉ API gốc', 'http://localhost:5080/api/v1'],
  ['{{tripId}}', 'T1, chuyến Đà Nẵng–Huế', '01990a00-0000-7000-8000-000000000007'],
  ['{{customerId01}}', 'Tài khoản Customer 1', 'seed.customer@example.test / CustomerPass1'],
  ['{{customerToken01}}', 'Token của Customer 1', 'accessToken trong response POST /auth/login'],
  ['{{customerId02}}', 'Tài khoản Customer 2', 'pbl6.r3.customer.two@example.test / CorrectHorse1; tài khoản test đã xác minh'],
  ['{{customerToken02}}', 'Token của Customer 2', 'accessToken trong response POST /auth/login'],
  ['{{seatId1A}}', 'Ghế 1A', '01990a00-0000-7000-8000-000000000021'],
  ['{{seatId1B}}', 'Ghế 1B', '01990a00-0000-7000-8000-000000000022'],
  ['{{seatId1C}}', 'Ghế 1C', '01990a00-0000-7000-8000-000000000041'],
  ['{{seatId1D}}', 'Ghế 1D', '01990a00-0000-7000-8000-000000000042'],
  ['{{seatId2A}}', 'Ghế 2A', '01990a00-0000-7000-8000-000000000043'],
  ['{{seatId2B}}', 'Ghế 2B', '01990a00-0000-7000-8000-000000000044'],
  ['{{pickupStopId01}}', 'Điểm đón trên T1', '01990a00-0000-7000-8000-000000000004'],
  ['{{dropoffStopId01}}', 'Điểm trả trên T1', '01990a00-0000-7000-8000-000000000005'],
  ['{{cancelledTripId}}', 'Chuyến CANCELLED', '01a18b07-9a75-756d-8f13-0d5e8c90a025'],
  ['{{cancelledSeatId}}', 'Ghế trên chuyến CANCELLED', '01a18b07-9f35-70ac-af07-934a5f14e04b'],
  ['{{departedTripId}}', 'Chuyến DEPARTED; fixture cô lập, khôi phục sau test', '01a18b06-7537-78b0-8952-4413bcadc98d'],
  ['{{departedSeatId}}', 'Ghế trên chuyến DEPARTED', '01a18b06-7de0-70e3-9240-eddb86a03f8f'],
  ['{{idempotencyKey08}}', 'Key cho cặp request BOOK-08', 'Tạo key mới mỗi lượt test; giữ nguyên cho cả hai request trong cặp'],
  ['{{idempotencyKey09Lazy}}', 'Key cho hold lazy BOOK-09', 'Tạo key riêng cho hold ghế 1C'],
  ['{{idempotencyKey09Proactive}}', 'Key cho hold proactive BOOK-09', 'Tạo key riêng cho hold ghế 1B'],
  ['{{$guid}}', 'GUID động trong Postman', 'Postman tự sinh; dùng suffix khác nhau cho hai request đồng thời'],
  ['Content-Type', 'Header cho body JSON', 'application/json'],
];
legend.getRange('A1:C24').format.font = { name: 'Arial', size: 10 };
legend.getRange('A1:C1').format = { fill: '#548235', font: { name: 'Arial', size: 10, bold: true, color: '#FFFFFF' } };
legend.getRange('A:A').format.columnWidth = 29;
legend.getRange('B:B').format.columnWidth = 47;
legend.getRange('C:C').format.columnWidth = 74;
legend.getRange('A1:C24').format.wrapText = true;

await workbook.recalculate();
const file = await SpreadsheetFile.exportXlsx(workbook);
await file.save(output);
const preview = await workbook.render({ sheetName: 'Booking_SeatHold', range: 'A1:P20', scale: 1, format: 'png' });
await fs.writeFile('qa-booking-aliases.png', new Uint8Array(await preview.arrayBuffer()));
const legendPreview = await workbook.render({ sheetName: 'SeatHold Data', range: 'A1:C24', scale: 1, format: 'png' });
await fs.writeFile('qa-seathold-data.png', new Uint8Array(await legendPreview.arrayBuffer()));
console.log('SAVED', output);
console.log((await workbook.inspect({ kind: 'region', sheetId: 'Booking_SeatHold', range: 'B9:P20', maxChars: 8000 })).ndjson);
