"""Package the editable Operator PBIP source with synthetic data for offline opening."""

import argparse
import base64
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


FABRIC = "https://developer.microsoft.com/json-schemas/fabric/"
REPORT = "OperatorDashboard.Report"
MODEL = "OperatorDashboard.SemanticModel"
OPS = "BookingActivity"
FIN = "RevenueDaily"
CANVAS_WIDTH = 1280
CANVAS_HEIGHT = 936
OUTPUT = Path(__file__).resolve().parents[2] / "src/apps/web/public/analytics/operator-dashboard.zip"

OPS_COLUMNS = {
    "period_date": "dateTime", "route_name": "string", "payment_channel": "string",
    "status": "string", "customer_key": "string", "tickets": "int64", "boarded": "int64",
}
FIN_COLUMNS = {
    "period_date": "dateTime", "currency": "string", "booking_code": "string",
    "route_name": "string", "gross_revenue": "int64",
    "refund_amount": "int64", "net_revenue": "int64", "platform_commission": "int64",
    "operator_payable": "int64", "unsettled_amount": "int64", "payment_count": "int64",
    "refund_count": "int64",
}
OPS_MEASURES = {
    "Khách đặt vé duy nhất": f"CALCULATE(DISTINCTCOUNT({OPS}[customer_key]), {OPS}[tickets] > 0)",
    "Tổng đơn đặt vé": f"COUNTROWS({OPS})",
    "Vé hợp lệ": f"SUM({OPS}[tickets])",
    "Vé đã check-in": f"SUM({OPS}[boarded])",
}
FIN_MEASURES = {
    "Tiền thu": "gross_revenue", "Tiền hoàn": "refund_amount", "Thu ròng": "net_revenue",
    "Hoa hồng": "platform_commission", "Phải trả nhà xe": "operator_payable",
    "Chênh lệch đối soát": "unsettled_amount",
}
DEMO_FIN = [
    ((2026, 11, 17), "VND", "BKDEMO001", "Đà Nẵng – Hà Nội", 150001, 0, 150001, 18000, 132001, 0, 1, 0),
    ((2026, 11, 18), "VND", "BKDEMO001", "Đà Nẵng – Hà Nội", 0, 50001, -50001, -6000, -44001, 0, 0, 1),
    ((2026, 11, 18), "VND", "BKDEMO002", "Đà Nẵng – Hà Nội", 300000, 0, 300000, 30000, 270000, 0, 1, 0),
    ((2026, 11, 19), "VND", "BKDEMO002", "Đà Nẵng – Hà Nội", 0, 300000, -300000, -30000, -270000, 0, 0, 1),
    ((2026, 11, 19), "VND", "BKDEMO003", "Đà Nẵng – Huế", 225000, 0, 225000, 22500, 202500, 0, 1, 0),
]


def demo_operations():
    routes = ("Đà Nẵng – Huế", "Đà Nẵng – Lăng Cô – Huế", "Huế – Đà Nẵng")
    for trip in range(1, 19):
        for seat in (1, 2):
            marker = trip + seat
            cancelled = marker % 8 == 0
            cash = marker % 3 == 0
            boarded = cash or (seat == 1 and trip % 2 == 0)
            yield (
                (2026, 11, 17 + (trip + trip // 2 + seat) % 3), routes[trip % 3],
                "Trả tại nhà xe" if cash else "Trả trước",
                "Đã hủy" if cancelled else "Đã xác nhận" if cash else "Đã thanh toán",
                f"demo-{trip % 9}", int(not cancelled), int(boarded and not cancelled),
            )


def m_value(value):
    if isinstance(value, tuple):
        return "#date(" + ", ".join(map(str, value)) + ")"
    if isinstance(value, str):
        return '"' + value.replace('"', '""') + '"'
    return str(value)


def partition(columns, rows, database, view, localize=False, live=False):
    m_types = {"dateTime": "date", "string": "text", "int64": "number"}
    column_types = {"dateTime": "type date", "string": "type text", "int64": "Int64.Type"}
    fields = ", ".join(f"{name} = {m_types[kind]}" for name, kind in columns.items())
    types = ", ".join("{" + m_value(name) + ", " + column_types[kind] + "}" for name, kind in columns.items())
    demo_rows = ["        {" + ", ".join(map(m_value, row)) + "}" for row in rows]
    database_source = f'PostgreSQL.Database(DatabaseServer, {database}){{[Schema="bi", Item="{view}"]}}[Data]'
    if live:
        source = f"    Source = {database_source},"
    else:
        source = (
            f"    Source = if UseDemoData then #table(type table [{fields}], {{\n"
            + ",\n".join(demo_rows)
            + f"\n    }}) else {database_source},"
        )
    lines = [
        "let",
        source,
        "    Selected = Table.SelectColumns(Source, {" + ", ".join(map(m_value, columns)) + "}),",
        "    Typed = Table.TransformColumnTypes(Selected, {" + types + "}),",
    ]
    if localize:
        lines += [
            '    Labels = Table.TransformColumns(Typed, {{"payment_channel", each if _ = "PREPAID" then "Trả trước" else if _ = "PAY_LATER" then "Trả tại nhà xe" else _, type text}}),',
            '    StatusLabels = [PENDING_PAYMENT="Chờ thanh toán", CONFIRMED="Đã xác nhận", PAID="Đã thanh toán", COMPLETED="Đã hoàn thành", CANCELLED="Đã hủy", EXPIRED="Hết hạn", REFUND_PENDING="Chờ hoàn tiền", REFUNDED="Đã hoàn tiền"],',
            '    Localized = Table.TransformColumns(Labels, {{"status", each Record.FieldOrDefault(StatusLabels, _, _), type text}}),',
        ]
    source = "Localized" if localize else "Typed"
    lines.append(f'    Result = Table.AddColumn({source}, "period_axis", each Date.ToText([period_date], "dd/MM/yyyy", "vi-VN"), type text)')
    return "\n".join(lines + ["in", "    Result"])


def direct_query_partition(columns, database, view, *, localize=False):
    selected = list(columns)
    if localize:
        selected[selected.index("payment_channel")] = (
            "CASE payment_channel WHEN 'PREPAID' THEN 'Trả trước' "
            "WHEN 'PAY_LATER' THEN 'Trả tại nhà xe' ELSE payment_channel END AS payment_channel"
        )
        statuses = {
            "PENDING_PAYMENT": "Chờ thanh toán", "CONFIRMED": "Đã xác nhận",
            "PAID": "Đã thanh toán", "COMPLETED": "Đã hoàn thành",
            "CANCELLED": "Đã hủy", "EXPIRED": "Hết hạn",
            "REFUND_PENDING": "Chờ hoàn tiền", "REFUNDED": "Đã hoàn tiền",
        }
        cases = " ".join(f"WHEN '{key}' THEN '{label}'" for key, label in statuses.items())
        selected[selected.index("status")] = f"CASE status {cases} ELSE status END AS status"
    selected.append("to_char(period_date, 'DD/MM/YYYY') AS period_axis")
    sql = "SELECT " + ", ".join(selected) + f" FROM bi.{view}"
    return (
        "let\n"
        f"    Source = PostgreSQL.Database(DatabaseServer, {database}),\n"
        f"    Result = Value.NativeQuery(Source, {m_value(sql)}, null, [EnableFolding=true])\n"
        "in\n    Result"
    )


def table(name, columns, measures, expression, mode="import"):
    labels = {
        "period_date": "Ngày", "route_name": "Tuyến", "payment_channel": "Kênh thanh toán",
        "status": "Trạng thái", "currency": "Tiền tệ",
        "booking_code": "Mã đơn",
    }
    fields = [
        {"name": labels.get(key, key), "dataType": kind, "sourceColumn": key, "summarizeBy": "none",
         **({"formatString": "dd/MM/yyyy"} if kind == "dateTime" else {}),
         **({"isHidden": True} if key == "customer_key" else {})}
        for key, kind in columns.items()
    ]
    fields.append({"name": "Mốc ngày", "dataType": "string", "sourceColumn": "period_axis",
                   "summarizeBy": "none", "sortByColumn": "Ngày"})
    return {
        "name": name, "columns": fields,
        "measures": [{"name": key, "expression": dax, "formatString": "#,0;(#,0);0"} for key, dax in measures.items()],
        "partitions": [{"name": name, "mode": mode, "source": {"type": "m", "expression": expression}}],
    }


def schema(path, value):
    return {"$schema": FABRIC + path + "/schema.json", **value}


def definition(kind, version, value):
    return schema(f"item/report/definition/{kind}/{version}", value)


def column_field(entity, field):
    return {"Column": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": field}}


def literal(value):
    return {"expr": {"Literal": {"Value": value}}}


def visual(name, kind, placement, entity, groups, title):
    def projection(field, field_type):
        return {"field": {field_type: {"Expression": {"SourceRef": {"Entity": entity}}, "Property": field}},
                "queryRef": f"{entity}.{field}", "nativeQueryRef": field, "active": True}

    x, y, width, height = placement

    document = definition("visualContainer", "2.0.0", {
        "name": name,
        "position": {"x": x, "y": y, "width": width, "height": height},
        "visual": {
            "visualType": kind,
            "query": {"queryState": {role: {"projections": [projection(*field) for field in fields]} for role, fields in groups.items()}},
            "visualContainerObjects": {"title": [{"properties": {
                "show": literal("true"),
                "text": literal(f"'{title}'"),
                "fontColor": {"solid": {"color": literal("'#172f53'")}},
                "fontSize": literal("11D"),
                "bold": literal("true"),
            }}]},
            "drillFilterOtherVisuals": True,
        },
    })

    visual_config = document["visual"]
    containers = visual_config["visualContainerObjects"]
    containers["title"][0]["properties"]["fontSize"] = literal("13D")
    if kind == "card":
        containers["background"] = [{"properties": {
            "show": literal("true"),
            "color": {"solid": {"color": literal("'#F1F6FD'")}},
            "transparency": literal("0D"),
        }}]
        visual_config["objects"] = {
            "categoryLabels": [{"properties": {"show": literal("false")}}],
            "labels": [{"properties": {
                "fontSize": literal("24D"),
                "labelDisplayUnits": literal("1D"),
                "labelPrecision": literal("0L"),
            }}],
        }
    elif kind == "slicer":
        visual_config["objects"] = {"header": [{"properties": {"show": literal("false")}}]}
        if entity == FIN and title == "Ngày":
            visual_config["objects"]["data"] = [{"properties": {"mode": literal("'Between'")}}]
        elif entity == FIN and title == "Tiền tệ":
            visual_config["objects"]["selection"] = [{"properties": {"singleSelect": literal("true")}}]
    elif kind in ("tableEx", "pivotTable"):
        visual_config["objects"] = {
            "grid": [{"properties": {"rowPadding": literal("6L")}}],
            "columnHeaders": [{"properties": {"fontSize": literal("12D")}}],
            "values": [{"properties": {"fontSize": literal("11D")}}],
        }
    return document


def ops_charts():
    return [
        ("XuTheVe", "clusteredColumnChart", (32, 308, 596, 282), "Xu hướng vé theo ngày",
         {"Category": [("Mốc ngày", "Column")], "Y": [("Vé hợp lệ", "Measure"), ("Vé đã check-in", "Measure")]}),
        ("VeTheoTuyen", "barChart", (652, 308, 596, 282), "Vé theo tuyến và cách thanh toán",
         {"Category": [("Tuyến", "Column")], "Series": [("Kênh thanh toán", "Column")], "Y": [("Vé hợp lệ", "Measure")]}),
        ("TrangThai", "donutChart", (32, 616, 350, 288), "Đơn theo trạng thái",
         {"Category": [("Trạng thái", "Column")], "Y": [("Tổng đơn đặt vé", "Measure")]}),
        ("MaTran", "pivotTable", (406, 616, 842, 288), "Chi tiết vé theo ngày và tuyến",
         {"Rows": [("Ngày", "Column"), ("Tuyến", "Column")], "Columns": [("Kênh thanh toán", "Column")],
          "Values": [("Tổng đơn đặt vé", "Measure"), ("Vé hợp lệ", "Measure"), ("Vé đã check-in", "Measure")]}),
    ]


def finance_charts():
    return [
        ("DongTien", "clusteredColumnChart", (32, 308, 596, 282), "Tiền thu và hoàn theo ngày",
         {"Category": [("Mốc ngày", "Column")], "Y": [("Tiền thu", "Measure"), ("Tiền hoàn", "Measure")]}),
        ("ThuRong", "lineChart", (652, 308, 596, 282), "Thu ròng theo ngày",
         {"Category": [("Mốc ngày", "Column")], "Y": [("Thu ròng", "Measure")]}),
        ("DoanhThuTheoTuyen", "barChart", (32, 650, 1216, 282), "Doanh thu theo tuyến · Thu ròng",
         {"Category": [("Tuyến", "Column")], "Y": [("Thu ròng", "Measure")]}),
        ("DoiSoat", "tableEx", (32, 956, 1216, 288), "Đối soát theo ngày",
         {"Values": [("Ngày", "Column"), ("Tiền tệ", "Column")] + [(key, "Measure") for key in FIN_MEASURES]}),
    ]


def action_button(name, title, placement, action, **destination):
    x, y, width, height = placement
    return definition("visualContainer", "2.0.0", {
        "name": name,
        "position": {"x": x, "y": y, "width": width, "height": height},
        "visual": {
            "visualType": "actionButton",
            "objects": {
                "text": [
                    {"properties": {"show": literal("true")}},
                    {"properties": {"text": literal(f"'{title}'"), "fontSize": literal("13D")},
                     "selector": {"id": "default"}},
                ],
                "icon": [{"properties": {"show": literal("false")}}],
            },
            "visualContainerObjects": {"visualLink": [{"properties": {
                "show": literal("true"), "type": literal(f"'{action}'"),
                **{key: literal(f"'{value}'") for key, value in destination.items()},
            }}]},
            "drillFilterOtherVisuals": True,
        },
        "howCreated": "InsertVisualButton",
    })


def build(*, live=False, direct_query=False, server="localhost", booking="booking", reporting="reporting"):
    if direct_query and not live:
        raise ValueError("DirectQuery requires the live PostgreSQL source")
    files = {}
    files["OperatorDashboard.pbip"] = schema("pbip/pbipProperties/1.0.0", {
        "version": "1.0", "artifacts": [{"report": {"path": REPORT}}], "settings": {"enableAutoRecovery": True},
    })
    files[f"{REPORT}/definition.pbir"] = schema("item/report/definitionProperties/2.0.0", {
        "version": "4.0", "datasetReference": {"byPath": {"path": f"../{MODEL}"}},
    })
    files[f"{MODEL}/definition.pbism"] = schema("item/semanticModel/definitionProperties/1.0.0", {
        "version": "1.0", "settings": {},
    })
    finance_measures = {
        key: f"IF(HASONEVALUE({FIN}[Tiền tệ]), COALESCE(SUM({FIN}[{column}]), 0))"
        for key, column in FIN_MEASURES.items()
    }
    mode = "directQuery" if direct_query else "import"
    if direct_query:
        ops = direct_query_partition(OPS_COLUMNS, "BookingDatabase", "operator_booking_activity", localize=True)
        fin = direct_query_partition(FIN_COLUMNS, "ReportingDatabase", "operator_revenue_by_booking")
    else:
        ops = partition(OPS_COLUMNS, demo_operations(), "BookingDatabase", "operator_booking_activity", localize=True, live=live)
        fin = partition(FIN_COLUMNS, DEMO_FIN, "ReportingDatabase", "operator_revenue_by_booking", live=live)
    files[f"{MODEL}/model.bim"] = {
        "name": "BLUE Operator Dashboard", "compatibilityLevel": 1601,
        "model": {
            "culture": "vi-VN", "defaultPowerBIDataSourceVersion": "powerBI_V3",
            "expressions": [
                {"name": key, "kind": "m", "expression": f'{value} meta [IsParameterQuery=true, Type="{kind}", IsParameterQueryRequired=true]'}
                for key, kind, value in (
                    ([] if live else [("UseDemoData", "Logical", "true")])
                    + [
                        ("DatabaseServer", "Text", m_value(server)),
                        ("BookingDatabase", "Text", m_value(booking)),
                        ("ReportingDatabase", "Text", m_value(reporting)),
                    ]
                )
            ],
            "tables": [
                table(OPS, OPS_COLUMNS, OPS_MEASURES, ops, mode),
                table(FIN, FIN_COLUMNS, finance_measures, fin, mode),
            ],
        },
    }
    report = f"{REPORT}/definition"
    files[f"{report}/version.json"] = definition("versionMetadata", "1.0.0", {"version": "2.0.0"})
    files[f"{report}/report.json"] = definition("report", "2.0.0", {"themeCollection": {}})
    files[f"{report}/pages/pages.json"] = definition("pagesMetadata", "1.0.0", {
        "pageOrder": ["VanHanh", "TaiChinh", "ChiTietDonHang"], "activePageName": "VanHanh",
    })
    for page_id, title, entity, slicers, kpis, charts in [
        ("VanHanh", "Vận hành · Khách, đơn và vé", OPS, ("Ngày", "Tuyến", "Kênh thanh toán"), list(OPS_MEASURES), ops_charts()),
        ("TaiChinh", "Tài chính · Thu, hoàn và đối soát", FIN, ("Ngày", "Tiền tệ"), list(FIN_MEASURES)[:4], finance_charts()),
    ]:
        folder = f"{report}/pages/{page_id}"
        files[f"{folder}/page.json"] = definition("page", "2.0.0", {
            "name": page_id, "displayName": title, "displayOption": "FitToWidth",
            "width": CANVAS_WIDTH, "height": 1276 if page_id == "TaiChinh" else CANVAS_HEIGHT,
        })
        for i, field in enumerate(slicers):
            name = f"BoLoc{i}"
            files[f"{folder}/visuals/{name}/visual.json"] = visual(name, "slicer", (32 + i * 320, 28, 296, 110),
                entity, {"Values": [(field, "Column")]}, field)
        for i, field in enumerate(kpis):
            name = f"KPI{i}"
            files[f"{folder}/visuals/{name}/visual.json"] = visual(name, "card", (32 + i * 310, 160, 286, 122),
                entity, {"Values": [(field, "Measure")]}, field)
        for name, kind, placement, caption, groups in charts:
            files[f"{folder}/visuals/{name}/visual.json"] = visual(name, kind, placement, entity, groups, caption)

    detail_id = "ChiTietDonHang"
    detail = f"{report}/pages/{detail_id}"
    route = column_field(FIN, "Tuyến")
    route_filter = "BoLocTuyenChiTietDonHang"
    files[f"{detail}/page.json"] = definition("page", "2.0.0", {
        "name": detail_id, "displayName": "Chi tiết đơn hàng", "displayOption": "FitToWidth",
        "width": CANVAS_WIDTH, "height": 720, "visibility": "HiddenInViewMode",
        "filterConfig": {"filters": [{
            "name": route_filter, "field": route, "type": "Categorical", "howCreated": "Drillthrough",
        }]},
        "pageBinding": {
            "name": "DrillthroughChiTietDonHang", "type": "Drillthrough", "acceptsFilterContext": "Default",
            "parameters": [{"name": "ThamSoTuyenChiTietDonHang", "boundFilter": route_filter, "fieldExpr": route}],
        },
    })
    files[f"{report}/pages/TaiChinh/visuals/MoChiTietDonHang/visual.json"] = action_button(
        "MoChiTietDonHang", "Xem đơn của tuyến đã chọn", (978, 602, 270, 36), "Drillthrough",
        drillthroughSection=detail_id,
    )
    files[f"{detail}/visuals/QuayLai/visual.json"] = action_button(
        "QuayLai", "Quay lại Tài chính", (32, 24, 195, 44), "Back",
    )
    files[f"{detail}/visuals/DonHang/visual.json"] = visual(
        "DonHang", "tableEx", (32, 90, 1216, 598), FIN,
        {"Values": [(field, "Column") for field in ("Mã đơn", "Tuyến", "Tiền tệ")]
                   + [(field, "Measure") for field in ("Tiền thu", "Tiền hoàn", "Thu ròng")]},
        "Chi tiết đơn hàng trong khoảng ngày giao dịch đã chọn",
    )
    return files


def update_published_definition(path):
    """Apply layout and styling only to a PBIR definition returned by Fabric."""
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    desired = build()
    updated = set()
    required = {name.removeprefix(f"{REPORT}/") for name in desired
                if name.startswith(f"{REPORT}/definition/pages/")
                and name.endswith(("/page.json", "/visual.json"))}
    for part in payload["definition"]["parts"]:
        name = part["path"]
        if name not in required:
            continue
        target = desired[f"{REPORT}/{name}"]
        original = json.loads(base64.b64decode(part["payload"]))
        if name.endswith("/page.json"):
            for key in ("width", "height", "displayOption"):
                original[key] = target[key]
        else:
            if original["visual"]["visualType"] != target["visual"]["visualType"]:
                raise ValueError(f"Visual type changed for {name}")
            original["position"].update(target["position"])
            visual = original["visual"]
            desired_visual = target["visual"]
            for key in ("objects", "visualContainerObjects"):
                if key in desired_visual:
                    visual.setdefault(key, {}).update(desired_visual[key])
        part["payload"] = base64.b64encode(
            json.dumps(original, ensure_ascii=False).encode("utf-8")
        ).decode("ascii")
        updated.add(name)
    if updated != required:
        raise ValueError(f"Unexpected report definition. Missing parts: {sorted(required - updated)}")
    return payload


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Package the Operator Power BI project")
    parser.add_argument("--live", action="store_true", help="Build a PostgreSQL-only project")
    parser.add_argument("--direct-query", action="store_true", help="Use DirectQuery for both live tables")
    parser.add_argument("--server", default="localhost", help="PostgreSQL host or host:port")
    parser.add_argument("--booking-db", default="booking")
    parser.add_argument("--reporting-db", default="reporting")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--update-definition", type=Path, help="Apply layout to a Fabric PBIR definition")

    args = parser.parse_args()
    if args.update_definition:
        if not args.output:
            parser.error("--update-definition requires --output")
        args.output.write_text(
            json.dumps(update_published_definition(args.update_definition), ensure_ascii=False),
            encoding="utf-8",
        )
        raise SystemExit
    if args.direct_query and not args.live:
        parser.error("--direct-query requires --live")
    if args.live and not args.output:
        parser.error("--live requires an explicit --output outside the web public directory")
    output = (args.output or OUTPUT).resolve()
    if args.live and output.is_relative_to(OUTPUT.parents[1]):
        parser.error("Keep live Power BI projects outside the web public directory")
    data = io.BytesIO()
    with ZipFile(data, "w", ZIP_DEFLATED) as archive:
        for filename, content in build(live=args.live, direct_query=args.direct_query, server=args.server, booking=args.booking_db, reporting=args.reporting_db).items():
            archive.writestr(filename, json.dumps(content, ensure_ascii=False, indent=2) + "\n")
        if not args.live:
            archive.writestr("MO-BAO-CAO.txt", "Giải nén toàn bộ. Mở OperatorDashboard.pbip bằng Power BI Desktop và chọn Refresh để tải dữ liệu demo.\n")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(data.getvalue())
    print(output)
