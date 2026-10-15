namespace BusTicketPlatform.Identity.Application.Abstractions.Security;

public interface IPasswordHasher
{
    Task<string> HashAsync(string password);
}
