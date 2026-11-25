using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

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
        var duplicate = await Send(HttpMethod.Post,$"/api/v1/trips/{trip}/seat-holds",owner,Selection(seats[1]));
        Assert.Equal(HttpStatusCode.Conflict, duplicate.Response.StatusCode);
        Assert.Equal("ACTIVE_SEAT_HOLD", duplicate.Body.GetProperty("error").GetProperty("code").GetString());
        var current = await Send(HttpMethod.Get, $"/api/v1/trips/{trip}/seat-holds/current", owner);
        Assert.Equal(HttpStatusCode.OK, current.Response.StatusCode);
        Assert.Equal(held.Body.GetProperty("expiresAt").GetString(), current.Body.GetProperty("expiresAt").GetString());
        var recoveryToken = current.Body.GetProperty("holdToken").GetString();
        var hidden = await Send(HttpMethod.Get, $"/api/v1/trips/{trip}/seat-holds/current", other);
        Assert.Equal(HttpStatusCode.NoContent, hidden.Response.StatusCode);
        var stolen = await Send(HttpMethod.Get, $"/api/v1/seat-holds/{recoveryToken}", other);
        Assert.Equal(HttpStatusCode.NotFound, stolen.Response.StatusCode);
        var heldOther=await Send(HttpMethod.Post,$"/api/v1/trips/{trip}/seat-holds",other,Selection(seats[2]));
        Assert.Equal(HttpStatusCode.Created,heldOther.Response.StatusCode);
        var denied=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{token}",other,Selection(seats[1]));
        Assert.Equal(HttpStatusCode.NotFound,denied.Response.StatusCode);
        var conflict=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{token}",owner,Selection(seats[0],seats[2]));
        Assert.Equal(HttpStatusCode.Conflict,conflict.Response.StatusCode);
        var unchanged=await Send(HttpMethod.Get,$"/api/v1/seat-holds/{token}",owner);
        Assert.Single(unchanged.Body.GetProperty("seats").EnumerateArray());
        var replaced=await Send(HttpMethod.Put,$"/api/v1/seat-holds/{recoveryToken}",owner,Selection(seats[0],seats[1]));
        Assert.Equal(HttpStatusCode.OK,replaced.Response.StatusCode);
        Assert.Equal(2,replaced.Body.GetProperty("seats").GetArrayLength());
        Assert.Equal(held.Body.GetProperty("expiresAt").GetString(),replaced.Body.GetProperty("expiresAt").GetString());

        var full = await Send(HttpMethod.Get, $"/api/v1/trips/availability?ids={trip}", owner);
        Assert.Equal(0, full.Body.GetProperty(trip.ToString()).GetInt32());
        await using var connection = new NpgsqlConnection(fixture.Container.GetConnectionString());
        await connection.OpenAsync();
        await using var expire = new NpgsqlCommand("""
            UPDATE seat_holds SET created_at = now() - interval '11 minutes', expires_at = now() - interval '1 minute'
            WHERE id = (SELECT active_hold_id FROM trip_seats WHERE id = @seat);
            """, connection);
        expire.Parameters.AddWithValue("seat", seats[2]);
        Assert.Equal(1, await expire.ExecuteNonQueryAsync());
        var available = await Send(HttpMethod.Get, $"/api/v1/trips/availability?ids={trip}", owner);
        Assert.Equal(1, available.Body.GetProperty(trip.ToString()).GetInt32());
        var batch = await Send(HttpMethod.Post, "/api/v1/trips/availability", owner, new { tripIds = new[] { trip, trip } });
        Assert.Equal(HttpStatusCode.OK, batch.Response.StatusCode);
        Assert.Equal(1, batch.Body.GetProperty(trip.ToString()).GetInt32());
        await using var status = new NpgsqlCommand("SELECT status FROM trip_seats WHERE id = @seat", connection);
        status.Parameters.AddWithValue("seat", seats[2]);
        Assert.Equal("HELD", await status.ExecuteScalarAsync());
        for (var cancellation = 0; cancellation < 4; cancellation++)
        {
            var reclaimed = await Send(HttpMethod.Post, $"/api/v1/trips/{trip}/seat-holds", other, Selection(seats[2]));
            Assert.Equal(HttpStatusCode.Created, reclaimed.Response.StatusCode);
            var reclaimedToken = reclaimed.Body.GetProperty("holdToken").GetString();
            var holdPath = $"/api/v1/seat-holds/{reclaimedToken}";
            if (cancellation == 0)
            {
                for (var toggle = 0; toggle < 4; toggle++)
                {
                    var cleared = await Send(HttpMethod.Put, holdPath, other, Selection());
                    Assert.Equal(HttpStatusCode.OK, cleared.Response.StatusCode);
                    Assert.Empty(cleared.Body.GetProperty("seats").EnumerateArray());
                    var reselected = await Send(HttpMethod.Put, holdPath, other, Selection(seats[2]));
                    Assert.Equal(HttpStatusCode.OK, reselected.Response.StatusCode);
                    Assert.Equal(reclaimed.Body.GetProperty("expiresAt").GetString(), reselected.Body.GetProperty("expiresAt").GetString());
                }
            }
            Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, holdPath + "?cancelSession=true", other)).Response.StatusCode);
            Assert.Equal(HttpStatusCode.NoContent, (await Send(HttpMethod.Delete, holdPath + "?cancelSession=true", other)).Response.StatusCode);
        }
        var cooledDown = await Send(HttpMethod.Post, $"/api/v1/trips/{trip}/seat-holds", other, Selection(seats[2]));
        Assert.Equal(HttpStatusCode.TooManyRequests, cooledDown.Response.StatusCode);
        Assert.Equal("SEAT_HOLD_COOLDOWN", cooledDown.Body.GetProperty("error").GetProperty("code").GetString());
        Assert.True(cooledDown.Body.GetProperty("error").GetProperty("details").GetProperty("retryAfterSeconds").GetInt32() > 0);
    }
}
