using System.Security.Cryptography;
using System.Text.Json;
using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Ids;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.Booking.Application;

public sealed class BookingService(IBookingRepository store, IBookingEvents events, IIdGenerator ids, TicketQrOptions ticketQr)
{
    public async Task<Result<IReadOnlyList<CouponDto>>> ListCouponsAsync(Guid tripId, CancellationToken ct)
    {
        var trip = await store.GetTripAsync(tripId, ct);
        if (trip is null) return Result<IReadOnlyList<CouponDto>>.Failure(PlatformErrors.NotFound());
        return Result<IReadOnlyList<CouponDto>>.Success(await store.ListCouponsAsync(trip.OrganizationId, ct));
    }

    public async Task<Result<CouponDto>> SaveCouponAsync(Actor actor, CouponDto input, CancellationToken ct)
    {
        if (!actor.Has("PLATFORM_ADMIN")) return Result<CouponDto>.Failure(PlatformErrors.AccessDenied());
        var coupon = input with { Code = input.Code?.Trim().ToUpperInvariant() ?? "" };
        if (!System.Text.RegularExpressions.Regex.IsMatch(coupon.Code, "^[A-Z0-9_-]{3,32}$") || coupon.Percent is < 1 or > 90 || coupon.Cap < 1 || coupon.Minimum < 0 || coupon.ExpiresAt <= coupon.StartsAt)
            return Result<CouponDto>.Failure(PlatformErrors.Validation("Thông tin mã giảm giá không hợp lệ.", "couponCode"));
        await store.SaveCouponAsync(coupon, ct);
        return Result<CouponDto>.Success(coupon);
    }

    public static long CouponDiscount(CouponDto coupon, long subtotal) => Math.Min(coupon.Cap, (long)decimal.Floor((decimal)subtotal * coupon.Percent / 100));

    private async Task<Result<CouponDto>> ValidCouponAsync(string code, TripSnapshot trip, long subtotal, CancellationToken ct)
    {
        var coupon = await store.GetCouponAsync(code.Trim().ToUpperInvariant(), ct);
        var now = DateTimeOffset.UtcNow;
        if (coupon is null || !coupon.Active || now < coupon.StartsAt || now >= coupon.ExpiresAt || (coupon.OrganizationId.HasValue && coupon.OrganizationId != trip.OrganizationId))
            return Result<CouponDto>.Failure(PlatformErrors.Validation("Mã giảm giá không hợp lệ hoặc đã hết hạn.", "couponCode"));
        if (subtotal < coupon.Minimum) return Result<CouponDto>.Failure(PlatformErrors.Validation($"Đơn tối thiểu {coupon.Minimum:N0} đ để dùng mã này.", "couponCode"));
        return Result<CouponDto>.Success(coupon);
    }

    public async Task<Result<CouponQuoteDto>> QuoteCouponAsync(Actor actor, CouponQuoteRequest request, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.HoldToken) || string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 32)
            return Result<CouponQuoteDto>.Failure(PlatformErrors.Validation("Nhập mã giảm giá hợp lệ.", "couponCode"));
        await store.ExpireHoldsAsync(ct);
        var hold = await store.GetHoldByTokenHashAsync(Hash(request.HoldToken), ct);
        if (hold is null || hold.CustomerId != actor.UserId) return Result<CouponQuoteDto>.Failure(PlatformErrors.NotFound());
        if (hold.Status != "ACTIVE" || hold.ExpiresAt <= DateTimeOffset.UtcNow) return Result<CouponQuoteDto>.Failure(PlatformErrors.SeatHoldExpired());
        var trip = await store.GetTripAsync(hold.TripId, ct);
        if (trip is null || !trip.Sellable) return Result<CouponQuoteDto>.Failure(PlatformErrors.NotFound());
        var check = await ValidCouponAsync(request.Code, trip, hold.TotalAmount, ct);
        if (!check.IsSuccess) return Result<CouponQuoteDto>.Failure(check.Error!);
        var coupon = check.Value!;
        var discount = CouponDiscount(coupon, hold.TotalAmount);
        return Result<CouponQuoteDto>.Success(new(coupon.Code, hold.TotalAmount, discount, hold.TotalAmount - discount, hold.Currency, coupon.ExpiresAt < hold.ExpiresAt ? coupon.ExpiresAt : hold.ExpiresAt));
    }

    public async Task<Result<OperationAccepted>> ImportPublishedTripAsync(TripPublishedMessage message, Guid correlationId, CancellationToken cancellationToken)
    {
        var seats = ParseSeats(message);
        await store.ImportTripAsync(message, seats, cancellationToken);
        await events.InventoryReadyAsync(message.TripId, correlationId, cancellationToken);
        return Result<OperationAccepted>.Success(new OperationAccepted(message.TripId, "ACCEPTED"));
    }

    public async Task<Result> ApplyTripStatusAsync(TripStatusChangedMessage message, CancellationToken cancellationToken)
    {
        if (message.TripId == Guid.Empty || message.Status is not ("SCHEDULED" or "BOARDING" or "DEPARTED" or "IN_TRANSIT" or "ARRIVED" or "COMPLETED" or "CANCELLED"))
        {
            return Result.Failure(PlatformErrors.Validation("Trip status update is invalid."));
        }

        await store.ApplyTripStatusAsync(message.TripId, message.Status, cancellationToken);
        return Result.Success();
    }

    public async Task<IReadOnlyDictionary<Guid, int>> AvailableSeatsAsync(Guid[] tripIds, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        return await store.AvailableSeatsAsync(tripIds, cancellationToken);
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
        if (!actor.Has("CUSTOMER"))
        {
            return Result<SeatHoldDto>.Failure(PlatformErrors.AccessDenied());
        }

        if (request.SeatIds is null
            || request.SeatIds.Count is < 1 or > 10
            || request.SeatIds.Any(id => id == Guid.Empty)
            || request.SeatIds.Distinct().Count() != request.SeatIds.Count
            || request.PickupStopId == Guid.Empty
            || request.DropoffStopId == Guid.Empty
            || request.PickupStopId == request.DropoffStopId)
        {
            return Result<SeatHoldDto>.Failure(PlatformErrors.Validation("Seat hold input is invalid."));
        }

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

    public async Task<Result<SeatHoldDto>> ReplaceHoldAsync(Actor actor, string token, CreateSeatHoldRequest request, CancellationToken cancellationToken)
    {
        if (!actor.Has("CUSTOMER")) return Result<SeatHoldDto>.Failure(PlatformErrors.AccessDenied());
        await store.ExpireHoldsAsync(cancellationToken);
        var hold = await store.GetHoldByTokenHashAsync(Hash(token), cancellationToken);
        if (hold is null || hold.CustomerId != actor.UserId) return Result<SeatHoldDto>.Failure(PlatformErrors.NotFound());
        if (hold.Status != "ACTIVE" || hold.ExpiresAt <= DateTimeOffset.UtcNow) return Result<SeatHoldDto>.Failure(PlatformErrors.BookingExpired());
        if (request.SeatIds is null || request.SeatIds.Count is < 1 or > 10 || request.SeatIds.Any(id => id == Guid.Empty) || request.SeatIds.Distinct().Count() != request.SeatIds.Count)
            return Result<SeatHoldDto>.Failure(PlatformErrors.Validation("Seat hold input is invalid."));
        var trip = await store.GetTripAsync(hold.TripId, cancellationToken);
        if (trip is null || !trip.Sellable) return Result<SeatHoldDto>.Failure(PlatformErrors.TripNotSellable());
        var updated = await store.ReplaceHoldAsync(hold, request.SeatIds, cancellationToken);
        return updated is null ? Result<SeatHoldDto>.Failure(PlatformErrors.SeatUnavailable()) : Result<SeatHoldDto>.Success(MapHold(updated with { TokenPlain = token }));
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

        if (request.PaymentChannel is not ("PREPAID" or "PAY_LATER"))
        {
            return Result<BookingDto>.Failure(PlatformErrors.Validation("Payment channel must be PREPAID or PAY_LATER.", "paymentChannel"));
        }

        if (request.Contact is null
            || string.IsNullOrWhiteSpace(request.Contact.FullName)
            || string.IsNullOrWhiteSpace(request.Contact.Email)
            || string.IsNullOrWhiteSpace(request.Contact.Phone))
        {
            return Result<BookingDto>.Failure(PlatformErrors.Validation("Booking contact is incomplete.", "contact"));
        }

        if (request.Passengers is null
            || request.Passengers.Count != hold.Seats.Count
            || request.Passengers.Select(passenger => passenger.SeatId).Distinct().Count() != hold.Seats.Count
            || request.Passengers.Any(passenger =>
                passenger.SeatId == Guid.Empty
                || string.IsNullOrWhiteSpace(passenger.FullName)
                || passenger.FullName.Length > 150
                || passenger.PickupStopId == Guid.Empty
                || passenger.DropoffStopId == Guid.Empty
                || passenger.PickupStopId == passenger.DropoffStopId
                || (!string.IsNullOrWhiteSpace(passenger.DocumentType) && string.IsNullOrWhiteSpace(passenger.DocumentNumber))
                || (string.IsNullOrWhiteSpace(passenger.DocumentType) && !string.IsNullOrWhiteSpace(passenger.DocumentNumber))))
        {
            return Result<BookingDto>.Failure(PlatformErrors.Validation("Exactly one valid passenger is required for every held seat.", "passengers"));
        }

        var heldSeatIds = hold.Seats.Select(seat => seat.Id).ToHashSet();
        if (request.Passengers.Any(passenger => !heldSeatIds.Contains(passenger.SeatId)))
        {
            return Result<BookingDto>.Failure(PlatformErrors.Validation("Passenger seat is not on the hold.", "passengers"));
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

        CouponDto? coupon = null;
        if (!string.IsNullOrWhiteSpace(request.CouponCode))
        {
            if (request.CouponCode.Length > 32) return Result<BookingDto>.Failure(PlatformErrors.Validation("Mã giảm giá không hợp lệ.", "couponCode"));
            var check = await ValidCouponAsync(request.CouponCode, trip, hold.TotalAmount, cancellationToken);
            if (!check.IsSuccess) return Result<BookingDto>.Failure(check.Error!);
            coupon = check.Value!;
        }
        var discount = coupon is null ? 0 : CouponDiscount(coupon, hold.TotalAmount);
        var netTotal = hold.TotalAmount - discount;
        if (request.ExpectedTotal != netTotal || request.Currency != hold.Currency)
            return Result<BookingDto>.Failure(PlatformErrors.PriceMismatch());

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
            discount,
            0,
            netTotal,
            hold.Currency,
            hold.ExpiresAt,
            0,
            request.Passengers, CouponCode: coupon?.Code);
        // Cumulative rounding keeps every item discount nonnegative and preserves the exact order discount.
        long runningSubtotal = 0, allocatedDiscount = 0;
        for (var index = 0; discount > 0 && index < items.Count; index++)
        {
            runningSubtotal += items[index].UnitPrice;
            var cumulativeDiscount = (long)decimal.Floor((decimal)runningSubtotal * discount / hold.TotalAmount);
            items[index] = items[index] with { Discount = cumulativeDiscount - allocatedDiscount };
            allocatedDiscount = cumulativeDiscount;
        }
        BookingRecord? created;
        try { created = await store.CreateBookingAsync(booking, items, passengers, hold.Id, cancellationToken); }
        catch (CouponUnavailableException) { return Result<BookingDto>.Failure(PlatformErrors.Validation("Mã giảm giá vừa thay đổi hoặc hết hạn. Vui lòng áp dụng lại mã.", "couponCode")); }
        if (created is null)
        {
            return Result<BookingDto>.Failure(PlatformErrors.SeatUnavailable());
        }

        await events.BookingCreatedAsync(created, correlationId, cancellationToken);
        if (!prepaid)
        {
            await store.ApplyPaidAsync(created.Id, [], cancellationToken, correlationId);
        }

        return Result<BookingDto>.Success(MapBooking(created));
    }

    public async Task<Result<BookingDto>> GetBookingAsync(Actor actor, Guid bookingId, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null || !CanRead(actor, booking))
        {
            return Result<BookingDto>.Failure(PlatformErrors.NotFound());
        }

        return Result<BookingDto>.Success(MapBooking(booking));
    }

    public async Task<Result<BookingPageDto>> ListMyBookingsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        if (page < 0 || size is < 1 or > 100)
        {
            return Result<BookingPageDto>.Failure(PlatformErrors.Validation("Page bounds are invalid."));
        }

        var items = await store.ListBookingsForCustomerAsync(actor.UserId, page, size, cancellationToken);
        var total = await store.CountBookingsForCustomerAsync(actor.UserId, cancellationToken);
        return Result<BookingPageDto>.Success(new BookingPageDto(page, size, total, Pages(total, size), items.Select(MapBooking).ToArray()));
    }

    public async Task<Result<BookingPageDto>> SearchBookingsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        var platform = actor.Has("PLATFORM_ADMIN", "PLATFORM_SUPPORT");
        if (!platform && (!actor.Has("OPERATOR_ADMIN", "OPERATOR_OPERATIONS")
            || actor.OrganizationId is null || actor.OrganizationId == Guid.Empty))
        {
            return Result<BookingPageDto>.Failure(PlatformErrors.AccessDenied());
        }

        await store.ExpireHoldsAsync(cancellationToken);
        if (page < 0 || size is < 1 or > 100)
        {
            return Result<BookingPageDto>.Failure(PlatformErrors.Validation("Page bounds are invalid."));
        }

        var org = platform ? null : actor.OrganizationId;
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

        if (booking.Status is not ("PAID" or "CONFIRMED"))
        {
            return Result<CancellationPreviewDto>.Failure(PlatformErrors.InvalidStateTransition());
        }

        if (request.TicketIds is null || request.TicketIds.Count == 0 || request.TicketIds.Distinct().Count() != request.TicketIds.Count)
        {
            return Result<CancellationPreviewDto>.Failure(PlatformErrors.Validation("At least one unique ticket is required.", "ticketIds"));
        }

        var trip = await store.GetTripAsync(booking.TripId, cancellationToken);
        if (trip is null)
            return Result<CancellationPreviewDto>.Failure(PlatformErrors.InvalidStateTransition());

        var now = DateTimeOffset.UtcNow;
        var cutoff = CancellationPolicy.SelfServiceCutoff(trip.DepartureAt);
        var (rate, allowed) = CancellationPolicy.For(trip.DepartureAt, now);
        if (!allowed)
        {
            return Result<CancellationPreviewDto>.Failure(CancellationCutoffError(trip.DepartureAt, now));
        }

        var tickets = new List<TicketRecord>();
        foreach (var ticketId in request.TicketIds)
        {
            var ticket = await store.GetTicketAsync(ticketId, cancellationToken);
            if (ticket is null || ticket.BookingId != bookingId)
            {
                return Result<CancellationPreviewDto>.Failure(PlatformErrors.Validation("A ticket cannot be cancelled.", "ticketIds"));
            }

            if (ticket.Status is not "ISSUED")
            {
                return Result<CancellationPreviewDto>.Failure(PlatformErrors.InvalidStateTransition());
            }

            tickets.Add(ticket);
        }

        var eligible = tickets.Sum(ticket => ticket.UnitPrice);
        var fee = booking.PaymentChannel == "PREPAID" ? CancellationPolicy.HalfUp(eligible * rate) : 0;
        var refund = booking.PaymentChannel == "PREPAID" ? Math.Max(0, eligible - fee) : 0;
        eligible = fee + refund;
        var expiresAt = now.AddMinutes(5);
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
            expiresAt < cutoff ? expiresAt : cutoff), cancellationToken);
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

        if (booking.Status is not ("PAID" or "CONFIRMED"))
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.InvalidStateTransition());
        }

        var trip = await store.GetTripAsync(booking.TripId, cancellationToken);
        if (trip is null)
            return Result<OperationAccepted>.Failure(PlatformErrors.InvalidStateTransition());

        var preview = await store.GetPreviewAsync(request.PreviewId, cancellationToken);
        var now = DateTimeOffset.UtcNow;
        if (!CancellationPolicy.For(trip.DepartureAt, now).Allowed)
            return Result<OperationAccepted>.Failure(CancellationCutoffError(trip.DepartureAt, now));

        if (preview is null
            || preview.BookingId != bookingId
            || preview.RequestedBy != actor.UserId
            || preview.ConsumedAt is not null
            || preview.ExpiresAt <= now)
        {
            return Result<OperationAccepted>.Failure(PlatformErrors.PreviewStale());
        }

        await store.CancelAsync(bookingId, preview.TicketIds, preview.Fee, preview.Refund, cancellationToken);
        await events.BookingCancelledAsync(booking, request.Reason, correlationId, cancellationToken);
        if (preview.Refund > 0)
        {
            await events.RefundRequestedAsync(bookingId, Guid.Empty, preview.Refund, booking.Currency, "CUSTOMER_CANCELLATION", correlationId, cancellationToken);
        }

        return Result<OperationAccepted>.Success(new OperationAccepted(bookingId, "ACCEPTED", AcceptedAt: DateTimeOffset.UtcNow));
    }

    private static AppError CancellationCutoffError(DateTimeOffset departureAt, DateTimeOffset now) =>
        new(ErrorCodes.CancellationNotAllowed, "Đã hết thời hạn tự hủy vé.", StatusCodes.Conflict,
            new Dictionary<string, object>
            {
                ["reason"] = departureAt <= now ? "TRIP_DEPARTED" : "CUTOFF_PASSED",
                ["departureAt"] = departureAt,
                ["cutoffAt"] = CancellationPolicy.SelfServiceCutoff(departureAt),
            });

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

        if (booking.PaymentChannel != "PREPAID" || message.Amount != booking.Total || message.Currency != booking.Currency)
            return Result.Failure(PlatformErrors.PaymentNotAllowed());
        if (!await store.ApplyPaidAsync(booking.Id, [], cancellationToken, correlationId))
        {
            var current = await store.GetBookingAsync(booking.Id, cancellationToken);
            if (current?.Status != "PAID")
                await events.RefundRequestedAsync(booking.Id, message.PaymentId, message.Amount, message.Currency,
                    "PAYMENT_AFTER_BOOKING_CLOSED", correlationId, cancellationToken);
        }
        return Result.Success();
    }

    public async Task<Result<TicketLookupAccess>> LookupTicketsAsync(string code, string verification, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingByCodeAsync(code, cancellationToken);
        if (booking is null && await store.GetTicketByPublicCodeAsync(code, cancellationToken) is { } ticket)
            booking = await store.GetBookingAsync(ticket.BookingId, cancellationToken);
        if (booking is null || !MatchesContact(booking, verification))
            return Result<TicketLookupAccess>.Failure(PlatformErrors.NotFound());
        var tickets = await store.ListTicketsForBookingAsync(booking.Id, cancellationToken);
        if (tickets.Count == 0)
            return Result<TicketLookupAccess>.Failure(PlatformErrors.NotFound());
        var expiry = DateTimeOffset.UtcNow.AddMinutes(14);
        return Result<TicketLookupAccess>.Success(new TicketLookupAccess(
            TicketLookupToken.Create(booking.Id, expiry, ticketQr.SigningKey),
            tickets.Select(ticket => ticket.PublicCode).ToArray(), expiry));
    }

    public async Task<Result<TicketLookupDetail>> LookupTicketAsync(string code, string token, CancellationToken cancellationToken)
    {
        if (!TicketLookupToken.TryRead(token, ticketQr.SigningKey, out var bookingId))
            return Result<TicketLookupDetail>.Failure(PlatformErrors.AuthenticationRequired());
        var ticket = await store.GetTicketByPublicCodeAsync(code, cancellationToken);
        if (ticket is null || ticket.BookingId != bookingId)
            return Result<TicketLookupDetail>.Failure(PlatformErrors.NotFound());
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        var seats = await store.ListSeatsAsync(ticket.TripId, cancellationToken);
        var seat = seats.SingleOrDefault(item => item.Code == ticket.SeatCode);
        var passenger = booking?.Items.FirstOrDefault(item => item.SeatId == seat?.Id);
        if (booking is null || seat is null || passenger is null)
            return Result<TicketLookupDetail>.Failure(PlatformErrors.NotFound());
        return Result<TicketLookupDetail>.Success(new TicketLookupDetail(
            MapTicket(ticket, ticket.Status == "ISSUED"), booking.Code, seat.Id, passenger.PickupStopId, passenger.DropoffStopId));
    }

    private static bool MatchesContact(BookingRecord booking, string verification)
    {
        if (verification.Contains('@'))
            return string.Equals(booking.ContactEmail.Trim(), verification, StringComparison.OrdinalIgnoreCase);
        static string Phone(string value)
        {
            var normalized = new string(value.Where(char.IsAsciiDigit).ToArray());
            return normalized.StartsWith("84", StringComparison.Ordinal) ? "0" + normalized[2..] : normalized;
        }
        var phone = Phone(verification);
        return phone.Length == 10 && Phone(booking.ContactPhone) == phone;
    }

    public async Task<Result<IReadOnlyList<TicketDto>>> ListBookingTicketsAsync(Actor actor, Guid bookingId, CancellationToken cancellationToken)
    {
        var booking = await store.GetBookingAsync(bookingId, cancellationToken);
        if (booking is null || !CanRead(actor, booking)) return Result<IReadOnlyList<TicketDto>>.Failure(PlatformErrors.NotFound());
        var tickets = await store.ListTicketsForBookingAsync(bookingId, cancellationToken);
        return Result<IReadOnlyList<TicketDto>>.Success(tickets.Select(ticket => MapTicket(ticket, includeQr: ticket.CustomerId == actor.UserId && ticket.Status == "ISSUED")).ToArray());
    }

    public async Task<Result<TicketPageDto>> ListTicketsAsync(Actor actor, int page, int size, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
        if (page < 0 || size is < 1 or > 100)
        {
            return Result<TicketPageDto>.Failure(PlatformErrors.Validation("Page bounds are invalid."));
        }

        var items = await store.ListTicketsForCustomerAsync(actor.UserId, page, size, cancellationToken);
        var total = await store.CountTicketsForCustomerAsync(actor.UserId, cancellationToken);
        return Result<TicketPageDto>.Success(new TicketPageDto(page, size, total, Pages(total, size), items.Select(item => MapTicket(item, includeQr: item.Status == "ISSUED")).ToArray()));
    }

    public async Task<Result<TicketDto>> GetTicketAsync(Actor actor, Guid ticketId, CancellationToken cancellationToken)
    {
        await store.ExpireHoldsAsync(cancellationToken);
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
            return Result<TicketValidationDto>.Failure(PlatformErrors.NotFound());
        }

        if (!await CanCheckInAsync(actor, ticket, cancellationToken))
        {
            return Result<TicketValidationDto>.Failure(PlatformErrors.AccessDenied());
        }

        var trip = await store.GetTripAsync(ticket.TripId, cancellationToken);
        if (trip?.Status == "CANCELLED")
        {
            return Result<TicketValidationDto>.Success(new TicketValidationDto(false, "TRIP_CANCELLED", MapTicket(ticket)));
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

        if (!await CanCheckInAsync(actor, ticket, cancellationToken))
        {
            return Result<TicketDto>.Failure(PlatformErrors.AccessDenied());
        }

        var trip = await store.GetTripAsync(ticket.TripId, cancellationToken);
        if (trip?.Status == "CANCELLED")
        {
            return Result<TicketDto>.Failure(PlatformErrors.InvalidStateTransition());
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

        var trip = await store.GetTripAsync(tripId, cancellationToken);
        if (trip is null)
        {
            return Result<ManifestDto>.Failure(PlatformErrors.NotFound());
        }

        if (!actor.Has("PLATFORM_ADMIN")
            && (actor.OrganizationId != trip.OrganizationId
                || actor.Has("DRIVER") && !actor.Has("OPERATOR_ADMIN", "OPERATOR_OPERATIONS") && trip.DriverUserId != actor.UserId))
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
        new(booking.Id, booking.Code, booking.CustomerId, booking.TripId, booking.Status, booking.PaymentChannel, new BookingContact(booking.ContactName, booking.ContactEmail, booking.ContactPhone), booking.Subtotal, booking.Discount, booking.Fee, booking.Total, booking.Currency, booking.ExpiresAt, booking.Items, booking.RowVersion, booking.OrganizationId, booking.CreatedAt, booking.CouponCode);

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
            ticket.RowVersion,
            ticket.UnitPrice);

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

    private async Task<bool> CanCheckInAsync(Actor actor, TicketRecord ticket, CancellationToken cancellationToken)
    {
        if (!actor.Has("DRIVER", "OPERATOR_ADMIN", "OPERATOR_OPERATIONS", "PLATFORM_ADMIN"))
        {
            return false;
        }

        if (actor.Has("PLATFORM_ADMIN"))
        {
            return true;
        }

        var booking = await store.GetBookingAsync(ticket.BookingId, cancellationToken);
        var trip = await store.GetTripAsync(ticket.TripId, cancellationToken);
        if (booking is null || trip is null || actor.OrganizationId != booking.OrganizationId)
        {
            return false;
        }

        var driverOnly = actor.Has("DRIVER") && !actor.Has("OPERATOR_ADMIN", "OPERATOR_OPERATIONS");
        return !driverOnly || trip.DriverUserId == actor.UserId;
    }

    private static string Hash(string value) => Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value)));

    private static Guid ParseGuid(string value) => Guid.TryParse(value, out var id) ? id : Guid.Empty;

    private static int Pages(long total, int size) => (int)((total + size - 1) / size);
}
