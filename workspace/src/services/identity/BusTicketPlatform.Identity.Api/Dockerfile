# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0.401 AS build
WORKDIR /src

COPY BusTicketPlatform.sln ./
COPY src/services/identity/BusTicketPlatform.Identity.Domain/BusTicketPlatform.Identity.Domain.csproj src/services/identity/BusTicketPlatform.Identity.Domain/
COPY src/services/identity/BusTicketPlatform.Identity.Application/BusTicketPlatform.Identity.Application.csproj src/services/identity/BusTicketPlatform.Identity.Application/
COPY src/services/identity/BusTicketPlatform.Identity.Infrastructure/BusTicketPlatform.Identity.Infrastructure.csproj src/services/identity/BusTicketPlatform.Identity.Infrastructure/
COPY src/services/identity/BusTicketPlatform.Identity.Api/BusTicketPlatform.Identity.Api.csproj src/services/identity/BusTicketPlatform.Identity.Api/

RUN dotnet restore src/services/identity/BusTicketPlatform.Identity.Api/BusTicketPlatform.Identity.Api.csproj

COPY . .
RUN dotnet publish src/services/identity/BusTicketPlatform.Identity.Api/BusTicketPlatform.Identity.Api.csproj \
    --configuration Release \
    --output /app/publish \
    --no-restore \
    /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.12 AS runtime
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build /app/publish .

USER $APP_UID
ENTRYPOINT ["dotnet", "BusTicketPlatform.Identity.Api.dll"]
