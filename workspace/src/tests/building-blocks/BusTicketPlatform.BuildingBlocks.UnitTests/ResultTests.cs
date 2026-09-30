using BusTicketPlatform.BuildingBlocks.Errors;
using BusTicketPlatform.BuildingBlocks.Results;

namespace BusTicketPlatform.BuildingBlocks.UnitTests;

public sealed class ResultTests
{
    [Fact]
    public void Success_has_no_error()
    {
        var result = Result.Success();

        Assert.True(result.IsSuccess);
        Assert.Null(result.Error);
    }

    [Fact]
    public void Failure_preserves_domain_code()
    {
        var error = AppError.Validation("email is required");
        var result = Result.Failure(error);

        Assert.False(result.IsSuccess);
        Assert.Equal(ErrorCodes.ValidationError, result.Error!.Code);
        Assert.Equal(400, result.Error.StatusCode);
    }

    [Fact]
    public void Generic_success_returns_value()
    {
        var result = Result<int>.Success(7);

        Assert.True(result.IsSuccess);
        Assert.Equal(7, result.Value);
    }

    [Fact]
    public void Generic_failure_has_no_value()
    {
        var result = Result<int>.Failure(AppError.NotFound("missing"));

        Assert.False(result.IsSuccess);
        Assert.Equal(default, result.Value);
        Assert.Equal(ErrorCodes.ResourceNotFound, result.Error!.Code);
    }
}
