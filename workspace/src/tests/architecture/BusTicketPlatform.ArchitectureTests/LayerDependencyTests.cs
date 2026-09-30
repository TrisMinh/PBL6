using NetArchTest.Rules;

namespace BusTicketPlatform.ArchitectureTests;

public sealed class LayerDependencyTests
{
    public static TheoryData<Type, string> Services() => new()
    {
        { typeof(Identity.Domain.AssemblyMarker), "Identity" },
        { typeof(Transport.Domain.AssemblyMarker), "Transport" },
        { typeof(Booking.Domain.AssemblyMarker), "Booking" },
        { typeof(Payment.Domain.AssemblyMarker), "Payment" },
        { typeof(Notification.Domain.AssemblyMarker), "Notification" },
        { typeof(Reporting.Domain.AssemblyMarker), "Reporting" }
    };

    [Theory]
    [MemberData(nameof(Services))]
    public void Domain_does_not_reference_host_stack(Type domainMarker, string service)
    {
        var result = Types.InAssembly(domainMarker.Assembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.AspNetCore",
                "Microsoft.EntityFrameworkCore",
                "Npgsql",
                "Yarp.ReverseProxy",
                $"BusTicketPlatform.{service}.Application",
                $"BusTicketPlatform.{service}.Infrastructure",
                $"BusTicketPlatform.{service}.Api")
            .GetResult();
        Assert.True(result.IsSuccessful, Format(result));
    }

    [Fact]
    public void Identity_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Identity.Application.AssemblyMarker).Assembly, "Identity");
    }

    [Fact]
    public void Transport_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Transport.Application.AssemblyMarker).Assembly, "Transport");
    }

    [Fact]
    public void Booking_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Booking.Application.AssemblyMarker).Assembly, "Booking");
    }

    [Fact]
    public void Payment_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Payment.Application.AssemblyMarker).Assembly, "Payment");
    }

    [Fact]
    public void Notification_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Notification.Application.AssemblyMarker).Assembly, "Notification");
    }

    [Fact]
    public void Reporting_application_does_not_reference_host_or_infrastructure()
    {
        AssertLayer(typeof(Reporting.Application.AssemblyMarker).Assembly, "Reporting");
    }

    [Fact]
    public void Building_blocks_do_not_reference_bounded_contexts()
    {
        var result = Types.InAssembly(typeof(BuildingBlocks.AssemblyMarker).Assembly)
            .ShouldNot()
            .HaveDependencyOnAny(
                "BusTicketPlatform.Identity",
                "BusTicketPlatform.Transport",
                "BusTicketPlatform.Booking",
                "BusTicketPlatform.Payment",
                "BusTicketPlatform.Notification",
                "BusTicketPlatform.Reporting",
                "BusTicketPlatform.Gateway")
            .GetResult();
        Assert.True(result.IsSuccessful, Format(result));
    }

    private static void AssertLayer(System.Reflection.Assembly application, string service)
    {
        var result = Types.InAssembly(application)
            .ShouldNot()
            .HaveDependencyOnAny(
                "Microsoft.AspNetCore",
                "Microsoft.EntityFrameworkCore",
                "Npgsql",
                "Yarp.ReverseProxy",
                $"BusTicketPlatform.{service}.Infrastructure",
                $"BusTicketPlatform.{service}.Api")
            .GetResult();
        Assert.True(result.IsSuccessful, Format(result));
    }

    private static string Format(TestResult result) =>
        result.FailingTypeNames is null ? "architecture rule failed" : string.Join(", ", result.FailingTypeNames);
}
