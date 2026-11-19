using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Messaging;
using BusTicketPlatform.Reporting.Application;
using BusTicketPlatform.Reporting.Infrastructure;
using Npgsql;

namespace BusTicketPlatform.Reporting.Api.IntegrationTests;

[Collection("ReportingApi")]
public sealed class RevenueReportTests(ReportingPostgresFixture fixture)
{
    [Fact]
    public async Task Operator_revenue_matches_bi_after_out_of_order_movements_and_replay()
    {
        using var client = fixture.CreateClient();
        var organization = Guid.NewGuid();
        var otherOrganization = Guid.NewGuid();
        var payment = Guid.NewGuid();
        var captureTime = new DateTimeOffset(2026, 11, 17, 16, 59, 59, TimeSpan.Zero);
        var refundTime = captureTime.AddSeconds(2);
        var capture = new RevenueMovement($"capture:{payment}", "CAPTURE", payment, organization, "VND", captureTime, 150001, 0, 0);
        var refund = capture with { MovementKey = $"refund:{payment}", Kind = "REFUND", EffectiveAt = refundTime, Amount = 50001 };
        var opening = capture with { MovementKey = $"opening:{payment}", Kind = "SETTLEMENT", Amount = 0, Commission = 18000, Payable = 132001 };
        var adjustment = opening with { MovementKey = $"adjustment:{payment}", EffectiveAt = refundTime, Commission = -6000, Payable = -44001 };
        var other = capture with { MovementKey = $"other:{payment}", OrganizationId = otherOrganization, Amount = 900000 };
        var anotherCurrency = capture with { MovementKey = $"usd:{payment}", Currency = "USD", Amount = 500 };

        foreach (var movement in new[] { refund, adjustment, capture, opening, other, anotherCurrency, capture, refund })
        {
            var message = new EventMessage(Guid.NewGuid(), "RevenueMovementRecorded", 1, DateTimeOffset.UtcNow,
                "payment", Guid.NewGuid(), movement.PaymentId, JsonSerializer.SerializeToElement(movement, EventMessageJson.Options),
                TenantId: movement.OrganizationId);
            await ReportingEventHandlers.HandleAsync(fixture.Factory.Services, message, default);
        }

        using var request = Request(organization, ["PLATFORM_FINANCE", "OPERATOR_FINANCE"], new(2026, 11, 17), new(2026, 11, 18));
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        using var report = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var all = report.RootElement.GetProperty("data").EnumerateArray().ToArray();
        Assert.Equal(3, all.Length);
        Assert.All(all, row => Assert.Equal(organization, row.GetProperty("organizationId").GetGuid()));
        Assert.Equal(500, all.Single(row => row.GetProperty("currency").GetString() == "USD").GetProperty("grossRevenue").GetInt64());
        var rows = all.Where(row => row.GetProperty("currency").GetString() == "VND").ToArray();
        Assert.Equal("2026-11-17", rows[0].GetProperty("periodDate").GetString());
        Assert.Equal(150001, rows[0].GetProperty("grossRevenue").GetInt64());
        Assert.Equal(1, rows[0].GetProperty("paymentCount").GetInt64());
        Assert.Equal("2026-11-18", rows[1].GetProperty("periodDate").GetString());
        Assert.Equal(-50001, rows[1].GetProperty("netRevenue").GetInt64());
        Assert.Equal(1, rows[1].GetProperty("refundCount").GetInt64());
        Assert.Equal(-6000, rows[1].GetProperty("platformCommission").GetInt64());
        Assert.Equal(-44001, rows[1].GetProperty("operatorPayable").GetInt64());
        Assert.Equal(0, rows[1].GetProperty("unsettledAmount").GetInt64());

        await using var connection = new NpgsqlConnection(fixture.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("""
            SELECT SUM(net_revenue) FROM bi.revenue_daily WHERE organization_id_external = @organization AND currency = 'VND';
            """, connection);
        command.Parameters.AddWithValue("organization", organization);
        Assert.Equal(100000m, await command.ExecuteScalarAsync());
    }

    [Fact]
    public async Task Revenue_without_rows_returns_unknown_freshness()
    {
        using var client = fixture.CreateClient();
        using var request = Request(Guid.NewGuid(), ["OPERATOR_ADMIN"], new(2026, 11, 17), new(2026, 11, 17));
        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();
        using var report = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Empty(report.RootElement.GetProperty("data").EnumerateArray());
        Assert.Equal(JsonValueKind.Null, report.RootElement.GetProperty("dataAsOf").ValueKind);
    }

    [Fact]
    public async Task Operator_role_from_another_membership_does_not_grant_revenue_access()
    {
        using var client = fixture.CreateClient();
        using var request = Request(Guid.NewGuid(), ["OPERATOR_FINANCE"], new(2026, 11, 17), new(2026, 11, 17), ["OPERATOR_SCHEDULER"]);
        using var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private static HttpRequestMessage Request(Guid organization, string[] roles, DateOnly from, DateOnly to, string[]? organizationRoles = null)
    {
        var start = Uri.EscapeDataString($"{from:yyyy-MM-dd}T00:00:00+07:00");
        var end = Uri.EscapeDataString($"{to:yyyy-MM-dd}T23:59:59.999999+07:00");
        var request = new HttpRequestMessage(HttpMethod.Get,
            $"/api/v1/reports/revenue?from={start}&to={end}&timezone=Asia%2FHo_Chi_Minh&operatorOnly=true");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer",
            TestJwt.Mint(Guid.NewGuid(), roles, organization, organizationRoles ?? roles.Where(role => role.StartsWith("OPERATOR_"))));
        return request;
    }
}
