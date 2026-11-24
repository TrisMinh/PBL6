import unittest

from build_operator_dashboard import FIN, MODEL, REPORT, build


class OperatorDashboardTests(unittest.TestCase):
    def test_route_chart_and_drillthrough_share_finance_fields(self):
        for options in ({}, {"live": True}, {"live": True, "direct_query": True}):
            with self.subTest(options=options):
                files = build(**options)
                pages = f"{REPORT}/definition/pages"
                finance = f"{pages}/TaiChinh/visuals"
                detail = f"{pages}/ChiTietDonHang"
                chart = files[f"{finance}/DoanhThuTheoTuyen/visual.json"]
                route = chart["visual"]["query"]["queryState"]["Category"]["projections"][0]["field"]
                page = files[f"{detail}/page.json"]
                binding = page["pageBinding"]
                self.assertEqual("Drillthrough", binding["type"])
                self.assertEqual("Default", binding["acceptsFilterContext"])
                self.assertEqual(route, binding["parameters"][0]["fieldExpr"])
                self.assertEqual(route, page["filterConfig"]["filters"][0]["field"])
                detail_table = files[f"{detail}/visuals/DonHang/visual.json"]
                columns = detail_table["visual"]["query"]["queryState"]["Values"]["projections"]
                self.assertIn(f"{FIN}.Mã đơn", [field["queryRef"] for field in columns])
                self.assertIn(f"{FIN}.Thu ròng", [field["queryRef"] for field in columns])
                self.assertEqual(f"{FIN}.Thu ròng", chart["visual"]["query"]["queryState"]["Y"]["projections"][0]["queryRef"])
                model = files[f"{MODEL}/model.bim"]["model"]
                table = next(table for table in model["tables"] if table["name"] == FIN)
                self.assertIn("operator_revenue_by_booking", table["partitions"][0]["source"]["expression"])


if __name__ == "__main__":
    unittest.main()
