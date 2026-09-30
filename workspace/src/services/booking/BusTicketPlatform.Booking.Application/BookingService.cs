using System.Security.Cryptography;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Booking.Application;

public sealed class BookingService(IBookingRepository store, IBookingEvents events, IIdGenerator ids, TicketQrOptions ticketQr)
{
    public async Task<Result<OperationAccepted>> ImportPublishedTripAsync(TripPublishedMessage message, Guid correlationId, CancellationToken cancellationToken)
    {
        var seats = ParseSeats(message);
        await store.ImportTripAsync(message, seats, cancellationToken);
        await events.InventoryReadyAsync(message.TripId, correlationId, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(message.TripId, "ACCEPTED"));
    }

    public async Task<Result<TripSeatListDto>> GetSeatsAsync(Guid tripId, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null)
        {
            return Result<TripSeatListDto>.Failure(PlatformErrors.NotFound());
        }

        var seats = await store.ListSeatsAsync(tripId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        return Result<TripSeatListDto>.Success(new TripSeatListDto(
            tripId,
            seats.Select(MapSeat).ToArray(),
            now,
            now));
    }

    public async Task<Result<SeatHoldDto>> CreateHoldAsync(Actor actor, Guid tripId, CreateSeatHoldRequest request, string idempotencyKey, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null || !trip.Sellable)
        {
            return Result<SeatHoldDto>.Failure(PlatformErrors.TripNotSellable());
        }

        var tokenPlain = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        var hold = new SeatHoldRecord(
            ids.NewUuidV7(),
            tripId,
            actor.UserId,
            idempotencyKey,
            Hash(tokenPlain),
            tokenPlain,
            "ACTIVE",
            0,
            trip.Currency,
            DateTimeOffset.UtcNow,
            DateTimeOffset.UtcNow.AddMinutes(10),
            []);
        var created = await store.CreateHoldAsync(hold, request.SeatIds.ToArray(), cancellationToken);
        if (created is null)
        {
            return Result<SeatHoldDto>.Failure(PlatformErrors.SeatUnavailable());
        }

        return Result<SeatHoldDto>.Success(MapHold(created));
    }

    public async Task<Result<SeatHoldDto>> GetHoldAsync(Actor actor, string token, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        var hold = await store.GetHoldByTokenHashAsync(Hash(token), cancellationToken);
        if (hold is null || hold.CustomerId != actor.UserId)
        {
            return Result<SeatHoldDto>.Failure(PlatformErrors.NotFound());
        }

        return Result<SeatHoldDto>.Success(MapHold(hold with { TokenPlain = token }));
    }

    public async Task<Result> ReleaseHoldAsync(Actor actor, string token, CancellationToken cancellationToken)
    {
        var hold = await store.GetHoldByTokenHashAsync(Hash(token), cancellationToken);
        if (hold is null || hold.CustomerId != actor.UserId)
        {
            return Result.Failure(PlatformErrors.NotFound());
        }

        if (hold.Status == "ACTIVE")
        {
            await store.ReleaseHoldAsync(hold.Id, cancellationToken);
        }

        return Result.Success();
    }

    public async Task<Result<BookingDto>> CreateBookingAsync(Actor actor, CreateBookingRequest request, Guid correlationId, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        var hold = await store.GetHoldByTokenHashAsync(Hash(request.HoldToken), cancellationToken);
        if (hold is null || hold.CustomerId != actor.UserId)
        {
            return Result<BookingDto>.Failure(PlatformErrors.NotFound());
        }

        if (hold.Status != "ACTIVE")
        {
            return Result<BookingDto>.Failure(PlatformErrors.SeatHoldExpired());
        }

        if (request.ExpectedTotal != hold.TotalAmount || request.Currency != hold.Currency)
        {
            return Result<BookingDto>.Failure(PlatformErrors.PriceMismatch());
        }

        var trip = await store.GetTripAsync(hold.TripId, cancellationToken);
        if (trip is null)
        {
            return Result<BookingDto>.Failure(PlatformErrors.NotFound());
        }

        if (request.PaymentChannel == "PAY_LATER" && !trip.AllowPayLater)
        {
            return Result<BookingDto>.Failure(PlatformErrors.PayLaterNotAllowed());
        }

        var bookingId = ids.NewUuidV7();
        var items = new List<BookingItemRecord>();
        var passengers = new List<PassengerRecord>();
        foreach (var passenger in request.Passengers)
        {
            var seat = hold.Seats.FirstOrDefault(item => item.Id == passenger.SeatId);
            if (seat is null)
            {
                return Result<BookingDto>.Failure(PlatformErrors.Validation("Passenger seat is not on the hold.", "passengers"));
            }

            var itemId = ids.NewUuidV7();
            items.Add(new BookingItemRecord(itemId, bookingId, seat.Id, seat.SourceSeatId, seat.Code, seat.Price));
            byte[]? cipher = null;
            string? last4 = null;
            if (!string.IsNullOrWhiteSpace(passenger.DocumentNumber))
            {
                cipher = System.Text.Encoding.UTF8.GetBytes(passenger.DocumentNumber);
                last4 = passenger.DocumentNumber.Length >= 4 ? passenger.DocumentNumber[^4..] : passenger.DocumentNumber.PadLeft(4, '0');
            }

            passengers.Add(new PassengerRecord(ids.NewUuidV7(), itemId, passenger.FullName, passenger.PickupStopId, passenger.DropoffStopId, passenger.DocumentType, cipher, last4));
        }

        var prepaid = request.PaymentChannel == "PREPAID";
        var booking = new BookingRecord(
            bookingId,
            "BK" + bookingId.ToString("N")[^12..].ToUpperInvariant(),
            hold.Id,
            hold.TripId,
            trip.OrganizationId,
            actor.UserId,
            request.Contact.FullName,
            request.Contact.Email,
            request.Contact.Phone,
            request.PaymentChannel,
            prepaid ? "PENDING_PAYMENT" : "CONFIRMED",
            hold.TotalAmount,
            0,
            0,
            hold.TotalAmount,
            hold.Currency,
            hold.ExpiresAt,
            0,
            request.Passengers);
        var created = await store.CreateBookingAsync(booking, items, passengers, hold.Id, cancellationToken);
        if (created is null)
        {
            return Result<BookingDto>.Failure(PlatformErrors.SeatUnavailable());
        }

        await events.BookingCreatedAsync(created, correlationId, cancellationToken);
        if (!prepaid)
        {
            await store.ApplyPaidAsync(created.Id, [], cancellationToken);
            await events.TicketsReadyAsync(created, correlationId, cancellationToken);
        }

        return Result<BookingDto>.Success(MapBooking(created));
    }

    public async Task<Result<BookingDto>> GetBookingAsync(Actor actor, Guid bookingId, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null || !CanRead(actor, booking))
        {
            return Result<BookingDto>.Failure(PlatformErrors.NotFound());
        }

        return Result<BookingDto>.Success(MapBooking(booking));
    }

    public async Task<Result<BookingPageDto>> ListMyBookingsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        size = size is < 1 or > 100 ? 20 : size;
        var items = await store.ListBookingsForCustomerAsync(actor.UserId, page, size, cancellationToken);
        var total = await store.CountBookingsForCustomerAsync(actor.UserId, cancellationToken);
        return Result<BookingPageDto>.Success(new BookingPageDto(page, size, total, Pages(total, size), items.Select(MapBooking).ToArray()));
    }

    public async Task<Result<BookingPageDto>> SearchBookingsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        if (!actor.Has("PLATFORM_ADMIN", "OPERATOR_ADMIN", "OPERATOR_OPERATIONS", "PLATFORM_SUPPORT"))
        {
            return Result<BookingPageDto>.Failure(PlatformErrors.AccessDenied());
        }

        size = size is < 1 or > 100 ? 20 : size;
        var org = actor.Has("PLATFORM_ADMIN", "PLATFORM_SUPPORT") ? (Guid?)null : actor.OrganizationId;
        var items = await store.SearchBookingsAsync(org, page, size, cancellationToken);
        var total = await store.CountBookingsAsync(org, cancellationToken);
        return Result<BookingPageDto>.Success(new BookingPageDto(page, size, total, Pages(total, size), items.Select(MapBooking).ToArray()));
    }

    public async Task<Result<CancellationPreviewDto>> PreviewAsync(Actor actor, Guid bookingId, CancellationPreviewRequest request, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null || booking.CustomerId != actor.UserId)
        {
            return Result<CancellationPreviewDto>.Failure(PlatformErrors.NotFound());
        }

        var trip = await store.GetTripAsync(booking.TripId, cancellationToken);
        var (rate, allowed) = CancellationPolicy.For(trip!.DepartureAt, DateTimeOffset.UtcNow);
        if (!allowed)
        {
            return Result<CancellationPreviewDto>.Failure(PlatformErrors.Validation("Self-service cancellation is not allowed this close to departure."));
        }

        var tickets = new List<TicketRecord>();
        foreach (var ticketId in request.TicketIds)
        {
            var ticket = await store.GetTicketAsync(ticketId, cancellationToken);
            if (ticket is null || ticket.BookingId != bookingId || ticket.Status is not "ISSUED")
            {
                return Result<CancellationPreviewDto>.Failure(PlatformErrors.Validation("A ticket cannot be cancelled.", "ticketIds"));
            }

            tickets.Add(ticket);
        }

        var eligible = booking.Total;
        var fee = booking.PaymentChannel == "PREPAID" ? CancellationPolicy.HalfUp(eligible * rate) : 0;
        var refund = booking.PaymentChannel == "PREPAID" ? Math.Max(0, eligible - fee) : 0;
        eligible = fee + refund;
        var preview = await store.InsertPreviewAsync(new CancellationPreviewRecord(
            ids.NewUuidV7(),
            bookingId,
            actor.UserId,
            tickets.Select(ticket => ticket.BookingItemId).ToArray(),
            request.TicketIds.ToArray(),
            trip.PolicyVersion,
            eligible,
            rate,
            fee,
            refund,
            DateTimeOffset.UtcNow.AddMinutes(5)), cancellationToken);
        return Result<CancellationPreviewDto>.Success(new CancellationPreviewDto(preview.Id, preview.TicketIds, preview.PolicyVersion, preview.Fee, preview.Refund, booking.Currency, preview.ExpiresAt));
    }

    public async Task<Result<OperationAccepted>> CancelAsync(Actor actor, Guid bookingId, CancelBookingRequest request, Guid correlationId, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null || booking.CustomerId != actor.UserId)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.NotFound());
        }

        if (booking.RowVersion != request.ExpectedVersion)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.VersionConflict());
        }

        var preview = await store.GetPreviewAsync(request.PreviewId, cancellationToken);
        if (preview is null || preview.BookingId != bookingId || preview.ExpiresAt <= DateTimeOffset.UtcNow)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.PreviewStale());
        }

        await store.CancelAsync(bookingId, preview.TicketIds, preview.Fee, preview.Refund, cancellationToken);
        await events.BookingCancelledAsync(booking, request.Reason, correlationId, cancellationToken);
        if (preview.Refund > 0)
        {
            await events.RefundRequestedAsync(bookingId, Guid.Empty, preview.Refund, booking.Currency, "CUSTOMER_CANCELLATION", correlationId, cancellationToken);
        }

        return Result<OperationAccepted>.Success(new OperationAccepted(bookingId, "ACCEPTED"));
    }

    public async Task<Result> ApplyPaymentSucceededAsync(PaymentSucceededMessage message, Guid correlationId, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingAsync(message.BookingId, cancellationToken);
        if (booking is null)
        {
            return Result.Failure(PlatformErrors.NotFound());
        }

        if (booking.Status == "PAID")
        {
            return Result.Success();
        }

        await store.ApplyPaidAsync(booking.Id, [], cancellationToken);
        await events.BookingPaidAsync(booking, correlationId, cancellationToken);
        await events.TicketsReadyAsync(booking, correlationId, cancellationToken);
        return Result.Success();
    }

    public async Task<Result<TicketPageDto>> ListTicketsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        size = size is < 1 or > 100 ? 20 : size;
        var items = await store.ListTicketsForCustomerAsync(actor.UserId, page, size, cancellationToken);
        var total = await store.CountTicketsForCustomerAsync(actor.UserId, cancellationToken);
        return Result<TicketPageDto>.Success(new TicketPageDto(page, size, total, Pages(total, size), items.Select(item => MapTicket(item, includeQr: item.Status == "ISSUED")).ToArray()));
    }

    public async Task<Result<TicketDto>> GetTicketAsync(Actor actor, Guid ticketId, CancellationToken cancellationToken)
    {
        var ticket = await store.GetTicketAsync(ticketId, cancellationToken);
        if (ticket is null)
        {
            return Result<TicketDto>.Failure(PlatformErrors.NotFound());
        }

        if (ticket.CustomerId == actor.UserId)
        {
            return Result<TicketDto>.Success(MapTicket(ticket, includeQr: ticket.Status == "ISSUED"));
        }

        var booking = await store.GetBookingAsync(ticket.BookingId, cancellationToken);
        if (booking is null || !CanRead(actor, booking))
        {
            return Result<TicketDto>.Failure(PlatformErrors.NotFound());
        }

        return Result<TicketDto>.Success(MapTicket(ticket));
    }

    public async Task<Result<TicketValidationDto>> ValidateAsync(Actor actor, TicketScanRequest request, CancellationToken cancellationToken)
    {
        var ticket = await ResolveScannedAsync(request.ScannedToken, cancellationToken);
        if (ticket is null || ticket.TripId != request.TripId)
        {
            return Result<TicketValidationDto>.Success(new TicketValidationDto(false, "TICKET_NOT_FOUND", null));
        }

        return Result<TicketValidationDto>.Success(new TicketValidationDto(ticket.Status == "ISSUED", ticket.Status == "ISSUED" ? null : ticket.Status, MapTicket(ticket)));
    }

    public async Task<Result<TicketDto>> CheckInAsync(Actor actor, Guid ticketId, TicketScanRequest request, CancellationToken cancellationToken)
    {
        var ticket = await ResolveScannedAsync(request.ScannedToken, cancellationToken);
        if (ticket is null || ticket.Id != ticketId || ticket.TripId != request.TripId)
        {
            return Result<TicketDto>.Failure(PlatformErrors.NotFound());
        }

        if (ticket.RowVersion != request.ExpectedVersion)
        {
            return Result<TicketDto>.Failure(PlatformErrors.VersionConflict());
        }

        if (ticket.Status != "ISSUED")
        {
            return Result<TicketDto>.Failure(PlatformErrors.TicketAlreadyCheckedIn());
        }

        await store.CheckInAsync(ticketId, actor.UserId, cancellationToken);
        var updated = await store.GetTicketAsync(ticketId, cancellationToken);
        return Result<TicketDto>.Success(MapTicket(updated!));
    }

    public async Task<Result<ManifestDto>> ManifestAsync(Actor actor, Guid tripId, CancellationToken cancellationToken)
    {
        if (!actor.Has("OPERATOR_ADMIN", "OPERATOR_OPERATIONS", "DRIVER", "PLATFORM_ADMIN"))
        {
            return Result<ManifestDto>.Failure(PlatformErrors.AccessDenied());
        }

        return Result<ManifestDto>.Success(await store.GetManifestAsync(tripId, cancellationToken));
    }

    private static IReadOnlyList<InventorySeat> ParseSeats(TripPublishedMessage message)
    {
        var json = message.BusSnapshot ?? "{}";
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        if (root.ValueKind == JsonValueKind.String)
        {
            using var nested = JsonDocument.Parse(root.GetString()!);
            return ReadSeats(nested.RootElement, message);
        }

        return ReadSeats(root, message);
    }

    private static IReadOnlyList<InventorySeat> ReadSeats(JsonElement root, TripPublishedMessage message)
    {
        var fare = 0L;
        if (!string.IsNullOrWhiteSpace(message.FarePolicySnapshot))
        {
            using var fareDoc = JsonDocument.Parse(message.FarePolicySnapshot);
            if (fareDoc.RootElement.TryGetProperty("baseFare", out var amount))
            {
                fare = amount.GetInt64();
            }
        }

        var seats = new List<InventorySeat>();
        if (!root.TryGetProperty("seats", out var array) && !root.TryGetProperty("Seats", out array))
        {
            return seats;
        }

        foreach (var seat in array.EnumerateArray())
        {
            var sourceId = seat.TryGetProperty("id", out var idEl) || seat.TryGetProperty("Id", out idEl) ? idEl.GetGuid() : Guid.CreateVersion7();
            var code = seat.TryGetProperty("code", out var codeEl) || seat.TryGetProperty("Code", out codeEl) ? codeEl.GetString()! : "NA";
            var type = seat.TryGetProperty("type", out var typeEl) || seat.TryGetProperty("Type", out typeEl) ? typeEl.GetString()! : "STANDARD";
            var deck = seat.TryGetProperty("deck", out var deckEl) || seat.TryGetProperty("Deck", out deckEl) ? deckEl.GetInt32() : 1;
            var row = seat.TryGetProperty("row", out var rowEl) || seat.TryGetProperty("Row", out rowEl) ? rowEl.GetInt32() : 1;
            var column = seat.TryGetProperty("column", out var colEl) || seat.TryGetProperty("Column", out colEl) ? colEl.GetInt32() : 1;
            var active = !seat.TryGetProperty("active", out var activeEl) && !seat.TryGetProperty("Active", out activeEl) || activeEl.GetBoolean();
            seats.Add(new InventorySeat(Guid.CreateVersion7(), message.TripId, sourceId, code, type, deck, row, column, fare, active ? "AVAILABLE" : "DISABLED", 0));
        }

        return seats;
    }

    private static bool CanRead(Actor actor, BookingRecord booking) =>
        booking.CustomerId == actor.UserId || actor.Has("PLATFORM_ADMIN", "PLATFORM_SUPPORT") || actor.OrganizationId == booking.OrganizationId;

    private static TripSeatDto MapSeat(InventorySeat seat) =>
        new(seat.Id, seat.Code, seat.Type, seat.Status, new MoneyDto(seat.Price, "VND"), seat.RowVersion);

    private static SeatHoldDto MapHold(SeatHoldRecord hold) =>
        new(hold.TokenPlain, hold.TripId, hold.Status, hold.Seats.Select(MapSeat).ToArray(), hold.ExpiresAt, DateTimeOffset.UtcNow);

    private static BookingDto MapBooking(BookingRecord booking) =>
        new(booking.Id, booking.Code, booking.CustomerId, booking.TripId, booking.Status, booking.PaymentChannel, new BookingContact(booking.ContactName, booking.ContactEmail, booking.ContactPhone), booking.Subtotal, booking.Discount, booking.Fee, booking.Total, booking.Currency, booking.ExpiresAt, booking.Items, booking.RowVersion);

    private TicketDto MapTicket(TicketRecord ticket, bool includeQr = false) =>
        new(
            ticket.Id,
            ticket.PublicCode,
            ticket.BookingId,
            ticket.TripId,
            ticket.PassengerName,
            ticket.SeatCode,
            ticket.Status,
            ticket.PaymentChannel,
            includeQr ? TicketQr.Create(ticket.Id, ticketQr.SigningKey) : null,
            ticket.IssuedAt,
            ticket.CheckedInAt,
            ticket.RowVersion);

    private async Task<TicketRecord?> ResolveScannedAsync(string scannedToken, CancellationToken cancellationToken)
    {
        var raw = scannedToken.Trim();
        if (TicketQr.TryVerify(raw, ticketQr.SigningKey, out var signedId))
        {
            var signed = await store.GetTicketAsync(signedId, cancellationToken);
            if (signed is not null)
            {
                return signed;
            }
        }

        return await store.GetTicketByHashAsync(Hash(raw), cancellationToken)
            ?? await store.GetTicketByHashAsync(raw, cancellationToken)
            ?? await store.GetTicketByPublicCodeAsync(raw, cancellationToken)
            ?? await store.GetTicketAsync(ParseGuid(raw), cancellationToken);
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));

    private static Guid ParseGuid(string value) => Guid.TryParse(value, out var id) ? id : Guid.Empty;

    private static int Pages(long total, int size) => (int)((total + size - 1) / size);
}
