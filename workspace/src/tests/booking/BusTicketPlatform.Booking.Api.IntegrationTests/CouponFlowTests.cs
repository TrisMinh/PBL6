using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using BusTicketPlatform.Booking.Application;

namespace BusTicketPlatform.Booking.Api.IntegrationTests;

[Collection("BookingApi")]
public sealed class CouponFlowTests(BookingPostgresFixture fixture)
{
    [Theory]
    [InlineData("valid")]
    [InlineData("expired")]
    [InlineData("future")]
    [InlineData("disabled")]
    [InlineData("minimum")]
    [InlineData("organization")]
    public async Task Coupon_conditions_and_booking_amount_are_enforced(string scenario)
    {
        var client=fixture.CreateClient(); var trip=Guid.CreateVersion7(); var org=Guid.CreateVersion7();
        var from=Guid.CreateVersion7(); var to=Guid.CreateVersion7();
        var user=Guid.CreateVersion7(); var token=TestJwt.Mint(user,["CUSTOMER"]);
        var imported=await client.PostAsJsonAsync("/api/v1/internal/trips/published",new {
            tripId=trip,organizationId=org,routeId=Guid.CreateVersion7(),busId=Guid.CreateVersion7(),
            originStopId=from,destinationStopId=to,departureAt=DateTimeOffset.UtcNow.AddDays(3),arrivalAt=DateTimeOffset.UtcNow.AddDays(3).AddHours(6),
            currency="VND",status="SCHEDULED",sourceTripVersion=1,
            routeSnapshot="{}",busSnapshot=JsonSerializer.Serialize(new {seats=new[]{
              new {id=Guid.CreateVersion7(),code="A01",deck=1,row=1,column=1,type="STANDARD",active=true},
              new {id=Guid.CreateVersion7(),code="A02",deck=1,row=1,column=2,type="STANDARD",active=true}}}),
            farePolicySnapshot="{\"baseFare\":300001,\"allowPayLater\":false,\"policyVersion\":\"cancel-mvp-v1\"}"
        });
        Assert.Equal(HttpStatusCode.Accepted,imported.StatusCode);
        var seats=(await Send(client,HttpMethod.Get,$"/api/v1/trips/{trip}/seats",null,token)).Body.GetProperty("seats").EnumerateArray().Select(s=>s.GetProperty("id").GetGuid()).ToArray();
        var held=await Send(client,HttpMethod.Post,$"/api/v1/trips/{trip}/seat-holds",new {seatIds=seats,pickupStopId=from,dropoffStopId=to},token);
        Assert.Equal(HttpStatusCode.Created,held.Status);
        var hold=held.Body.GetProperty("holdToken").GetString(); var code="TEST"+Guid.NewGuid().ToString("N")[..12].ToUpperInvariant();
        var rule=new CouponDto(code,20,50001,scenario=="minimum"?700000:250000,scenario=="organization"?Guid.NewGuid():null,
            scenario=="future"?DateTimeOffset.UtcNow.AddDays(1):DateTimeOffset.UtcNow.AddDays(-2),
            scenario=="expired"?DateTimeOffset.UtcNow.AddDays(-1):DateTimeOffset.UtcNow.AddDays(2),scenario!="disabled");
        Assert.Equal(HttpStatusCode.Forbidden,(await Send(client,HttpMethod.Put,"/api/v1/admin/coupons",rule,token)).Status);
        var admin=TestJwt.Mint(Guid.NewGuid(),["PLATFORM_ADMIN"]);
        Assert.Equal(HttpStatusCode.OK,(await Send(client,HttpMethod.Put,"/api/v1/admin/coupons",rule,admin)).Status);
        var quote=await Send(client,HttpMethod.Post,"/api/v1/coupons/quote",new{holdToken=hold,code=code.ToLowerInvariant()},token);
        if(scenario!="valid") { Assert.False((int)quote.Status<300,quote.Body.ToString()); return; }
        Assert.Equal(HttpStatusCode.OK,quote.Status);Assert.Equal(50001,quote.Body.GetProperty("discount").GetInt64());
        Assert.Equal(550001,quote.Body.GetProperty("total").GetInt64());
        Assert.Equal(HttpStatusCode.NotFound,(await Send(client,HttpMethod.Post,"/api/v1/coupons/quote",new{holdToken=hold,code},TestJwt.Mint(Guid.NewGuid(),["CUSTOMER"]))).Status);
        object Body(long total)=>new{holdToken=hold,couponCode=code,contact=new{fullName="Coupon Customer",email="coupon@example.test",phone="+84911111111"},passengers=seats.Select(id=>new{seatId=id,fullName="Passenger",pickupStopId=from,dropoffStopId=to}),expectedTotal=total,currency="VND",paymentChannel="PREPAID"};
        Assert.False((int)(await Send(client,HttpMethod.Post,"/api/v1/bookings",Body(1),token)).Status<300);
        var attempt=Guid.NewGuid().ToString("N");var booked=await Send(client,HttpMethod.Post,"/api/v1/bookings",Body(550001),token,attempt);
        Assert.Equal(HttpStatusCode.Created,booked.Status);Assert.Equal(600002,booked.Body.GetProperty("subtotal").GetInt64());
        Assert.Equal(50001,booked.Body.GetProperty("discount").GetInt64());Assert.Equal(code,booked.Body.GetProperty("couponCode").GetString());
        var id=booked.Body.GetProperty("id").GetGuid();
        var replay=await Send(client,HttpMethod.Post,"/api/v1/bookings",Body(550001),token,attempt);Assert.Equal(id,replay.Body.GetProperty("id").GetGuid());
        var saved=await Send(client,HttpMethod.Get,$"/api/v1/bookings/{id}",null,token);Assert.Equal(50001,saved.Body.GetProperty("discount").GetInt64());
        var paid=await client.PostAsJsonAsync("/api/v1/internal/payments/succeeded",new{bookingId=id,paymentId=Guid.NewGuid(),amount=550001,currency="VND"});Assert.Equal(HttpStatusCode.NoContent,paid.StatusCode);
        var tickets=(await Send(client,HttpMethod.Get,$"/api/v1/bookings/{id}/tickets",null,token)).Body.EnumerateArray().ToArray();Assert.Equal(2,tickets.Length);
        Assert.Equal(550001,tickets.Sum(t=>t.GetProperty("unitPrice").GetInt64()));
        var preview=await Send(client,HttpMethod.Post,$"/api/v1/bookings/{id}/cancellation-preview",new{ticketIds=tickets.Select(t=>t.GetProperty("id").GetGuid()).ToArray()},token);
        Assert.Equal(HttpStatusCode.OK,preview.Status);Assert.Equal(550001,preview.Body.GetProperty("fee").GetInt64()+preview.Body.GetProperty("refundAmount").GetInt64());
    }
    private static async Task<(HttpStatusCode Status,JsonElement Body)> Send(HttpClient c,HttpMethod method,string path,object? body,string token,string? attempt=null)
    {
        using var req=new HttpRequestMessage(method,path);req.Headers.Authorization=new AuthenticationHeaderValue("Bearer",token);
        if(body is not null)req.Content=JsonContent.Create(body);if(method==HttpMethod.Post)req.Headers.Add("Idempotency-Key",attempt??Guid.NewGuid().ToString("N"));
        var response=await c.SendAsync(req);var content=await response.Content.ReadAsStringAsync();
        return(response.StatusCode,string.IsNullOrEmpty(content)?default:JsonSerializer.Deserialize<JsonElement>(content));
    }
}
