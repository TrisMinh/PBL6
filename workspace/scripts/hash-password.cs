#:property ManagePackageVersionsCentrally=false
#:package Konscious.Security.Cryptography.Argon2@1.3.1
using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

static string Hash(string password)
{
    var salt = RandomNumberGenerator.GetBytes(16);
    using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password));
    argon2.Salt = salt;
    argon2.DegreeOfParallelism = 1;
    argon2.Iterations = 1;
    argon2.MemorySize = 8192;
    var hash = argon2.GetBytes(32);
    return $"argon2id$m=8192$t=1$p=1${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
}

foreach (var password in args.Length == 0
    ? new[] { "CustomerPass1", "OperatorPass1", "AdminPass1234", "DriverPass1" }
    : args)
{
    Console.WriteLine($"{password}\t{Hash(password)}");
}
