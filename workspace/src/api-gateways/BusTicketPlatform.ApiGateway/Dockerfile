FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

COPY ["src/api-gateways/BusTicketPlatform.ApiGateway/BusTicketPlatform.ApiGateway.csproj", "src/api-gateways/BusTicketPlatform.ApiGateway/"]

RUN dotnet restore "src/api-gateways/BusTicketPlatform.ApiGateway/BusTicketPlatform.ApiGateway.csproj"

COPY . .

WORKDIR "/src/src/api-gateways/BusTicketPlatform.ApiGateway"

RUN dotnet publish \
    "BusTicketPlatform.ApiGateway.csproj" \
    -c $BUILD_CONFIGURATION \
    -o /app/publish \
    /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .

ENTRYPOINT ["dotnet", "BusTicketPlatform.ApiGateway.dll"]
