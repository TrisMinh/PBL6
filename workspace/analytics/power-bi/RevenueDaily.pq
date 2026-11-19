let
    Source = PostgreSQL.Database(ReportingServer, ReportingDatabase, [CreateNavigationProperties = false]),
    RevenueDaily = Source{[Schema = "bi", Item = "operator_revenue_daily"]}[Data],
    Typed = Table.TransformColumnTypes(RevenueDaily, {
        {"period_date", type date},
        {"currency", type text},
        {"gross_revenue", Int64.Type},
        {"refund_amount", Int64.Type},
        {"net_revenue", Int64.Type},
        {"platform_commission", Int64.Type},
        {"operator_payable", Int64.Type},
        {"unsettled_amount", Int64.Type},
        {"payment_count", Int64.Type},
        {"refund_count", Int64.Type},
        {"data_as_of", type datetimezone}
    })
in
    Typed
