from pathlib import Path
from copy import copy
from datetime import datetime
import json
from openpyxl import load_workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.worksheet.table import Table, TableStyleInfo

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(r'C:\Users\minht\Downloads\Test_Report_API_Round2_2ChucNang.xlsx')
OUT = ROOT / 'outputs/pbl6-round3/Test_Report_API_Round3_Preserved.xlsx'
AUTH_RUN = json.loads((ROOT / 'outputs/pbl6-round3/auth-fixed-run.json').read_text(encoding='utf-8'))['run']['summary']
BOOK_RUN = json.loads((ROOT / 'outputs/pbl6-round3/booking-fixed-run2.json').read_text(encoding='utf-8'))['run']['summary']
run = {
    'executedRequests': {'executed': AUTH_RUN['executedRequests']['executed'] + BOOK_RUN['executedRequests']['executed']},
    'tests': {
        'executed': AUTH_RUN['tests']['executed'] + BOOK_RUN['tests']['executed'],
        'passed': AUTH_RUN['tests']['passed'] + BOOK_RUN['tests']['passed'],
        'failed': AUTH_RUN['tests']['failed'] + BOOK_RUN['tests']['failed'],
    },
    'timeStats': BOOK_RUN['timeStats'],
}
wb = load_workbook(SOURCE)

# Preserve all Round 1 and Round 2 data/formulas from the user's source workbook.
cover = wb['Cover']
cover['F5'] = datetime(2026, 11, 2)
cover['F6'] = '3.0'
cover['B6'] = 'PBL6_API_TestReport_Round3_v3.0'
cover['A15'] = datetime(2026, 11, 2)
cover['B15'] = '3.0'
cover['C15'] = 'Kết quả Round 3'
cover['D15'] = 'M'
cover['E15'] = 'Sửa các điểm lệch SRS được nêu; bổ sung kết quả Round 3 và minh chứng Postman CLI trên Docker project pbl6-r2. Giữ nguyên kết quả Round 1 và Round 2.'
cover['F15'] = 'outputs/pbl6-round3/two_features-run-r2.json'
for cell in cover[15]:
    if cell.column <= 6:
        cell._style = copy(cover[14][cell.column-1]._style)
        cell.alignment = copy(cover[14][cell.column-1].alignment)
cover['A15'].number_format = 'yyyy-mm-dd'

auth = wb['Auth_Register']
book = wb['Booking_SeatHold']

# Clarify test data against actual SRS rules and avoid inconsistent setup claims.
auth['P13'] = auth['P13'].value.replace(
    'Dữ liệu nền: an.nguyen@pbl6.test đã là tài khoản đang hoạt động (tạo ở AUTH-01 và đã kích hoạt).',
    'Dữ liệu nền: seed.customer@example.test / +840000000001 là tài khoản ACTIVE đã được tạo sẵn trong môi trường test (không dùng tài khoản AUTH-01 đang ở trạng thái chưa kích hoạt).')
auth['P13'] = auth['P13'].value.replace('an.nguyen@pbl6.test', 'seed.customer@example.test')
auth['P13'] = auth['P13'].value.replace('0901000002', '0901000002')
auth['P14'] = auth['P14'].value.replace(
    'Dữ liệu nền: SĐT 0901000001 đã thuộc tài khoản đang hoạt động.',
    'Dữ liệu nền: SĐT +840000000001 thuộc seed.customer@example.test, tài khoản ACTIVE có sẵn trong môi trường test.')
auth['P14'] = auth['P14'].value.replace('0901000001', '+840000000001')
auth['P18'] = auth['P18'].value.replace('giang.vo@pbl6.test', 'linh.pham@pbl6.test').replace('0901000005', '0901000007')
auth['P18'] = auth['P18'].value.replace('ví dụ 6 lần trong 1 phút', 'ví dụ 6 lần trong 1 phút (giả định để minh họa test; ngưỡng thực tế lấy theo cấu hình, SRS không ấn định số lần)')
auth['O18'] = 'Round 2: đạt; Round 3: gửi resend endpoint thành công; không kết luận ngưỡng số lần vì NFR-SEC-004 không ấn định con số.'

book['D13'] = book['D13'].value.replace('holdId/token', 'holdToken').replace('bản chụp giá', 'bản chụp giá và chính sách')
for cell in (book['P13'], book['D14'], book['P14'], book['P19'], book['P20'], wb['Test Cases']['E5']):
    if isinstance(cell.value, str):
        cell.value = cell.value.replace('holdId', 'holdToken')
book['P14'] = book['P14'].value.replace('cùng một holdToken', 'cùng một holdToken')
book['P19'] = book['P19'].value.replace('holdToken lần 1 = holdToken lần 2', 'holdToken lần 1 = holdToken lần 2')
test_cases = wb['Test Cases']
test_cases['D5'] = test_cases['D5'].value.replace('holdId', 'holdToken')
test_cases['E10'] = test_cases['E10'].value.replace('FR-BOOK-001..003/007; BR-SEAT; AC-SEAT-001/002', 'FR-BOOK-001..003/007; BR-BOOK-001; BR-SEAT; AC-SEAT-001/002; NFR-PERF-007')

# Round 3 values go in previously unused L:N; the existing I:K Round 2 columns remain intact.
header_fill = PatternFill('solid', fgColor='0B1F6A')
header_font = Font(name='Arial', bold=True, color='FFFFFF')
auth['L10'], auth['M10'], auth['N10'] = 'Round 3', 'Test date', 'Tester'
book['L10'], book['M10'], book['N10'] = 'Round 3', 'Test date', 'Tester'
for ws in (auth, book):
    for col in range(12, 15):
        target, reference = ws.cell(10, col), ws.cell(10, col-3)
        target._style = copy(reference._style)
        target.fill = copy(header_fill)
        target.font = copy(header_font)
        target.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    for row in range(11, ws.max_row+1):
        for col in range(12, 15):
            ws.cell(row, col)._style = copy(ws.cell(row, col-3)._style)
    ws.column_dimensions['L'].width = 13.87
    ws.column_dimensions['M'].width = 16.39
    ws.column_dimensions['N'].width = 13.0

auth_results = {
 'AUTH-01':('Passed','202 Accepted; OTP sandbox lấy từ Mailpit; xác minh thành công ở AUTH-06.'),
 'AUTH-02':('Passed','409 khi email đã tồn tại; dữ liệu nền là tài khoản ACTIVE có sẵn.'),
 'AUTH-03':('Passed','409 khi SĐT đã tồn tại; dữ liệu nền là tài khoản ACTIVE có sẵn.'),
 'AUTH-04':('Passed','400 VALIDATION_ERROR với dữ liệu không hợp lệ.'),
 'AUTH-05':('Passed','OTP được truy xuất từ Mailpit sandbox.'),
 'AUTH-06':('Passed','Verify OTP trả 200 và cấp phiên đăng nhập.'),
 'AUTH-07':('Passed','Resend trả 202; đây là smoke check endpoint, không khẳng định ngưỡng vì SRS không nêu số lần.'),
}
book_results = {
 'BOOK-01':('Passed','GET seats với customer token trả danh sách ghế; trạng thái quan sát hợp lệ AVAILABLE/BOOKED, trạng thái HELD được xác nhận trong BOOK-02/03.'),
 'BOOK-02':('Passed','API trả 201, holdToken, expiresAt, giá ghế và policySnapshot; snapshot được giữ nguyên khi đọc lại hold.'),
 'BOOK-03':('Passed','Một yêu cầu giữ 2 ghế trả 201; cả hai ghế HELD và dùng cùng holdToken; hold test được release.'),
 'BOOK-04':('Passed','Customer 2 giữ một ghế; request nhiều ghế của Customer 1 trả 409 SEAT_UNAVAILABLE; ghế còn lại vẫn AVAILABLE.'),
 'BOOK-05':('Passed','Hai request Postman gửi đồng thời cho cùng ghế; có đúng một 201 và một 409; hold thắng được release.'),
 'BOOK-06':('Passed','POST seat-holds không token trả 401 AUTHENTICATION_REQUIRED.'),
 'BOOK-07':('Passed','Chuyến CANCELLED trả HTTP 409 TRIP_NOT_SELLABLE theo SRS sau khi sửa mapping lỗi.'),
 'BOOK-08':('Passed','Gửi lại cùng body và Idempotency-Key trả cùng holdToken; hold test được release.'),
 'BOOK-09':('Passed','GET seats kích hoạt expiry cleanup cho hold quá expiresAt trong fixture R2; ghế 1C trở về AVAILABLE và DB ghi trạng thái EXPIRED.'),
}
for ws, mapping in ((auth, auth_results),(book,book_results)):
 for row in range(12, ws.max_row+1):
    case = ws.cell(row,1).value
    if case not in mapping: continue
    status, reason = mapping[case]
    ws.cell(row,12).value = status
    ws.cell(row,13).value = datetime(2026,11,2) if status in ('Passed','Failed') else None
    ws.cell(row,14).value = 'Minh Trí' if status in ('Passed','Failed') else None
    original_note = ws.cell(row,15).value or ''
    ws.cell(row,15).value = f'{original_note}\nRound 3: {reason}'
    ws.cell(row,15).alignment = Alignment(wrap_text=True, vertical='top')
    status_cell = ws.cell(row,12)
    status_cell.alignment = Alignment(horizontal='center', vertical='center')
    status_cell.font = Font(name='Arial', bold=True, color='FF000000')
    status_cell.fill = PatternFill('solid', fgColor={'Passed':'FFC6EFCE','Failed':'FFFFC7CE','Pending':'FFFFEB9C','N/A':'FFD9EAF7'}[status])

# Preserve all existing Round 1/Round 2 statistics and add a distinct Round 3 section.
stats = wb['Test Statistics']
stats['B9'] = 'Kết quả Round 2 (giữ nguyên số liệu gốc; 2026-10-30)'
stats['B33'] = 'Round 3 — Kiểm tra bổ sung và hồi quy (2026-11-02)'
for c in range(2,9):
    stats.cell(33,c)._style = copy(stats.cell(26,c)._style)
    stats.cell(33,c).fill = copy(header_fill)
    stats.cell(33,c).font = copy(header_font)
stats['B34'] = 'STT'; stats['C34'] = 'Module'; stats['D34'] = 'Đạt'; stats['E34'] = 'Lỗi'; stats['F34'] = 'Pending'; stats['G34'] = 'N/A'; stats['H34'] = 'Số ca kiểm thử'
for c in range(2,9):
    stats.cell(34,c)._style = copy(stats.cell(10,c)._style)
for row, (number, name) in enumerate(((1,'Auth_Register'),(2,'Booking_SeatHold')), start=35):
    feature = wb[name]
    stats.cell(row,2).value = number
    stats.cell(row,3).value = f'={name}!B2'
    stats.cell(row,4).value = f'=COUNTIF({name}!L12:L100, "Passed")'
    stats.cell(row,5).value = f'=COUNTIF({name}!L12:L100, "Failed")'
    stats.cell(row,6).value = f'=COUNTIF({name}!L12:L100, "Pending")'
    stats.cell(row,7).value = f'=COUNTIF({name}!L12:L100, "N/A")'
    stats.cell(row,8).value = f'=COUNTA({name}!A12:A100)'
    for c in range(2,9): stats.cell(row,c)._style = copy(stats.cell(28 if name=='Auth_Register' else 29,c)._style)
stats['C37']='Sub total'
for col in 'DEFGH': stats[f'{col}37']=f'=SUM({col}35:{col}36)'
for c in range(2,9): stats.cell(37,c)._style=copy(stats.cell(30,c)._style)
stats['B39']='Round 3 — Postman CLI trên Docker project pbl6-r2'
stats['C39']=f"{run['executedRequests']['executed']} requests; {run['tests']['passed']} assertions Passed, {run['tests']['failed']} Failed; chi tiết trong run JSON đính kèm."
stats.merge_cells('C39:H39')
stats['C40']='Độ bao phủ test case Round 3';stats['D40']='=(D37+E37)/H37';stats['E40']='% đã thực thi'
stats['F40']='=D37/H37';stats['G40']='% Passed trên tổng ca'
stats['C41']='Tỷ lệ Passed trong các ca đã chạy';stats['D41']='=D37/(D37+E37)';stats['E41']='% Passed / (Passed + Failed)'
stats['C42']='Round 2 giữ nguyên';stats['D42']='13 Passed / 3 Failed';stats['E42']='81.25% successful; 100% coverage'
for cell in ('D40','F40','D41'): stats[cell].number_format='0.00%'
for r in (39,40,41,42):
    for c in range(2,9): stats.cell(r,c).alignment=Alignment(wrap_text=True,vertical='center')
thin_blue = Side(style='thin', color='FFB4C6E7')
for r in range(33,38):
    for c in range(2,9):
        cell=stats.cell(r,c)
        cell.border=Border(left=thin_blue,right=thin_blue,top=thin_blue,bottom=thin_blue)
        if r in (35,): cell.fill=PatternFill('solid',fgColor='FFF2F6FC')
for c in range(2,9):
    cell=stats.cell(37,c);cell.fill=PatternFill('solid',fgColor='FF000080');cell.font=Font(name='Arial',bold=True,color='FFFFFFFF');cell.border=Border(left=thin_blue,right=thin_blue,top=thin_blue,bottom=thin_blue)
for r in range(39,43):
    for c in range(3,9):
        stats.cell(r,c).border=Border(left=thin_blue,right=thin_blue,top=thin_blue,bottom=thin_blue)
        if c==3: stats.cell(r,c).fill=PatternFill('solid',fgColor='FFEAF1F8');stats.cell(r,c).font=Font(name='Arial',bold=True,color='FF17365D')
for cell in ('D40','F40','D41'):
    stats[cell].fill=PatternFill('solid',fgColor='FFE2F0D9');stats[cell].font=Font(name='Arial',bold=True,color='FF006100',size=12)
stats.row_dimensions[39].height=30;stats.row_dimensions[40].height=32;stats.row_dimensions[41].height=30;stats.row_dimensions[42].height=30

ev = wb.create_sheet('Round3 Evidence')
evidence_rows = [
 ['Round 3 evidence','Result'],
 ['Docker compose project','pbl6-r2'],
 ['PostgreSQL volume','pbl6-r2_postgres-data (kept; no reset/drop)'],
 ['Execution date','2026-11-02'],
 ['Postman collections','Auth: workspace/postman/r3_two_features.postman_collection.json; Booking: workspace/postman/r3_pending_booking_cases.postman_collection.json'],
 ['Run JSON evidence','outputs/pbl6-round3/auth-fixed-run.json; outputs/pbl6-round3/booking-fixed-run2.json'],
 ['Requests executed',run['executedRequests']['executed']],
 ['Assertions executed',run['tests']['executed']],
 ['Assertions passed',run['tests']['passed']],
 ['Assertions failed',run['tests']['failed']],
 ['Response average (ms)',run['timeStats']['responseAverage']],
 ['Round 1 historical result','9 Passed / 7 Failed; preserved from source workbook.'],
 ['Round 2 historical result','13 Passed / 3 Failed; 81.25% successful; preserved from source workbook.'],
 ['Round 3 test case status','16 Passed / 0 Failed / 0 Pending out of 16.'],
 ['Round 3 execution coverage','100% (16/16 test cases executed).'],
 ['Round 3 pass rate','100% (16/16); Round 2 was 81.25% (13/16), so Round 3 improved by 18.75 percentage points.'],
 ['BOOK-02 fix','SeatHold API returns and persists policySnapshot with the hold; regression check passes on create and readback.'],
 ['BOOK-07 fix','TRIP_NOT_SELLABLE now maps to HTTP 409 Conflict; regression check passes.'],
 ['AUTH-07 limitation','Smoke check confirms resend returns 202. The SRS does not specify the numeric rate limit threshold.'],
]
for row in evidence_rows: ev.append(row)
ev.freeze_panes='A2';ev.column_dimensions['A'].width=34;ev.column_dimensions['B'].width=105
for cell in ev[1]: cell.fill=copy(header_fill);cell.font=copy(header_font)
for row in ev.iter_rows(min_row=2):
    for cell in row: cell.alignment=Alignment(wrap_text=True,vertical='top')
evidence_table=Table(displayName='Round3RunEvidence',ref=f'A1:B{ev.max_row}')
evidence_table.tableStyleInfo=TableStyleInfo(name='TableStyleMedium2',showFirstColumn=False,showLastColumn=False,showRowStripes=True,showColumnStripes=False)
ev.add_table(evidence_table)

for ws in wb:
    ws.sheet_view.showGridLines=False
    ws.sheet_properties.pageSetUpPr.fitToPage=True
    ws.page_setup.fitToWidth=1
    ws.page_setup.fitToHeight=0
wb.calculation.fullCalcOnLoad = True
wb.calculation.forceFullCalc = True
wb.calculation.calcMode = 'auto'
wb.save(OUT)
print(json.dumps({'output':str(OUT),'round2_preserved':'13 passed / 3 failed; 100% coverage','round3':{'passed_cases':16,'failed_cases':0,'pending_cases':0,'execution_coverage':'100%','pass_rate':'100%','postman_assertions':run['tests']}},ensure_ascii=False,indent=2))


