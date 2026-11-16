using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace BusTicketPlatform.Booking.Api.IntegrationTests;

[Collection("BookingApi")]
public sealed class SeatHoldReplacementTests(BookingPostgresFixture fixture)
{
    [Fact]
    public async Task Replacement_is_atomic_owned_and_does_not_extend_the_original_deadline()
    {
        var client = fixture.CreateClient();
        var trip = Guid.CreateVersion7();
        var origin = Guid.CreateVersion7();
        var destination = Guid.CreateVersion7();
        var source = Enumerable.Range(0, 3).Select(_ => Guid.CreateVersion7()).ToArray();
        var imported = await client.PostAsJsonAsync("/api/v1/internal/trips/published", new {
            tripId = trip, organizationId = Guid.CreateVersion7(), routeId = Guid.CreateVersion7(), busId = Guid.CreateVersion7(), originStopId = origin, destinationStopId = destination,
            departureAt = DateTimeOffset.UtcNow.AddDays(2), arrivalAt = DateTimeOffset.UtcNow.AddDays(2).AddHours(3), currency = "VND", status = "SCHEDULED", sourceTripVersion = 1L, routeSnapshot = "{}",
            busSnapshot = JsonSerializer.Serialize(new { seats = source.Select((id,index) => new { id, code = "A0"+(index+1), deck=1, row=1, column=index+1, type="STANDARD", active=true }) }),
            farePolicySnapshot = JsonSerializer.Serialize(new { baseFare=150000, allowPayLater=true, policyVersion="cancel-mvp-v1" })
        });
        Assert.Equal(HttpStatusCode.Accepted, imported.StatusCode);
        var owner = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        var other = TestJwt.Mint(Guid.CreateVersion7(), ["CUSTOMER"]);
        async Task<(HttpResponseMessage Response, JsonElement Body)> Send(HttpMethod method, string path, string user, object? body = null)
        {
            using var request = new HttpRequestMessage(method,path);
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user);
            request.Headers.Add("Idempotency-Key", Guid.CreateVersion7().ToString());
            if(body is not null) request.Content=JsonContent.Create(body);
            var response=await client.SendAsync(request);
            var content=await response.Content.ReadAsStringAsync();
            return(response,string.IsNullOrEmpty(content)?default:JsonDocument.Parse(content).RootElement.Clone());
        }
        var inventory=await Send(HttpMethod.Get,$"/api/v1/trips/{trip}/seats",owner);
        var seats=inventory.Body.GetProperty("seats").EnumerateArray().Select(s=>s.GetProperty("id").GetGuid()).ToArray();
        object Selection(params Guid[] ids)=>new{seatIds=ids,pickupStopId=origin,dropoffStopId=destination};
        var held=await Send(HttpMethod.Post,$"/api/v1/trips/{trip}/seat-holds",owner,Selection(seats[0]));
        Assert.Equal(HttpStatusCode.Created,held.Response.StatusCode);
        var token=held.Body.GetProperty("holdToken").GetString();
        var heldOther=await Send(HttpMethod.Post,$"/api/v1/trips/{trip}/seat-holds",other,Selection(seats[2]));
        Assert.Equal(HttpStatusCode.Created,heldOther.Response.StatusCode);
        var denied=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{token}",other,Selection(seats[1]));
        Assert.Equal(HttpStatusCode.NotFound,denied.Response.StatusCode);
        var conflict=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{token}",owner,Selection(seats[0],seats[2]));
        Assert.Equal(HttpStatusCode.Conflict,conflict.Response.StatusCode);
        var unchanged=await Send(HttpMethod.Get,$"/api/v1/seat-holds/{token}",owner);
        Assert.Single(unchanged.Body.GetProperty("seats").EnumerateArray());
        var replaced=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{token}",owner,Selection(seats[0],seats[1]));
        Assert.Equal(HttpStatusCode.OK,replaced.Response.StatusCode);
        Assert.Equal(2,replaced.Body.GetProperty("seats").GetArrayLength());
        Assert.Equal(held.Body.GetProperty("expiresAt").GetString(),replaced.Body.GetProperty("expiresAt").GetString());
    }
}
