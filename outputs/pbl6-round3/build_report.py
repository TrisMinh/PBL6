from pathlib import Path
from datetime import datetime
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
import json, shutil

root=Path(__file__).resolve().parents[2]
source=Path(r'C:\Users\minht\Downloads\Test_Report_API_Round2_2ChucNang.xlsx')
out=root/'outputs/pbl6-round3/Test_Report_API_Round3.xlsx'
shutil.copy2(source,out)
wb=load_workbook(out)
run=json.loads((root/'outputs/pbl6-round3/two_features-run-r2.json').read_text(encoding='utf-8'))['run']
summary=run['summary']
counts={'Auth_Register':(7,0,0),'Booking_SeatHold':(2,0,7)}
auth_status={
 'AUTH-01':('Passed','Đăng ký trả 202 ACCEPTED; OTP đã lấy từ Mailpit và verify thành công ở AUTH-06.'),
 'AUTH-02':('Passed','409 khi email đã tồn tại sau bước AUTH-01; tài khoản đã được verify thành công.'),
 'AUTH-03':('Passed','409 khi SĐT đã tồn tại sau bước AUTH-01; tài khoản đã được verify thành công.'),
 'AUTH-04':('Passed','400 VALIDATION_ERROR với dữ liệu không hợp lệ.'),
 'AUTH-05':('Passed','OTP sandbox Mailpit truy xuất được; challengeId/code được dùng ở AUTH-06.'),
 'AUTH-06':('Passed','Verify OTP trả 200 và cấp accessToken.'),
 'AUTH-07':('Passed','Resend trả 202. Chỉ xác nhận endpoint hoạt động; không kết luận ngưỡng vì NFR-SEC-004 không chỉ định số lần.'),
}
book_status={
 'BOOK-01':('Pending','Không chạy kiểm tra danh sách ghế với phiên đăng nhập và fixture T1/ghế ở trạng thái yêu cầu; collection chỉ xác nhận truy cập ẩn danh bị 401.'),
 'BOOK-02':('Pending','Chưa chạy tạo SeatHold có xác thực; thiếu customer token và fixture trip/seat/stop phù hợp.'),
 'BOOK-03':('Pending','Chưa chạy giữ nhiều ghế có xác thực; thiếu fixture trip/seat/stop và token.'),
 'BOOK-04':('Pending','Chưa dựng trạng thái ghế bị giữ cạnh tranh và xác minh all-or-nothing trong lần chạy này.'),
 'BOOK-05':('Pending','Chưa chạy hai request giữ ghế đồng thời với hai customer token.'),
 'BOOK-06':('Passed','Postman xác nhận POST seat-holds không token trả 401.'),
 'BOOK-07':('Pending','Không có fixture chuyến CANCELLED/DEPARTED tương ứng để chạy negative case.'),
 'BOOK-08':('Pending','Chưa chạy replay Idempotency-Key trên yêu cầu giữ ghế hợp lệ.'),
 'BOOK-09':('Pending','Chưa tạo SeatHold để chờ expiresAt và xác nhận ghế được giải phóng.'),
}
for sheet_name, mapping in [('Auth_Register',auth_status),('Booking_SeatHold',book_status)]:
 ws=wb[sheet_name]
 ws['I10']='Round 3'; ws['J10']='Test date'; ws['K10']='Tester'
 for cell in ws[10][8:11]:
  cell.fill=PatternFill('solid',fgColor='0B1F6A');cell.font=Font(name='Arial',bold=True,color='FFFFFF');cell.alignment=Alignment(horizontal='center',vertical='center',wrap_text=True)
 passed=failed=pending=na=0
 for row in range(12,ws.max_row+1):
  case=str(ws.cell(row,1).value or '')
  if case not in mapping: continue
  status,note=mapping[case]
  ws.cell(row,9).value=status
  ws.cell(row,10).value=datetime(2026,11,2) if status in ('Passed','Failed') else None
  ws.cell(row,11).value='Minh Trí' if status in ('Passed','Failed') else None
  ws.cell(row,15).value=f'Round 3: {note}'
  ws.cell(row,15).alignment=Alignment(wrap_text=True,vertical='top')
  if status=='Passed': passed+=1
  elif status=='Failed': failed+=1
  elif status=='Pending': pending+=1
  else: na+=1
 ws['A7']='Round 3';ws['B7']=passed;ws['C7']=failed;ws['D7']=pending;ws['E7']=na
 ws.column_dimensions['I'].width=12;ws.column_dimensions['J'].width=13;ws.column_dimensions['K'].width=13;ws.column_dimensions['O'].width=62
 ws.freeze_panes='A12'
cover=wb['Cover']
cover['B6']='PBL6_API_TestReport_Round3_v3.0';cover['F5']=datetime(2026,11,2);cover['F6']='3.0'
cover.append(['',None,None,None,None,None])
cover['A15']=datetime(2026,11,2);cover['B15']='3.0';cover['C15']='Kết quả Round 3';cover['D15']='M';cover['E15']='Chỉnh nội dung theo đối chiếu SRS và cập nhật trạng thái từ Postman CLI trên Docker; Pending ghi rõ lý do.';cover['F15']='outputs/pbl6-round3/two_features-run-r2.json'
stats=wb['Test Statistics']
stats['B9']='Kết quả mới nhất — Round 3 (2026-11-02)'
stats['C6']='Báo cáo giới hạn đúng 2 chức năng. Round 3 chạy Postman CLI trên backend Docker: 9 request, 9 assertion pass, 0 fail. Cấp test case: Auth 7/7 Passed; SeatHold 1 Passed, 8 Pending (thiếu fixture/token để chạy nghiệp vụ có xác thực). Pending không được tính là đạt.'
stats['C6'].alignment=Alignment(wrap_text=True,vertical='top')
for r,name in [(11,'Auth_Register'),(12,'Booking_SeatHold')]:
 ws=wb[name];stats.cell(r,3).value=ws['B2'].value
 stats.cell(r,4).value=ws['B7'].value;stats.cell(r,5).value=ws['C7'].value;stats.cell(r,6).value=ws['D7'].value;stats.cell(r,7).value=ws['E7'].value;stats.cell(r,8).value=ws['B4'].value
stats['D14']='=SUM(D11:D12)';stats['E14']='=SUM(E11:E12)';stats['F14']='=SUM(F11:F12)';stats['G14']='=SUM(G11:G12)';stats['H14']='=SUM(H11:H12)'
stats['E16']='=(D14+E14)/H14';stats['E17']='=D14/H14'
ev=wb.create_sheet('Round3 Evidence')
rows=[['Round 3 — Postman API results','Value'],['Execution date','2026-11-02'],['Docker readiness','Docker project pbl6-r2; gateway http://localhost:5080/ready → healthy; DB volume pbl6-r2_postgres-data'],['Postman CLI requests',summary['executedRequests']['executed']],['Postman assertions passed',summary['tests']['passed']],['Postman assertions failed',summary['tests']['failed']],['Average response (ms)',summary['timeStats']['responseAverage']],['Feature test cases',16],['Passed test cases',8],['Failed test cases',0],['Pending test cases',8],['Test case execution coverage',(8/16)],['Pass rate among executed test cases',(8/8)],['Failure details','0 assertion failures in final run. Seven SeatHold cases remain Pending because required authenticated customer/seat/trip fixtures were not provisioned; details are in Notes on Booking_SeatHold.'],['Rate limit note','AUTH-07 only confirms resend endpoint returns 202. SRS NFR-SEC-004 defines rate limiting but no numeric threshold; no threshold claim is made.'],['Postman collection','workspace/postman/r3_two_features.postman_collection.json'],['JSON run evidence','outputs/pbl6-round3/two_features-run-r2.json']]
for row in rows:ev.append(row)
ev.freeze_panes='A2';ev.column_dimensions['A'].width=36;ev.column_dimensions['B'].width=110
for cell in ev[1]:cell.fill=PatternFill('solid',fgColor='0B1F6A');cell.font=Font(bold=True,color='FFFFFF')
for row in ev.iter_rows(min_row=2):
 for cell in row:cell.alignment=Alignment(wrap_text=True,vertical='top')
ev['B12'].number_format='0%';ev['B13'].number_format='0%'
for ws in wb:
 ws.sheet_view.showGridLines=False
wb.save(out)
print(json.dumps({'output':str(out),'postman':summary,'test_cases':{'passed':8,'failed':0,'pending':8,'total':16},'passRateExecuted':1.0,'coverage':0.5},ensure_ascii=False,indent=2))

