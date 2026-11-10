#!/usr/bin/env python3
"""Create a formatted Excel workbook from the PBL6 Postman run payload."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.table import Table, TableStyleInfo


HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(color="FFFFFF", bold=True)
PASS_FILL = PatternFill("solid", fgColor="E2F0D9")
FAIL_FILL = PatternFill("solid", fgColor="FCE4D6")
THIN_GRAY = Side(style="thin", color="D9E2F3")


def write_sheet(ws, headers: list[str], rows: list[dict], keys: list[str], table_name: str) -> None:
    ws.append(headers)
    for row in rows:
        ws.append([row.get(key, "") for key in keys])

    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
    for cell in ws[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(bottom=THIN_GRAY)
    ws.row_dimensions[1].height = 30

    for row in ws.iter_rows(min_row=2):
        for cell in row:
            cell.alignment = Alignment(vertical="top", wrap_text=True)
            cell.border = Border(bottom=THIN_GRAY)
        result = row[headers.index("Kết quả")].value if "Kết quả" in headers else None
        if result:
            fill = PASS_FILL if str(result).lower() == "passed" else FAIL_FILL
            row[headers.index("Kết quả")].fill = fill

    for column_index, header in enumerate(headers, start=1):
        values = [str(ws.cell(row, column_index).value or "") for row in range(1, ws.max_row + 1)]
        width = min(max(max((len(value) for value in values), default=len(header)) + 2, len(header) + 2), 58)
        ws.column_dimensions[get_column_letter(column_index)].width = width

    if ws.max_row > 1:
        table = Table(displayName=table_name, ref=ws.dimensions)
        table.tableStyleInfo = TableStyleInfo(
            name="TableStyleMedium2",
            showFirstColumn=False,
            showLastColumn=False,
            showRowStripes=True,
            showColumnStripes=False,
        )
        ws.add_table(table)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input-json", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()

    data = json.loads(args.input_json.read_text(encoding="utf-8"))
    args.output.parent.mkdir(parents=True, exist_ok=True)

    wb = Workbook()
    summary = wb.active
    summary.title = "Round Summary"
    summary.append(["Vòng chạy", "Tổng test case", "Passed", "Failed", "Pending", "Kết luận", "Thời điểm chạy"])
    conclusion = "Passed" if data["failed"] == 0 and data["pending"] == 0 else "Failed"
    summary.append([
        data["round"],
        data["totalCases"],
        data["passed"],
        data["failed"],
        data["pending"],
        conclusion,
        data["generatedAt"],
    ])
    for cell in summary[1]:
        cell.fill = HEADER_FILL
        cell.font = HEADER_FONT
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    summary.freeze_panes = "A2"
    summary.column_dimensions["A"].width = 28
    summary.column_dimensions["B"].width = 18
    summary.column_dimensions["C"].width = 14
    summary.column_dimensions["D"].width = 14
    summary.column_dimensions["E"].width = 14
    summary.column_dimensions["F"].width = 16
    summary.column_dimensions["G"].width = 30
    for cell in summary[2]:
        cell.alignment = Alignment(vertical="top", wrap_text=True)
    summary["F2"].fill = PASS_FILL if conclusion == "Passed" else FAIL_FILL

    results = wb.create_sheet("Test Results")
    write_sheet(
        results,
        ["Vòng chạy", "Chức năng", "Test Case", "Tên test case", "Kết quả mong đợi", "Kết quả thực tế", "Kết quả"],
        data.get("cases", []),
        ["Round", "Function", "TestCase", "Name", "Expected", "Actual", "Result"],
        "ApiTestResults",
    )

    log_summary = wb.create_sheet("Log Summary")
    write_sheet(
        log_summary,
        ["Vòng chạy", "Chức năng", "Test Case", "Kết quả", "Assertion", "Lỗi", "Request"],
        data.get("logs", []),
        ["Round", "Function", "TestCase", "Result", "Assertion", "Error", "Request"],
        "ApiLogSummary",
    )

    wb.properties.title = "PBL6 API Test Log Summary"
    wb.properties.subject = "Auth Register and Booking SeatHold Postman execution"
    wb.properties.creator = "PBL6 Test Team"
    wb.save(args.output)
    print(f"Excel report written: {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
