using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BusTicketPlatform.Identity.Application;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace BusTicketPlatform.Identity.Infrastructure.Security;

public sealed class AuthenticationOptions
{
    public const string SectionName = "Authentication";

    public string Issuer { get; set; } = "busticket-identity";
    public string Audience { get; set; } = "busticket";
    public string SigningKey { get; set; } = "";
    public int AccessTokenSeconds { get; set; } = 900;
}

public sealed class JwtTokenService(IOptions<AuthenticationOptions> options) : ITokenService
{
    public (string AccessToken, string RefreshTokenPlain, string RefreshTokenHash, int ExpiresIn) Issue(
        UserRecord user,
        IReadOnlyList<string> roles,
        Guid sessionId,
        Guid? organizationId = null)
    {
        var settings = options.Value;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Jti, Guid.CreateVersion7().ToString()),
            new("sid", sessionId.ToString()),
            new("ver", user.AuthorizationVersion.ToString())
        };
        if (organizationId is not null)
        {
            claims.Add(new Claim("org", organizationId.Value.ToString()));
        }

        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var expires = DateTime.UtcNow.AddSeconds(settings.AccessTokenSeconds);
        var jwt = new JwtSecurityToken(
            settings.Issuer,
            settings.Audience,
            claims,
            DateTime.UtcNow,
            expires,
            credentials);
        var access = new JwtSecurityTokenHandler().WriteToken(jwt);
        var refresh = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));
        return (access, refresh, AuthService.HashSecret(refresh), settings.AccessTokenSeconds);
    }
}
